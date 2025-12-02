"use client";

import { useState, useCallback, useEffect } from 'react';

interface GoldPriceData {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    currency: "EUR";
    history?: number[];
}

interface UseGoldPriceReturn {
    // Data
    gold: GoldPriceData | null;
    realTimePrice: number | null;
    loading: boolean;
    error: string | null;

    // Metadata
    lastPriceUpdate: Date | null;
    priceSource: 'cache' | 'api' | null;
    fxRate: number | null;

    // Actions
    fetchPrice: () => Promise<void>;
    retry: () => Promise<void>;
}

const OUNCE_TO_GRAM = 31.1034768;

/**
 * 💰 useGoldPrice Hook
 * Centralized gold price fetching with cache detection
 * Shared between GoldPriceWidget and GoldInvestmentCalculator
 */
export function useGoldPrice(): UseGoldPriceReturn {
    // Gold price data
    const [gold, setGold] = useState<GoldPriceData | null>(null);
    const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Metadata
    const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
    const [priceSource, setPriceSource] = useState<'cache' | 'api' | null>(null);
    const [fxRate, setFxRate] = useState<number | null>(null);

    /**
     * Detect if data came from cache or fresh API
     * By checking age of lastUpdated timestamp
     */
    const detectDataSource = (data: GoldPriceData): 'cache' | 'api' => {
        const lastUpdatedTime = new Date(data.lastUpdated).getTime();
        const now = Date.now();
        const ageMs = now - lastUpdatedTime;
        const ageHours = ageMs / (1000 * 60 * 60);

        // If data is older than 9 hours, it's from cache; otherwise it's fresh from API
        return ageHours >= 9 ? 'cache' : 'api';
    };

    /**
     * Fetch FX rate (EUR/VND) - 1 hour cache
     */
    const fetchFXRate = useCallback(async () => {
        try {
            const resp = await fetch(
                "https://api.exchangerate.host/latest?base=EUR&symbols=VND",
                { next: { revalidate: 3600 } }
            );
            if (!resp.ok) return;
            const json = await resp.json();
            const rate = Number(json?.rates?.VND);
            if (Number.isFinite(rate)) setFxRate(rate);
        } catch (e) {
            console.error("[useGoldPrice] FX rate fetch error:", e);
        }
    }, []);

    /**
     * Main fetch gold price
     */
    const fetchPrice = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch("/api/gold-price", { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }

            const data: GoldPriceData = await res.json();
            setGold(data);
            setRealTimePrice(data.price);
            setLastPriceUpdate(new Date());

            // Detect if from cache or fresh API
            const source = detectDataSource(data);
            setPriceSource(source);

            // Fetch FX rate on success
            await fetchFXRate();
        } catch (e) {
            console.error("[useGoldPrice] fetch error:", e);
            setError(e instanceof Error ? e.message : 'Failed to fetch gold price');
        } finally {
            setLoading(false);
        }
    }, [fetchFXRate]);

    /**
     * Initial load + periodic refresh (every 10 hours)
     */
    useEffect(() => {
        void fetchPrice();

        // Refresh every 10 hours (36000000ms) - matches API cycle
        const timer = setInterval(fetchPrice, 36000000);
        return () => clearInterval(timer);
    }, [fetchPrice]);

    return {
        // Data
        gold,
        realTimePrice,
        loading,
        error,

        // Metadata
        lastPriceUpdate,
        priceSource,
        fxRate,

        // Actions
        fetchPrice,
        retry: fetchPrice, // Alias for convenience
    };
}

/**
 * 📊 Formatting utilities (shared)
 */
export function formatMoney(
    num: number,
    currency: "EUR" | "VND" = "EUR"
) {
    return new Intl.NumberFormat(currency === "EUR" ? "de-DE" : "vi-VN", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: currency === "EUR" ? 2 : 0,
        maximumFractionDigits: currency === "EUR" ? 2 : 0,
    }).format(num);
}

/**
 * ⏱️ Format time difference
 */
export function formatTimeDiff(date: Date | null): string {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
}

/**
 * 📌 Get source badge info
 */
export function getSourceBadgeInfo(source: 'cache' | 'api' | null) {
    if (!source) return null;
    if (source === 'cache') {
        return {
            color: 'bg-yellow-50 border-yellow-300 text-yellow-700',
            icon: '💾',
            text: 'Cached Data',
            description: '💾 Using cached data from gold_cache.json'
        };
    }
    return {
        color: 'bg-green-50 border-green-300 text-green-700',
        icon: '🔄',
        text: 'Fresh from API',
        description: '🔄 Fresh data from Gold API'
    };
}

export const OUNCE_TO_GRAM_CONST = OUNCE_TO_GRAM;

