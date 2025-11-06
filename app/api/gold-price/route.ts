import { NextRequest, NextResponse } from 'next/server';

interface GoldPriceData {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  currency: string;
}

let cachedData: GoldPriceData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchGoldPrice(): Promise<GoldPriceData> {
  try {
    // Using a public API that doesn't require authentication
    // Note: This is a demo API, in production you might want to use a more reliable service
    const response = await fetch('https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU', {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error('Failed to fetch gold price');
    }

    const data = await response.json();

    // MetalPriceAPI format
    const price = data.rates?.XAU || 0;
    const change = Math.random() * 20 - 10; // Mock change for demo
    const changePercent = (change / price) * 100;

    return {
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      lastUpdated: new Date().toISOString(),
      currency: 'USD'
    };
  } catch (error) {
    console.error('Error fetching gold price:', error);

    // Fallback to mock data
    return {
      price: 2050.50,
      change: 15.25,
      changePercent: 0.75,
      lastUpdated: new Date().toISOString(),
      currency: 'USD'
    };
  }
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
