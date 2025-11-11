import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 💰 GOLD PRICE API (FREE, JSON CACHE 10h)
 * Multi-source + auto fallback + retry + JSON persistence across restarts
 */

export const dynamic = "force-dynamic";

interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "USD";
    history: number[];
}

/** Đường dẫn file cache (lưu trong project root: .cache/gold_cache.json) */
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "gold_cache.json");

/** Tạo thư mục .cache nếu chưa có */
function ensureCacheDir() {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
    } catch (err) {
        console.warn("[GoldPrice] ⚠️ Failed to create cache dir:", err);
    }
}

/** Biến cache trong bộ nhớ */
let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;
let lastSuccessfulSource: string | null = null;

const CACHE_DURATION_MS = 10 * 60 * 60 * 1000; // 10 giờ

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

/** 📂 Load cache từ JSON (nếu có) */
function loadCacheFromFile() {
    try {
        ensureCacheDir(); // Tạo thư mục nếu chưa có
        if (fs.existsSync(CACHE_FILE)) {
            const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
            cachedData = content.cachedData ?? null;
            lastFetchTime = content.lastFetchTime ?? 0;
            lastSuccessfulSource = content.lastSuccessfulSource ?? null;
            console.log(`[GoldPrice] 📂 Loaded cache from ${CACHE_FILE}`);
        }
    } catch (err) {
        console.warn("[GoldPrice] ⚠️ Failed to load cache:", err);
    }
}

/** 💾 Lưu cache vào JSON */
function saveCacheToFile() {
    try {
        const payload = {
            cachedData,
            lastFetchTime,
            lastSuccessfulSource,
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
        console.log(`[GoldPrice] 💾 Cache saved to ${CACHE_FILE}`);
    } catch (err) {
        console.warn("[GoldPrice] ⚠️ Failed to save cache:", err);
    }
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

/** Lấy giá spot từ upstreams */
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
                console.log(`[GoldPrice] ✅ ${src.name}: $${price}`);
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
    console.warn(`[GoldPrice] ⚠️ Using mock price: ${mock}`);
    return mock;
}

/** Tính toán thay đổi, phần trăm, lịch sử */
async function getGoldPrice(): Promise<GoldPriceData> {
    const spot = await fetchSpotUSDPerOunce();

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
        currency: "USD",
    };
}

/** 🧠 Main API route */
export async function GET() {
    loadCacheFromFile(); // ✅ load cache khi API được gọi lần đầu
    const now = Date.now();

    try {
        if (cachedData && now - lastFetchTime < CACHE_DURATION_MS) {
            console.log(`[GoldPrice] 🟢 Cache hit (source=${lastSuccessfulSource})`);
            return NextResponse.json(cachedData);
        }

        console.log("[GoldPrice] 🔄 Fetching new data...");
        const fresh = await getGoldPrice();
        cachedData = fresh;
        lastFetchTime = now;

        saveCacheToFile(); // ✅ lưu cache mới

        return NextResponse.json(fresh);
    } catch (err) {
        console.error("[/api/gold-price] Error:", err);

        const fallback =
            cachedData ||
            ({
                price: 2050.5,
                change: 0,
                changePercent: 0,
                lastUpdated: new Date().toISOString(),
                currency: "USD",
                history: buildHistory(2050.5),
            } satisfies GoldPriceData);

        return NextResponse.json(
            { ...fallback, lastUpdated: new Date().toISOString() },
            { status: 200 }
        );
    }
}
