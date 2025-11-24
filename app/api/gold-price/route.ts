import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 💰 GOLD PRICE API (FREE, JSON CACHE 10h)
 * Multi-source + auto fallback + retry + JSON persistence
 * Now in EUR instead of USD!
 * Cache stored in /tmp (works on Vercel)
 */

export const dynamic = "force-dynamic";

interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "EUR";
    history: number[];
}


// 📂 Cache file path - Simple, Vercel-friendly
const CACHE_FILE = path.join(process.cwd(), "data", "gold_cache.json"); // ✅ Committed to git

// Memory cache (fallback if file cache fails)
let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;
let lastSuccessfulSource: string | null = null;
let usdToEurRate: number | null = null;
let lastFXUpdateTime = 0;

const CACHE_DURATION_MS = 10 * 60 * 60 * 1000; // 10 giờ
const FX_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 giờ

/** Các nguồn upstream (GoldAPI + MetalpriceAPI) */
const UPSTREAMS = [
    {
        name: "GoldAPI",
        url: "https://api.gold-api.com/price/XAU-USD",
    },
    {
        name: "MetalpriceAPI",
        url: "https://api.metalpriceapi.com/v1/latest?base=USD&currencies=XAU",
        invert: true,
    },
];

/** 📂 Load cache từ file JSON */
function loadCacheFromFile() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
            cachedData = content.cachedData ?? null;
            lastFetchTime = content.lastFetchTime ?? 0;
            lastSuccessfulSource = content.lastSuccessfulSource ?? null;
            usdToEurRate = content.usdToEurRate ?? null;
            lastFXUpdateTime = content.lastFXUpdateTime ?? 0;
            console.log(`[GoldPrice] 📂 Loaded cache from: ${CACHE_FILE}`);
        }
    } catch (err) {
        console.warn("[GoldPrice] ⚠️ Failed to load cache:", err);
    }
}

