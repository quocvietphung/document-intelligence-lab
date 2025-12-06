import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "EUR";
    history: number[];
}

const OUNCE_TO_GRAM = 31.1034768;

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
    const eurPerOunce = await fetchGoldPriceEURPerOunce();
    const spotPrice = eurPerOunce;
    const history = generateFresh24hHistory(spotPrice);
    return {
        price: spotPrice,
        change: 0,
        changePercent: 0,
        lastUpdated: new Date().toISOString(),
        currency: "EUR",
        history,
    };
}

/** Route handler */
export async function GET() {
    try {
        const result = await getGoldPrice();
        return NextResponse.json({ ...result, fxRate: 1.0 });
    } catch (err) {
        console.error("[GoldPrice API] ERROR:", err);
        return NextResponse.json({
            price: 0,
            change: 0,
            changePercent: 0,
            currency: "EUR",
            history: [],
            lastUpdated: new Date().toISOString(),
            fxRate: 1.0,
        });
    }
}
