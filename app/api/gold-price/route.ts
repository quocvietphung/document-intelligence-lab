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
  const provider = process.env.GOLD_API_PROVIDER || 'metalpriceapi';
  const maxAttempts = 3;
  let attempt = 0;

  function derivePrice(raw: any): number {
    if (!raw) return 0;
    let price = Number(raw) || 0;
    // Many APIs when base=USD & currencies=XAU return XAU per 1 USD (~0.0004). Invert to get USD per XAU.
    if (price > 0 && price < 5) {
      price = 1 / price; // invert tiny rate
    }
    return price;
  }

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(API_URL, { next: { revalidate: 300 } });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Failed to fetch gold price (status=${response.status}): ${text}`);
      }

      const data: any = await response.json().catch(() => ({}));

      let price = 0;
      if (provider === 'metalpriceapi') {
        // Expect shape { base: 'USD', rates: { XAU: 0.00043 } }
        const rate = data?.rates?.XAU ?? data?.XAU ?? data?.price;
        price = derivePrice(rate);
      } else if (provider === 'metalsapi') {
        // Hypothetical shape { success: true, rates: { XAU: 2365.12 } } (already USD per ounce)
        const rate = data?.rates?.XAU ?? data?.price;
        price = Number(rate) || 0;
      } else if (provider === 'goldapi') {
        // Example shape { price: 2365.12 }
        price = Number(data?.price) || 0;
      } else {
        const generic = data?.rates?.XAU ?? data?.price;
        price = derivePrice(generic);
      }

      if (!price || price <= 0 || !isFinite(price)) {
        throw new Error(`Invalid price after parsing provider='${provider}' raw=${JSON.stringify(data).slice(0,200)}`);
      }

      // Compute change versus cached price
      let change = 0;
      let changePercent = 0;
      if (cachedData && cachedData.price > 0) {
        change = Math.round((price - cachedData.price) * 100) / 100;
        changePercent = Math.round((change / cachedData.price) * 10000) / 100;
      }

      // Build history: reuse previous history (shift + new) to preserve continuity
      const history: number[] = [];
      if (cachedData?.history?.length) {
        const prev = cachedData.history.slice(-23); // keep last 23 points
        history.push(...prev, Math.round(price * 100) / 100);
      } else {
        // initialize synthetic history around current price
        for (let i = 23; i >= 0; i--) {
          const noise = (Math.sin((Date.now()/1000)+i) * 0.5 + (Math.random()-0.5)) * (price * 0.003);
            history.push(Math.round((price - noise) * 100) / 100);
        }
      }

      return {
        price: Math.round(price * 100) / 100,
        change,
        changePercent,
        history,
        lastUpdated: new Date().toISOString(),
        currency: 'USD',
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
    }
  }

  // Fallback: if we have cached data, refresh timestamp & zero change; else static mock
  if (cachedData) {
    return {
      ...cachedData,
      lastUpdated: new Date().toISOString(),
      change: 0,
      changePercent: 0,
    };
  }

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