/** 💾 Lưu cache vào file JSON */
function saveCacheToFile() {
    try {
        const payload = {
            cachedData,
            lastFetchTime,
            lastSuccessfulSource,
            usdToEurRate,
            lastFXUpdateTime,
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
        console.log(`[GoldPrice] 💾 Cache saved to ${CACHE_FILE}`);
    } catch (err) {
        console.warn("[GoldPrice] ⚠️ Failed to save cache:", err);
    }
}

/** Fetch USD/EUR conversion rate */
async function getUSDToEURRate(): Promise<number> {
    const now = Date.now();

    // Use cached rate if still valid
    if (usdToEurRate && now - lastFXUpdateTime < FX_CACHE_DURATION_MS) {
        console.log(`[GoldPrice] 💱 Using cached FX rate: 1 USD = ${usdToEurRate} EUR`);
        return usdToEurRate;
    }

    try {
        const res = await fetch(
            "https://api.exchangerate.host/latest?base=USD&symbols=EUR",
            { cache: "no-store" }
        );
        if (!res.ok) {
            console.error(`[GoldPrice] Failed to fetch FX rate: HTTP ${res.status}`);
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const rate = Number(json?.rates?.EUR);

        if (Number.isFinite(rate) && rate > 0) {
            usdToEurRate = rate;
            lastFXUpdateTime = now;
            console.log(`[GoldPrice] ✅ USD/EUR rate: ${rate}`);
            return rate;
        }
    } catch (err) {
        console.warn("[GoldPrice] ⚠️ Failed to fetch USD/EUR rate:", err);
    }

    // Fallback to approximate rate
    const fallbackRate = 0.92;
    if (!usdToEurRate) {
        usdToEurRate = fallbackRate;
    }
    return usdToEurRate;
}

/** Tạo dữ liệu sparkline 24h */
function buildHistory(around: number): number[] {
    const arr: number[] = [];
    for (let i = 23; i >= 0; i--) {
        const noise =
            (Math.sin(Date.now() / 1000 + i) * 0.5 + (Math.random() - 0.5)) *
            (around * 0.003);
        arr.push(Math.round((around - noise) * 100) / 100);
    }
    return arr;
}

/** Timeout wrapper */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
}

/** Lấy giá từ JSON */
function pickPrice(json: any): number | null {
    if (!json) return null;
    const direct = [json?.price, json?.ask, json?.value, json?.rate, json?.data?.price];
    for (const v of direct) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
    }
    if (Number.isFinite(json?.rates?.XAU)) {
        const rate = Number(json.rates.XAU);
        if (rate > 0) return Math.round((1 / rate) * 100) / 100;
    }
    const alt = [json?.data?.value, json?.gold?.price, json?.result?.price];
    for (const v of alt) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

/** Lấy giá spot từ upstreams (in USD) */
async function fetchSpotUSDPerOunce(): Promise<number> {
    const sources = lastSuccessfulSource
        ? [
            UPSTREAMS.find((s) => s.name === lastSuccessfulSource)!,
            ...UPSTREAMS.filter((s) => s.name !== lastSuccessfulSource),
        ]
        : UPSTREAMS;

    for (const [idx, src] of sources.entries()) {
        try {
            const res = await withTimeout(fetch(src.url, { cache: "no-store" }), 6000);
            if (!(res as Response).ok) {
                console.warn(`[GoldPrice] ${src.name} HTTP ${(res as Response).status}`);
                continue;
            }
            const json = await (res as Response).json().catch(() => ({}));
            const price = pickPrice(json);
            if (price && price > 0) {
                lastSuccessfulSource = src.name;
                console.log(`[GoldPrice] ✅ ${src.name}: $${price} USD/oz`);
                return price;
            }
        } catch (err) {
            console.warn(
                `[GoldPrice] ❌ ${src.name} failed:`,
                err instanceof Error ? err.message : String(err)
            );
            await new Promise((res) => setTimeout(res, (idx + 1) * 1000));
        }
    }

    const base = 2050;
    const jitter = (Math.random() - 0.5) * 50;
    const mock = Math.round((base + jitter) * 100) / 100;
    console.warn(`[GoldPrice] ⚠️ Using mock price: ${mock} USD`);
    return mock;
}

/** Tính toán thay đổi, phần trăm, lịch sử (in EUR) */
async function getGoldPrice(): Promise<GoldPriceData> {
    // Only fetch if cache doesn't exist or is expired
    const now = Date.now();
    const cacheExpired = !cachedData || now - lastFetchTime >= CACHE_DURATION_MS;

    if (cacheExpired) {
        // Fetch new price only when cache expired
        const spotUSD = await fetchSpotUSDPerOunce();
        const fxRate = await getUSDToEURRate();
        const spot = Math.round(spotUSD * fxRate * 100) / 100;

        let change = 0;
        let changePercent = 0;

        if (cachedData?.price) {
            change = Math.round((spot - cachedData.price) * 100) / 100;
            changePercent = Math.round((change / cachedData.price) * 10000) / 100;
        }

        const history = cachedData?.history?.length
            ? [...cachedData.history.slice(-23), spot]
            : buildHistory(spot);

        return {
            price: spot,
            change,
            changePercent,
            history,
            lastUpdated: new Date().toISOString(),
            currency: "EUR",
        };
    } else {
        // Return cached data without fetching
        console.log(`[GoldPrice] 💾 Using cached price: €${cachedData?.price}`);
        return cachedData!;
    }
}

/** 🧠 Main API route */
export async function GET() {
    loadCacheFromFile(); // Load cache from data/gold_cache.json
    const now = Date.now();

    try {
        // getGoldPrice() handles cache logic internally
        const result = await getGoldPrice();

        // Update cache if data changed
        if (!cachedData || result.price !== cachedData.price) {
            cachedData = result;
            lastFetchTime = now;
            saveCacheToFile(); // Save updated cache
            console.log(`[GoldPrice] ✅ Cache updated: €${result.price}`);
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error("[/api/gold-price] Error:", err);

        const fallback =
            cachedData ||
            ({
                price: 1890.0,
                change: 0,
                changePercent: 0,
                lastUpdated: new Date().toISOString(),
                currency: "EUR",
                history: buildHistory(1890.0),
            } satisfies GoldPriceData);

        return NextResponse.json(
            { ...fallback, lastUpdated: new Date().toISOString() },
            { status: 200 }
        );
    }
}
