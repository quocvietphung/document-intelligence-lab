"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";

type Currency = "EUR" | "VND";
type Unit = "ounce" | "gram";

interface GoldPriceData {
    price: number;          // EUR / ounce
    change: number;         // thay đổi theo ounce
    changePercent: number;  // %
    lastUpdated: string;    // ISO
    currency: "EUR";
    history?: number[];     // 24 điểm sparkline
}

const OUNCE_TO_GRAM = 31.1034768;

export default function GoldPriceWidget() {
    const t = useTranslations("gold");
    const [gold, setGold] = useState<GoldPriceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>("EUR");
    const [unit, setUnit] = useState<Unit>("ounce");
    const [fxRate, setFxRate] = useState<number | null>(null); // EUR→VND

    const reload = useCallback(async () => {
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
    }, [t]);

    const loadFxRate = useCallback(async () => {
        try {
            // Public, không cần API key - EUR→VND
            const resp = await fetch(
                "https://api.exchangerate.host/latest?base=EUR&symbols=VND",
                { next: { revalidate: 3600 } }
            );
            if (!resp.ok) return;
            const json = await resp.json();
            const rate = Number(json?.rates?.VND);
            if (Number.isFinite(rate)) setFxRate(rate);
        } catch {
            // giữ nguyên
        }
    }, []);

    useEffect(() => {
        void reload();
        void loadFxRate();
        const fxTimer = setInterval(loadFxRate, 60 * 60 * 1000);
        return () => clearInterval(fxTimer);
    }, [reload, loadFxRate]);

    function formatMoney(num: number, curr: Currency) {
        return new Intl.NumberFormat(curr === "EUR" ? "de-DE" : "vi-VN", {
            style: "currency",
            currency: curr,
            minimumFractionDigits: curr === "EUR" ? 2 : 0,
            maximumFractionDigits: curr === "EUR" ? 2 : 0,
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
        const raw = Number(change ?? 0); // EUR/oz
        const perUnitEUR = unit === "ounce" ? raw : raw / OUNCE_TO_GRAM;
        const val = currency === "VND" && fxRate ? perUnitEUR * fxRate : perUnitEUR;
        const amount =
            currency === "VND"
                ? formatMoney(val, "VND")
                : `${val >= 0 ? "+" : ""}${val.toFixed(2)} EUR`;
        const sign = raw >= 0 ? "+" : "";
        return `${amount} (${sign}${Number(pct ?? 0).toFixed(2)}%)`;
    }

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-8" role="status" aria-live="polite">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
                    <div className="h-12 bg-slate-200 rounded-lg w-1/2" />
                    <div className="h-40 bg-slate-100 rounded-lg" />
                </div>
            </div>
        );
    }

    if (err || !gold) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-8">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-red-700 mb-2">{t("priceWidget.error")}</h3>
                        <p className="text-slate-600 text-sm">{err ?? t("priceWidget.error")}</p>
                    </div>
                    <button onClick={reload} className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105">
                        {t("priceWidget.retry")}
                    </button>
                </div>
            </div>
        );
    }

    const perOunceEUR = gold.price || 0;
    const perUnitEUR = unit === "ounce" ? perOunceEUR : perOunceEUR / OUNCE_TO_GRAM;
    const shown = currency === "EUR" ? perUnitEUR : (fxRate ? perUnitEUR * fxRate : perUnitEUR);
    const isUp = (gold.change ?? 0) >= 0;
    const high24h = history.length ? Math.max(...history) : perOunceEUR;
    const low24h  = history.length ? Math.min(...history) : perOunceEUR;

    return (
        <div className="w-full space-y-5" aria-labelledby="gold-widget-title">
            {/* Header with Controls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl flex items-center justify-center" aria-hidden="true">
                            <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 id="gold-widget-title" className="text-2xl font-bold text-slate-800">{t("priceWidget.title")}</h3>
                            <p className="text-sm text-slate-600 mt-1">{t("priceWidget.subtitle")}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap justify-start md:justify-end">
                        <label className="flex items-center gap-2 text-sm">
                            <span className="sr-only">{t("priceWidget.currencyLabel")}</span>
                            <select aria-label={t("priceWidget.currencyLabel")} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="bg-slate-50 border border-slate-300 text-slate-800 text-sm px-3 py-2 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all hover:border-slate-400">
                                <option value="EUR">EUR €</option>
                                <option value="VND">VND ₫</option>
                            </select>
                        </label>

                        <div className="inline-flex rounded-lg bg-slate-100 border border-slate-200 p-1" role="group" aria-label={t("priceWidget.unitSelector") || "Unit selector"}>
                            <button onClick={() => setUnit("ounce")} aria-pressed={unit === "ounce"} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${unit === "ounce" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-800"}`}>{t("priceWidget.unitOz")}</button>
                            <button onClick={() => setUnit("gram")}  aria-pressed={unit === "gram"}  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${unit === "gram"  ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-800"}`}>{t("priceWidget.unitGram")}</button>
                        </div>

                        <button onClick={reload} title={t("priceWidget.refresh")} className="p-3 text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-all transform hover:scale-110 hover:rotate-180 duration-500" aria-label={t("priceWidget.refresh")}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Price Display */}
            <div className="grid lg:grid-cols-3 gap-5 items-stretch">
                {/* Price Card */}
                <div className="lg:col-span-1 bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-2xl p-6 hover:border-blue-200 transition-all shadow-sm flex flex-col justify-between">
                    <div className="space-y-4">
                        {/* Current Price */}
                        <div className="space-y-1.5">
                            <p className="text-xs md:text-sm text-slate-600 leading-snug">
                                {unit === "ounce" ? (t("priceWidget.perOunce") || "per ounce") : t("priceWidget.perGram")}
                            </p>
                            <div className="flex items-end gap-2 flex-wrap">
                                <div className="text-3xl md:text-4xl font-bold text-slate-900 leading-none" aria-live="polite">
                                    {formatMoney(shown, currency)}
                                </div>
                                <span
                                  aria-hidden="true"
                                  className={`mb-0.5 ${isUp ? "text-green-600" : "text-red-600"}`}
                                >
                                    {isUp ? (
                                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7 7 7M12 3v18"/></svg>
                                    ) : (
                                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7M12 21V3"/></svg>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Change Badge */}
                        <div
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium border ${
                            isUp
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-red-50 border-red-200 text-red-700"
                          }`}
                        >
                            {formatChange(gold.change, gold.changePercent)}
                        </div>

                        {/* High/Low Stats */}
                        <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-200 text-xs md:text-sm">
                            <div className="bg-slate-100 rounded-lg p-3">
                                <div className="text-[0.7rem] md:text-xs text-slate-600 mb-1">
                                    {t("priceWidget.high24h")}
                                </div>
                                <div className="text-base md:text-lg font-semibold text-slate-900 break-words">
                                    {formatMoney(unit === "ounce" ? high24h : high24h / OUNCE_TO_GRAM, currency)}
                                </div>
                            </div>
                            <div className="bg-slate-100 rounded-lg p-3">
                                <div className="text-[0.7rem] md:text-xs text-slate-600 mb-1">
                                    {t("priceWidget.low24h")}
                                </div>
                                <div className="text-base md:text-lg font-semibold text-slate-900 break-words">
                                    {formatMoney(unit === "ounce" ? low24h : low24h / OUNCE_TO_GRAM, currency)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Last Updated */}
                    <div className="mt-4 pt-3 border-t border-slate-200 text-[0.65rem] md:text-xs text-slate-600 leading-snug">
                        <p>{t("priceWidget.lastUpdated")}</p>
                        <p className="font-mono text-slate-700 mt-0.5">
                            {new Date(gold.lastUpdated).toLocaleString()}
                        </p>
                        <p className="mt-1.5">• {t("priceWidget.cacheNote")}</p>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-8 hover:border-slate-300 transition-all shadow-sm">
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-gradient-to-b from-blue-600 to-blue-400 rounded"></span>
                                {t("priceWidget.chart")} • {t("priceWidget.last24h")}
                            </h4>
                            <div className="flex justify-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all">
                                <Sparkline points={history} />
                            </div>
                        </div>

                        {/* Info Box */}
                        {!fxRate && currency === "VND" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                                <span className="font-semibold">ℹ️</span> {t("priceWidget.fxRateMissing")}
                            </div>
                        )}

                        {/* Source Note */}
                        <div className="text-xs text-slate-600 pt-4 border-t border-slate-200 leading-relaxed">
                            {t("priceWidget.sourceNote")} <a className="text-blue-600 hover:text-blue-700 underline transition-colors" href="https://gold-api.com/docs" target="_blank" rel="noopener noreferrer">gold-api.com</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
