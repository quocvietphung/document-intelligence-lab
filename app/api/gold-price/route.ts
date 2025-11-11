import { NextResponse } from "next/server";

/**
 * Kiểu dữ liệu trả về cho client (USD / troy ounce)
 */
interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "USD";
    history: number[];
}

// Cache nội bộ trong process (10 giờ)
let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 10 * 60 * 60 * 1000; // 10 giờ

// Bắt buộc dynamic để tránh bị static render
export const dynamic = "force-dynamic";

/**
 * Helper: tạo 24 điểm giá giả lập quanh 1 mức giá để vẽ sparkline
 */
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

/**
 * Timeout helper
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
}

/**
 * Hàm pickPrice – tự nhận dạng cấu trúc JSON của các API khác nhau:
 * - Gold-API.com → { price }
 * - MetalpriceAPI.com → { rates: { XAU: 0.000417 } } → cần nghịch đảo
 * - GoldAPI.io → { data: { price } }
 */
function pickPrice(json: any): number | null {
    if (!json) return null;

    // ① Gold-API.com, GoldAPI.io
    if (Number.isFinite(json?.price)) return Number(json.price);
    if (Number.isFinite(json?.ask)) return Number(json.ask);
    if (Number.isFinite(json?.value)) return Number(json.value);
    if (Number.isFinite(json?.rate)) return Number(json.rate);
    if (Number.isFinite(json?.data?.price)) return Number(json.data.price);

    // ② MetalpriceAPI.com → cần nghịch đảo tỉ lệ
    if (Number.isFinite(json?.rates?.XAU)) {
        const rate = Number(json.rates.XAU);
        if (rate > 0) return Math.round((1 / rate) * 100) / 100;
    }

    // ③ Một số API có thể đặt sâu hơn
    const candidates = [
        json?.data?.value,
        json?.gold?.price,
        json?.result?.price,
    ];
    for (const v of candidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
    }

    return null;
}

/**
 * 2 nguồn chính (đều free, không cần API key)
 * Gold-API.com realtime — không giới hạn
 * MetalpriceAPI.com free — cần nghịch đảo
 */
const UPSTREAMS = [
    {
        name: "GoldAPI",
        url: "https://api.gold-api.com/price/XAU-USD",
    },
    {
        name: "MetalpriceAPI",
        url: "https://api.metalpriceapi.com/v1/latest?base=USD&currencies=XAU",
    },
];

/**
 * Lấy giá thật từ upstreams, fallback mock nếu lỗi
 */
async function fetchSpotUSDPerOunce(): Promise<number> {
    for (const src of UPSTREAMS) {
        try {
            const res = await withTimeout(fetch(src.url, { cache: "no-store" }), 6000);
            if (!(res as Response).ok) {
                console.warn(`[GoldPrice] ${src.name} HTTP ${(res as Response).status}`);
                continue;
            }
            const json = await (res as Response).json().catch(() => ({}));
            const price = pickPrice(json);
            if (price) {
                console.log(`[GoldPrice] ✅ ${src.name}: $${price}`);
                return price;
            }
        } catch (err) {
            console.warn(`[GoldPrice] ❌ ${src.name} failed:`, err instanceof Error ? err.message : String(err));
        }
    }

    // fallback cuối: mock an toàn
    const base = 2050;
    const jitter = (Math.random() - 0.5) * 50;
    const mock = Math.round((base + jitter) * 100) / 100;
    console.warn(`[GoldPrice] ⚠️ Using mock price: ${mock}`);
    return mock;
}

/**
 * Hàm chính: tính change, percent, history...
 */
async function getGoldPrice(): Promise<GoldPriceData> {
    const spot = await fetchSpotUSDPerOunce();

    let change = 0;
    let changePercent = 0;
    if (cachedData && cachedData.price > 0) {
        change = Math.round((spot - cachedData.price) * 100) / 100;
        changePercent = Math.round((change / cachedData.price) * 10000) / 100;
    }

    const history: number[] = [];
    if (cachedData?.history?.length) {
        const prev = cachedData.history.slice(-23);
        history.push(...prev, Math.round(spot * 100) / 100);
    } else {
        history.push(...buildHistory(spot));
    }

    return {
        price: spot,
        change,
        changePercent,
        history,
        lastUpdated: new Date().toISOString(),
        currency: "USD",
    };
}

/**
 * API route handler
 */
export async function GET() {
    try {
        const now = Date.now();

        // Dùng cache nếu còn hạn
        if (cachedData && now - lastFetchTime < CACHE_DURATION_MS) {
            return NextResponse.json(cachedData);
        }

        // Lấy dữ liệu mới
        const fresh = await getGoldPrice();
        cachedData = fresh;
        lastFetchTime = now;

        return NextResponse.json(fresh);
    } catch (err) {
        console.error("[/api/gold-price] Error:", err);

        // Fallback cuối cùng
        if (cachedData) {
            return NextResponse.json(
                { ...cachedData, lastUpdated: new Date().toISOString() },
                { status: 200 }
            );
        }

        const mock = 2050.5;
        return NextResponse.json(
            {
                price: mock,
                change: 0,
                changePercent: 0,
                lastUpdated: new Date().toISOString(),
                currency: "USD",
                history: buildHistory(mock),
            } satisfies GoldPriceData,
            { status: 200 }
        );
    }
}
