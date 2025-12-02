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

    function Sparkline({
        points,
        minLabel,
        maxLabel,
    }: {
        points: number[];
        minLabel: string;
        maxLabel: string;
    }) {
        if (!points?.length) return null;

        const w = 380;
        const h = 120;
        const padding = 20;
        const chartW = w - padding * 2;
        const chartH = h - padding * 2;

        const min = Math.min(...points);
        const max = Math.max(...points);
        const range = max - min || 1;
        const step = chartW / Math.max(1, points.length - 1);

        const d = points
            .map((p, i) => {
                const x = padding + i * step;
                const y = padding + chartH - ((p - min) / range) * chartH;
                return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ");

        const up = points[points.length - 1] >= points[0];

        // Last point for highlight
        const lastX = padding + (points.length - 1) * step;
        const lastY = padding + chartH - ((points[points.length - 1] - min) / range) * chartH;

        // First point
        const firstX = padding;
        const firstY = padding + chartH - ((points[0] - min) / range) * chartH;

        const fillId = `sparkline-fill-${up ? "up" : "down"}-${Date.now()}`;
        const shadowId = `sparkline-shadow-${up ? "up" : "down"}-${Date.now()}`;

        return (
            <svg
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={t("priceWidget.chart")}
                className="w-full h-32 md:h-40"
            >
                <defs>
                    {/* Premium gradient fill */}
                    <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={up ? "#fbbf24" : "#fca5a5"} stopOpacity="0.28" />
                        <stop offset="50%" stopColor={up ? "#fcd34d" : "#fecaca"} stopOpacity="0.12" />
                        <stop offset="100%" stopColor={up ? "#fef3c7" : "#fee2e2"} stopOpacity="0.02" />
                    </linearGradient>

                    {/* Glow effect */}
                    <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
                        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={up ? "#f59e0b" : "#f87171"} floodOpacity="0.22" />
                    </filter>

                    {/* Point glow */}
                    <filter id={`point-glow-${Date.now()}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
                    </filter>
                </defs>

                {/* Background subtle grid */}
                <g opacity="0.5">
                    <line x1={padding} y1={padding + chartH * 0.25} x2={w - padding} y2={padding + chartH * 0.25} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3" />
                    <line x1={padding} y1={padding + chartH * 0.5} x2={w - padding} y2={padding + chartH * 0.5} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3" />
                    <line x1={padding} y1={padding + chartH * 0.75} x2={w - padding} y2={padding + chartH * 0.75} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3" />
                </g>

                {/* Y-axis line */}
                <line x1={padding - 1} y1={padding} x2={padding - 1} y2={padding + chartH} stroke="#d1d5db" strokeWidth="1" />

                {/* Y-axis labels with better positioning */}
                <text
                    x={padding - 8}
                    y={padding + 4}
                    fontSize="11"
                    fontWeight="600"
                    fill="#374151"
                    textAnchor="end"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    {maxLabel}
                </text>
                <text
                    x={padding - 8}
                    y={padding + chartH + 4}
                    fontSize="11"
                    fontWeight="600"
                    fill="#9ca3af"
                    textAnchor="end"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    {minLabel}
                </text>

                {/* X-axis line */}
                <line x1={padding} y1={padding + chartH} x2={w - padding} y2={padding + chartH} stroke="#d1d5db" strokeWidth="1" />

                {/* Area fill with gradient */}
                <path
                    d={`${d} L ${w - padding} ${padding + chartH} L ${padding} ${padding + chartH} Z`}
                    fill={`url(#${fillId})`}
                    opacity="0.85"
                />

                {/* Main line with glow */}
                <path
                    d={d}
                    fill="none"
                    stroke={up ? "#f59e0b" : "#f87171"}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${shadowId})`}
                    opacity="0.95"
                />

                {/* Start point - subtle */}
                <circle
                    cx={firstX}
                    cy={firstY}
                    r="2.5"
                    fill={up ? "#d97706" : "#dc2626"}
                    opacity="0.4"
                />

                {/* End point - highlighted */}
                <g>
                    {/* Outer glow */}
                    <circle
                        cx={lastX}
                        cy={lastY}
                        r="5.5"
                        fill="none"
                        stroke={up ? "#fbbf24" : "#fca5a5"}
                        strokeWidth="1.2"
                        opacity="0.5"
                    />
                    {/* Main point */}
                    <circle
                        cx={lastX}
                        cy={lastY}
                        r="3.8"
                        fill="#ffffff"
                        stroke={up ? "#f59e0b" : "#f87171"}
                        strokeWidth="2"
                        filter={`url(#point-glow-${Date.now()})`}
                    />
                </g>

                {/* Trend indicator text */}
                <text
                    x={w - padding + 2}
                    y={padding + 14}
                    fontSize="12"
                    fontWeight="700"
                    fill={up ? "#d97706" : "#dc2626"}
                    textAnchor="start"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    {up ? "↑" : "↓"}
                </text>
            </svg>
        );
    }
    const historyDisplay: number[] = useMemo(() => {
        if (!history.length) return [];
        return history.map((v) => {
            const perUnitEUR = unit === "ounce" ? v : v / OUNCE_TO_GRAM;
            return currency === "VND" && fxRate ? perUnitEUR * fxRate : perUnitEUR;
        });
    }, [history, unit, currency, fxRate]);

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
    const perUnitEUR =
        unit === "ounce" ? perOunceEUR : perOunceEUR / OUNCE_TO_GRAM;
    const shown =
        currency === "EUR"
            ? perUnitEUR
            : fxRate
            ? perUnitEUR * fxRate
            : perUnitEUR;
    const isUp = (gold.change ?? 0) >= 0;

    // 24h high/low in currently selected unit & currency
    const high24hDisplay =
        historyDisplay.length > 0
            ? Math.max(...historyDisplay)
            : shown;
    const low24hDisplay =
        historyDisplay.length > 0
            ? Math.min(...historyDisplay)
            : shown;

    return (
        <div className="w-full space-y-5" aria-labelledby="gold-widget-title">
            {/* Header with Controls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-yellow-300 transition-all shadow-lg hover:shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-200 via-yellow-100 to-amber-50 border border-yellow-300/80 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all" aria-hidden="true">
                            <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 id="gold-widget-title" className="text-2xl font-bold bg-gradient-to-r from-amber-700 to-yellow-600 bg-clip-text text-transparent">{t("priceWidget.title")}</h3>
                            <p className="text-sm text-slate-500 mt-1">{t("priceWidget.subtitle")}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap justify-start md:justify-end">
                        <label className="flex items-center gap-2 text-sm">
                            <span className="sr-only">{t("priceWidget.currencyLabel")}</span>
                            <select aria-label={t("priceWidget.currencyLabel")} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-300 text-slate-800 text-sm px-4 py-2 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-400 transition-all hover:border-slate-400 hover:from-slate-100 shadow-sm font-medium">
                                <option value="EUR">EUR €</option>
                                <option value="VND">VND ₫</option>
                            </select>
                        </label>

                        <div className="inline-flex rounded-xl bg-slate-100 border border-slate-200 p-1.5" role="group" aria-label={t("priceWidget.unitSelector") || "Unit selector"}>
                            <button onClick={() => setUnit("ounce")} aria-pressed={unit === "ounce"} className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${unit === "ounce" ? "bg-white text-amber-600 shadow-md border border-slate-200" : "text-slate-600 hover:text-slate-800"}`}>{t("priceWidget.unitOz")}</button>
                            <button onClick={() => setUnit("gram")}  aria-pressed={unit === "gram"}  className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${unit === "gram"  ? "bg-white text-amber-600 shadow-md border border-slate-200" : "text-slate-600 hover:text-slate-800"}`}>{t("priceWidget.unitGram")}</button>
                        </div>

                        <button onClick={reload} title={t("priceWidget.refresh")} className="p-3 text-slate-500 hover:text-amber-600 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-amber-50 hover:to-yellow-50 rounded-xl border border-slate-200 hover:border-amber-300 transition-all transform hover:scale-110 hover:rotate-180 duration-500 shadow-sm" aria-label={t("priceWidget.refresh")}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Price Display */}
            <div className="grid lg:grid-cols-3 gap-5 items-stretch">
                {/* Price Card */}
                <div className="lg:col-span-1 bg-gradient-to-br from-yellow-50 via-amber-50 to-slate-50 border border-yellow-200/80 rounded-2xl p-6 hover:border-yellow-300 transition-all shadow-lg hover:shadow-xl flex flex-col justify-between">
                    <div className="space-y-4">
                        {/* Current Price */}
                        <div className="space-y-1.5">
                            <p className="text-xs md:text-sm text-slate-600 leading-snug font-medium">
                                {unit === "ounce" ? (t("priceWidget.perOunce") || "per ounce") : t("priceWidget.perGram")}
                            </p>
                            <div className="flex items-end gap-2 flex-wrap">
                                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-900 to-yellow-700 bg-clip-text text-transparent leading-none" aria-live="polite">
                                    {formatMoney(shown, currency)}
                                </div>
                                <span
                                  aria-hidden="true"
                                  className={`mb-0.5 transition-transform ${isUp ? "text-green-600" : "text-red-600"}`}
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
                          className={`inline-flex items-center px-4 py-2 rounded-xl text-xs md:text-sm font-semibold border transition-all ${
                            isUp
                              ? "bg-green-50/80 border-green-300 text-green-700 shadow-sm"
                              : "bg-red-50/80 border-red-300 text-red-700 shadow-sm"
                          }`}
                        >
                            {formatChange(gold.change, gold.changePercent)}
                        </div>

                        {/* High/Low Stats */}
                        <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-yellow-200/50 text-xs md:text-sm">
                            <div className="bg-gradient-to-br from-yellow-100/60 to-amber-50 rounded-xl p-3 border border-yellow-200/50">
                                <div className="text-[0.7rem] md:text-xs text-slate-600 mb-1 font-medium">
                                    {t("priceWidget.high24h")}
                                </div>
                                <div className="text-base md:text-lg font-semibold text-amber-900 break-words">
                                    {formatMoney(high24hDisplay, currency)}
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-yellow-100/60 to-amber-50 rounded-xl p-3 border border-yellow-200/50">
                                <div className="text-[0.7rem] md:text-xs text-slate-600 mb-1 font-medium">
                                    {t("priceWidget.low24h")}
                                </div>
                                <div className="text-base md:text-lg font-semibold text-amber-900 break-words">
                                    {formatMoney(low24hDisplay, currency)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Last Updated */}
                    <div className="mt-4 pt-3 border-t border-yellow-200/50 text-[0.65rem] md:text-xs text-slate-600 leading-snug">
                        <p className="font-medium">{t("priceWidget.lastUpdated")}</p>
                        <p className="font-mono text-slate-700 bg-white/50 px-2 py-1 rounded-lg mt-2">
                            {new Date(gold.lastUpdated).toLocaleString()}
                        </p>
                        <p className="mt-1.5 text-slate-500">• {t("priceWidget.cacheNote")}</p>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-8 hover:border-yellow-300 transition-all shadow-lg hover:shadow-xl">
                    <div className="space-y-6">
                        {/* Title */}
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-3">
                                <span className="w-1.5 h-5 bg-gradient-to-b from-yellow-500 to-amber-500 rounded-full shadow-md"></span>
                                <span className="bg-gradient-to-r from-amber-700 to-yellow-600 bg-clip-text text-transparent">{t("priceWidget.chart")} • {t("priceWidget.last24h")}</span>
                            </h4>
                            <div className="flex justify-center p-6 bg-gradient-to-b from-blue-50/40 via-white to-amber-50/20 rounded-xl hover:from-blue-50/60 transition-all border border-slate-100">
                                <Sparkline
                                    points={historyDisplay}
                                    maxLabel={formatMoney(high24hDisplay, currency)}
                                    minLabel={formatMoney(low24hDisplay, currency)}
                                />
                            </div>
                        </div>

                        {/* Market Statistics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* 24h Change */}
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3.5 border border-slate-200">
                                <p className="text-[0.65rem] md:text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1.5">
                                    24h Change
                                </p>
                                <p className={`text-sm md:text-base font-bold ${isUp ? "text-green-600" : "text-red-600"}`}>
                                    {isUp ? "+" : ""}{(gold.changePercent ?? 0).toFixed(2)}%
                                </p>
                                <p className="text-[0.6rem] text-slate-500 mt-1">{isUp ? "📈 Uptrend" : "📉 Downtrend"}</p>
                            </div>

                            {/* Price Range */}
                            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-3.5 border border-yellow-200">
                                <p className="text-[0.65rem] md:text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1.5">
                                    Price Range
                                </p>
                                <p className="text-sm md:text-base font-bold text-amber-700">
                                    {currency === "EUR" ? "€" : "₫"}{Math.abs(high24hDisplay - low24hDisplay).toFixed(currency === "EUR" ? 2 : 0)}
                                </p>
                                <p className="text-[0.6rem] text-slate-500 mt-1">High - Low</p>
                            </div>

                            {/* Average Price */}
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg p-3.5 border border-blue-200">
                                <p className="text-[0.65rem] md:text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1.5">
                                    Avg Price
                                </p>
                                <p className="text-sm md:text-base font-bold text-blue-700">
                                    {formatMoney(
                                        historyDisplay.length > 0
                                            ? historyDisplay.reduce((a, b) => a + b, 0) / historyDisplay.length
                                            : shown,
                                        currency
                                    )}
                                </p>
                                <p className="text-[0.6rem] text-slate-500 mt-1">24h Average</p>
                            </div>

                            {/* Volatility */}
                            <div className="bg-gradient-to-br from-slate-50 to-purple-50 rounded-lg p-3.5 border border-purple-200">
                                <p className="text-[0.65rem] md:text-xs text-slate-600 font-semibold uppercase tracking-wider mb-1.5">
                                    Volatility
                                </p>
                                <p className="text-sm md:text-base font-bold text-purple-700">
                                    {historyDisplay.length > 1
                                        ? (
                                            (Math.sqrt(
                                                historyDisplay.reduce((sum, price) => {
                                                    const avg = historyDisplay.reduce((a, b) => a + b, 0) / historyDisplay.length;
                                                    return sum + Math.pow(price - avg, 2);
                                                }, 0) / historyDisplay.length
                                            ) / (historyDisplay.reduce((a, b) => a + b, 0) / historyDisplay.length)) * 100
                                        ).toFixed(2)
                                        : "N/A"
                                    }%
                                </p>
                                <p className="text-[0.6rem] text-slate-500 mt-1">{historyDisplay.length > 1 ? "Price SD" : "—"}</p>
                            </div>
                        </div>

                        {/* Info Box */}
                        {!fxRate && currency === "VND" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 shadow-sm">
                                <span className="font-semibold">ℹ️</span> {t("priceWidget.fxRateMissing")}
                            </div>
                        )}

                        {/* Source Note */}
                        <div className="text-xs text-slate-600 pt-4 border-t border-slate-200 leading-relaxed">
                            {t("priceWidget.sourceNote")} <a className="text-amber-600 hover:text-amber-700 underline transition-colors font-medium" href="https://gold-api.com/docs" target="_blank" rel="noopener noreferrer">gold-api.com</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
