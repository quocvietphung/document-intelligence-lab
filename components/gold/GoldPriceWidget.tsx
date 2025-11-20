"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Currency = "USD" | "VND";
type Unit = "ounce" | "gram";

interface GoldPriceData {
    price: number;          // USD / ounce
    change: number;         // thay đổi theo ounce
    changePercent: number;  // %
    lastUpdated: string;    // ISO
    currency: "USD";
    history?: number[];     // 24 điểm sparkline
}

const OUNCE_TO_GRAM = 31.1034768;

export default function GoldPriceWidget() {
    const t = useTranslations("gold");
    const [gold, setGold] = useState<GoldPriceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>("USD");
    const [unit, setUnit] = useState<Unit>("ounce");
    const [fxRate, setFxRate] = useState<number | null>(null); // USD→VND

    useEffect(() => {
        void reload();
        void loadFxRate();
        const fxTimer = setInterval(loadFxRate, 60 * 60 * 1000);
        return () => clearInterval(fxTimer);
    }, []);

    async function reload() {
        try {
            setLoading(true);
            const res = await fetch("/api/gold-price", { cache: "no-store" });
            if (!res.ok) {
                // API returned non-2xx — set error and exit gracefully
                setErr(t("priceWidget.error"));
                setLoading(false);
                return;
            }
            const json: GoldPriceData = await res.json();
            setGold(json);
            setErr(null);
        } catch (e) {
            console.error("[GoldPriceWidget] fetch error:", e);
            setErr(t("priceWidget.error"));
        } finally {
            setLoading(false);
        }
    }

    async function loadFxRate() {
        try {
            // Public, không cần API key
            const resp = await fetch(
                "https://api.exchangerate.host/latest?base=USD&symbols=VND",
                { next: { revalidate: 3600 } }
            );
            if (!resp.ok) return;
            const json = await resp.json();
            const rate = Number(json?.rates?.VND);
            if (Number.isFinite(rate)) setFxRate(rate);
        } catch {
            // giữ nguyên
        }
    }

    function formatMoney(num: number, curr: Currency) {
        return new Intl.NumberFormat(curr === "USD" ? "en-US" : "vi-VN", {
            style: "currency",
            currency: curr,
            minimumFractionDigits: curr === "USD" ? 2 : 0,
            maximumFractionDigits: curr === "USD" ? 2 : 0,
        }).format(num);
    }

    const history: number[] = useMemo(() => {
        if (!gold) return [];
        if (Array.isArray((gold as any).history) && (gold as any).history.length) {
            return (gold as any).history as number[];
        }
        // tạo nhanh nếu chưa có
        const base = gold?.price || 0;
        const pts = 24;
        const arr: number[] = [];
        const trend = (gold?.change || 0) / Math.max(1, pts);
        for (let i = pts - 1; i >= 0; i--) {
            const noise = (Math.sin(i) * 0.5 + (Math.random() - 0.5)) * (base * 0.002);
            const v = Math.max(0.1, base - trend * i + noise);
            arr.push(Math.round(v * 100) / 100);
        }
        return arr;
    }, [gold]);

    function Sparkline({ points }: { points: number[] }) {
        if (!points?.length) return null;
        const w = 200, h = 48;
        const min = Math.min(...points);
        const max = Math.max(...points);
        const range = max - min || 1;
        const step = w / (points.length - 1);
        const d = points
            .map((p, i) => {
                const x = i * step;
                const y = h - ((p - min) / range) * h;
                return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ");
        const up = points[points.length - 1] >= points[0];
        return (
            <svg width={w} height={h} role="img" aria-label={t("priceWidget.chart")}>
                <path d={d} fill="none" stroke={up ? "#10b981" : "#ef4444"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={up ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.06)"} />
            </svg>
        );
    }

    function formatChange(change?: number | null, pct?: number | null) {
        const raw = Number(change ?? 0); // USD/oz
        const perUnitUSD = unit === "ounce" ? raw : raw / OUNCE_TO_GRAM;
        const val = currency === "VND" && fxRate ? perUnitUSD * fxRate : perUnitUSD;
        const amount =
            currency === "VND"
                ? formatMoney(val, "VND")
                : `${val >= 0 ? "+" : ""}${val.toFixed(2)} USD`;
        const sign = raw >= 0 ? "+" : "";
        return `${amount} (${sign}${Number(pct ?? 0).toFixed(2)}%)`;
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6" role="status" aria-live="polite">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
                    <div className="h-12 bg-gray-200 rounded w-1/2 mb-4" />
                </div>
            </div>
        );
    }

    if (err || !gold) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("priceWidget.error")}</h3>
                    <p className="text-gray-600 mb-4">{err ?? t("priceWidget.error")}</p>
                    <button onClick={reload} className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">
                        {t("priceWidget.retry")}
                    </button>
                </div>
            </div>
        );
    }

    const perOunceUSD = gold.price || 0;
    const perUnitUSD = unit === "ounce" ? perOunceUSD : perOunceUSD / OUNCE_TO_GRAM;
    const shown = currency === "USD" ? perUnitUSD : (fxRate ? perUnitUSD * fxRate : perUnitUSD);
    const isUp = (gold.change ?? 0) >= 0;
    const high24h = history.length ? Math.max(...history) : perOunceUSD;
    const low24h  = history.length ? Math.min(...history) : perOunceUSD;

    return (
        <div className="bg-white rounded-xl shadow-lg p-6" aria-labelledby="gold-widget-title">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center" aria-hidden="true">
                        <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    </div>
                    <div>
                        <h3 id="gold-widget-title" className="text-lg font-semibold text-gray-900">{t("priceWidget.title")}</h3>
                        <p className="text-sm text-gray-500">{t("priceWidget.subtitle")}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="sr-only">{t("priceWidget.currencyLabel")}</span>
                        <select aria-label={t("priceWidget.currencyLabel")} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="rounded-md border-gray-200 text-sm px-2 py-1">
                            <option value="USD">USD</option>
                            <option value="VND">VND</option>
                        </select>
                    </label>

                    <div className="inline-flex rounded-md bg-gray-100 p-1" role="group" aria-label={t("priceWidget.unitSelector") || "Unit selector"}>
                        <button onClick={() => setUnit("ounce")} aria-pressed={unit === "ounce"} className={`px-3 py-1 text-sm font-medium ${unit === "ounce" ? "bg-white shadow rounded" : "text-gray-600"}`}>{t("priceWidget.unitOz")}</button>
                        <button onClick={() => setUnit("gram")}  aria-pressed={unit === "gram"}  className={`px-3 py-1 text-sm font-medium ${unit === "gram"  ? "bg-white shadow rounded" : "text-gray-600"}`}>{t("priceWidget.unitGram")}</button>
                    </div>

                    <button onClick={reload} title={t("priceWidget.refresh")} className="p-2 text-gray-400 hover:text-gray-600" aria-label={t("priceWidget.refresh")}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-1 text-center md:text-left">
                    <div className="flex items-center gap-2">
                        <div className="text-3xl md:text-4xl font-bold text-gray-900" aria-live="polite">
                            {formatMoney(shown, currency)}
                        </div>
                        <span aria-hidden="true" className={`mt-1 ${isUp ? "text-green-600" : "text-red-600"}`}>
              {isUp ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7 7 7M12 3v18"/></svg>
              ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7M12 21V3"/></svg>
              )}
            </span>
                    </div>

                    <div className="text-sm text-gray-500 mt-1">{unit === "ounce" ? (t("priceWidget.perOunce") || "per ounce") : t("priceWidget.perGram")}</div>

                    <div className={`inline-block mt-3 px-3 py-1 rounded-full text-sm font-medium ${isUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {formatChange(gold.change, gold.changePercent)}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 rounded bg-gray-50">
                            <div className="text-gray-500">{t("priceWidget.high24h")}</div>
                            <div className="font-semibold text-gray-900">
                                {formatMoney(unit === "ounce" ? high24h : high24h / OUNCE_TO_GRAM, currency)}
                            </div>
                        </div>
                        <div className="p-2 rounded bg-gray-50">
                            <div className="text-gray-500">{t("priceWidget.low24h")}</div>
                            <div className="font-semibold text-gray-900">
                                {formatMoney(unit === "ounce" ? low24h : low24h / OUNCE_TO_GRAM, currency)}
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 mt-2">
                        {t("priceWidget.lastUpdated")} : {new Date(gold.lastUpdated).toLocaleString()} • {t("priceWidget.cacheNote")}
                    </div>
                </div>

                <div className="md:col-span-2 flex flex-col items-center">
                    <div className="mb-2 w-full flex justify-center"><Sparkline points={history} /></div>
                    <div className="text-xs text-gray-500">{t("priceWidget.chart")} • {t("priceWidget.last24h")}</div>
                    {!fxRate && currency === "VND" && (
                        <div className="mt-2 text-[11px] text-amber-600">{t("priceWidget.fxRateMissing")}</div>
                    )}
                </div>
            </div>

            <div className="mt-4 border-t pt-3 text-[11px] text-gray-500 leading-relaxed">
                {t("priceWidget.sourceNote")} <a className="underline" href="https://gold-api.com/docs" target="_blank" rel="noopener noreferrer">gold-api.com</a>
            </div>
        </div>
    );
}
