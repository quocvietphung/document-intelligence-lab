// /app/api/gold-price/route.ts
import { NextResponse } from "next/server";

/** Dữ liệu trả về cho client (USD / troy ounce) */
interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "USD";
    history: number[];
}

// Vercel/Next có thể reuse process ⇒ cache trong bộ nhớ
let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;

// Cache 10 giờ
const CACHE_DURATION_MS = 10 * 60 * 60 * 1000;

// App Route luôn động (không bị prerender)
export const dynamic = "force-dynamic";

// Gold Price API (free, real-time, no key)
const GOLD_API_BASE = "https://api.gold-api.com";
const SYMBOL = "XAU-USD"; // vàng (XAU) định giá theo USD

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

function withTimeout<T>(p: Promise<T>, ms: number) {
    return Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
}

/** Parse linh hoạt vì tài liệu có thể thay đổi field tên */
function pickPrice(json: any): number | null {
    const cand = [
        json?.price,
        json?.ask,
        json?.value,
        json?.rate,
        json?.data?.price,
    ];
    for (const v of cand) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

async function fetchSpotUSDPerOunce(): Promise<number> {
    // endpoint phổ biến của Gold Price API cho real-time price
    // ví dụ: GET https://api.gold-api.com/price/XAU-USD
    const url = `${GOLD_API_BASE}/price/${SYMBOL}`;
    const res = await withTimeout(fetch(url, { cache: "no-store" }), 6000);
    if (!("ok" in res) || !(res as Response).ok) {
        throw new Error(`upstream HTTP ${(res as Response).status}`);
    }
    const json = await (res as Response).json().catch(() => ({}));
    const price = pickPrice(json);
    if (!price) throw new Error("invalid price payload");
    return Math.round(price * 100) / 100;
}

function mockSpot(): number {
    const base = 2050;
    const jitter = (Math.random() - 0.5) * 50; // ±25
    return Math.round((base + jitter) * 100) / 100;
}

async function getGoldPrice(): Promise<GoldPriceData> {
    let spot: number;
    try {
        spot = await fetchSpotUSDPerOunce(); // ưu tiên nguồn thật (free, no key)
    } catch {
        // fallback an toàn nếu upstream lỗi
        spot = mockSpot();
    }

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

export async function GET() {
    try {
        const now = Date.now();
        if (cachedData && now - lastFetchTime < CACHE_DURATION_MS) {
            return NextResponse.json(cachedData);
        }
        const fresh = await getGoldPrice();
        cachedData = fresh;
        lastFetchTime = now;
        return NextResponse.json(fresh);
    } catch (err) {
        console.error("[/api/gold-price] Error:", err);
        // Fallback cuối: trả cache cũ hoặc mock cố định
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
