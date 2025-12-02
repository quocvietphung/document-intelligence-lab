import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "EUR";
    history: number[];
}

const CACHE_FILE = path.join(process.cwd(), "data", "gold_cache.json");

let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;

const CACHE_DURATION_MS = 10 * 60 * 60 * 1000; // 10h
const OUNCE_TO_GRAM = 31.1034768;

/** Load cache */
function loadCacheFromFile() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const content = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
            cachedData = content.cachedData ?? null;
            lastFetchTime = content.lastFetchTime ?? 0;
        }
    } catch (err) {
        console.warn("[GoldPrice] Failed to load cache:", err);
    }
}

/** Save cache */
function saveCacheToFile() {
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ cachedData, lastFetchTime }, null, 2),
            "utf8"
        );
        console.log(`[GoldPrice] Saved cache → ${CACHE_FILE}`);
    } catch (err) {
        console.warn("[GoldPrice] Failed to save cache:", err);
    }
}

/** Synthetic 24h history */
function generateFresh24hHistory(currentPrice: number): number[] {
    const arr: number[] = [];
    const trend = (Math.random() - 0.5) * (currentPrice * 0.005);

    for (let i = 0; i < 23; i++) {
        const progress = i / 23;
        const trended = currentPrice - trend * (1 - progress);
        const noise =
            (Math.sin(currentPrice + i) * 0.5 +
                (Math.random() - 0.5)) *
            (currentPrice * 0.002);

        const price = Math.round((trended + noise) * 100) / 100;
        arr.push(Math.max(currentPrice * 0.95, price));
    }

    arr.push(Math.round(currentPrice * 100) / 100);
    return arr;
}

/** Fetch current price from Swissquote (EUR per ounce) */
async function fetchGoldPriceEURPerOunce(): Promise<number> {
    const url =
        "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/EUR";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Swissquote API failed");

    const json = await res.json();
    const first = json[0];

    if (!first || !first.spreadProfilePrices)
        throw new Error("Invalid Swissquote structure");

    // Prefer PRIME profile
    let profile = first.spreadProfilePrices.find(
        (p: any) => p.spreadProfile === "prime"
    );
    if (!profile) profile = first.spreadProfilePrices[0];

    const bid = Number(profile.bid);
    const ask = Number(profile.ask);

    if (!bid || !ask) throw new Error("Invalid bid/ask from Swissquote");

    const mid = (bid + ask) / 2;
    const rounded = Math.round(mid * 100) / 100;

    console.log(`[Swissquote] EUR/oz → bid=${bid}, ask=${ask}, mid=${rounded}`);

    return rounded;
}

/** Convert ounce → gram */
function ounceToGram(ouncePrice: number): number {
    return Math.round((ouncePrice / OUNCE_TO_GRAM) * 100) / 100;
}

/** Main logic */
async function getGoldPrice(): Promise<GoldPriceData> {
    const now = Date.now();
    const cacheExpired = !cachedData || now - lastFetchTime >= CACHE_DURATION_MS;

    if (cacheExpired) {
        const eurPerOunce = await fetchGoldPriceEURPerOunce();

        // Convert to EUR/gram
        const spotPrice = ounceToGram(eurPerOunce);

        let change = 0;
        let changePercent = 0;

        if (cachedData?.price) {
            change = Math.round((spotPrice - cachedData.price) * 100) / 100;
            changePercent = Math.round((change / cachedData.price) * 10000) / 100;
        }

        const history = generateFresh24hHistory(spotPrice);

        return {
            price: spotPrice,
            change,
            changePercent,
            lastUpdated: new Date().toISOString(),
            currency: "EUR",
            history,
        };
    }

    return {
        ...cachedData!,
        history: generateFresh24hHistory(cachedData!.price),
        lastUpdated: new Date().toISOString(),
    };
}

/** Route handler */
export async function GET() {
    loadCacheFromFile();
    const now = Date.now();

    try {
        const result = await getGoldPrice();

        if (!cachedData || result.price !== cachedData.price) {
            cachedData = result;
            lastFetchTime = now;
            saveCacheToFile();
        }

        return NextResponse.json({
            ...result,
            fxRate: 1.0,
        });
    } catch (err) {
        console.error("[GoldPrice API] ERROR:", err);

        const fallbackPrice = cachedData?.price || 60.0;

        return NextResponse.json({
            price: fallbackPrice,
            change: 0,
            changePercent: 0,
            currency: "EUR",
            history: generateFresh24hHistory(fallbackPrice),
            lastUpdated: new Date().toISOString(),
            fxRate: 1.0,
        });
    }
}
