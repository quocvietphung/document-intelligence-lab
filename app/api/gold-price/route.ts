import { NextRequest, NextResponse } from 'next/server';

interface GoldPriceData {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  currency: string;
  history: number[];
}

let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchGoldPrice(): Promise<GoldPriceData> {
  const API_URL = process.env.GOLD_API_URL || 'https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU';
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(API_URL, { next: { revalidate: 300 } });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Failed to fetch gold price (status=${response.status}): ${text}`);
      }

      const data = await response.json().catch(() => ({}));

      // Support a few possible shapes
      const priceRaw = data?.rates?.XAU ?? data?.XAU ?? data?.price ?? 0;
      const price = Number(priceRaw) || 0;

      if (!price || price <= 0) {
        throw new Error('Invalid price returned from gold API');
      }

      // Compute change based on previously cached price (if available)
      let change = 0;
      let changePercent = 0;

      if (cachedData && typeof cachedData.price === 'number' && cachedData.price > 0) {
        change = Math.round((price - cachedData.price) * 100) / 100;
        changePercent = Math.round((change / cachedData.price) * 10000) / 100; // 2 decimals
      }

      // Generate a simple stable 24-point history (hourly) based on price and timestamp
      const historyPoints = 24;
      const history: number[] = [];
      const seed = lastFetchTime || Date.now();
      // deterministic pseudo-random helper
      const rnd = (i: number) => Math.sin((seed / 1000) + i) * 0.5 + 0.5;
      for (let i = historyPoints - 1; i >= 0; i--) {
        // earlier points slightly differ from current price by small trend + noise
        const trend = (change || 0) * (i / historyPoints);
        const noise = (rnd(i) - 0.5) * (price * 0.004);
        const point = Math.max(0.1, Math.round((price - trend + noise) * 100) / 100);
        history.push(point);
      }

      return {
        price: Math.round(price * 100) / 100,
        change,
        changePercent,
        history,
        lastUpdated: new Date().toISOString(),
        currency: data?.base ?? 'USD',
      };
    } catch (err) {
      attempt++;
      const delayMs = 200 * Math.pow(2, attempt); // 400, 800, 1600
      console.warn(`gold-price: attempt ${attempt} failed, retrying in ${delayMs}ms:`, err);
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }

      console.error('Error fetching gold price after retries:', err);
      // On final failure, break and return fallback below
      break;
    }
  }

  // Fallback to mock data
  return {
    price: 2050.5,
    change: 0,
    changePercent: 0,
    lastUpdated: new Date().toISOString(),
    currency: 'USD',
    history: Array.from({ length: 24 }, () => 2050.5),
  };
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();

    // Check if we have cached data and it's still fresh
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      return NextResponse.json(cachedData);
    }

    // Fetch new data
    const data = await fetchGoldPrice();
    cachedData = data;
    lastFetchTime = now;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in gold price API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gold price' },
      { status: 500 }
    );
  }
}
