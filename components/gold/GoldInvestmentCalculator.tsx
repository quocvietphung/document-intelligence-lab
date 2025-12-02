"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useGoldPrice, formatTimeDiff, getSourceBadgeInfo } from '@/lib/useGoldPrice';

interface CalculatorResult {
  currentValue: number;
  futurePrice: number;
  futureValue: number;
  gain: number;
  gainPercent: number;
}

export default function GoldInvestmentCalculator() {
  const t = useTranslations('gold');

  const [amount, setAmount] = useState<number>(10000);
  const [unitPrice, setUnitPrice] = useState<number>(1890);
  const [futurePrice, setFuturePrice] = useState<number>(2100);
  const [years, setYears] = useState<number>(5);
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());

  // Real-time price from shared hook!
  const [useRealTimePrice, setUseRealTimePrice] = useState<boolean>(true);
  const { realTimePrice, lastPriceUpdate, priceSource, fetchPrice } = useGoldPrice();
  const [priceLoading] = useState(false);

  // Auto-update unitPrice when realTimePrice changes and useRealTimePrice is ON
  useEffect(() => {
    if (useRealTimePrice && realTimePrice) {
      setUnitPrice(realTimePrice);
    }
  }, [realTimePrice, useRealTimePrice]);

  const result: CalculatorResult & { ouncesBought: number } = useMemo(() => {
    const currentValue = amount;
    const ouncesBought = unitPrice > 0 ? amount / unitPrice : 0;
    const projectedValue = ouncesBought * futurePrice;
    const gain = projectedValue - currentValue;
    const gainPercent = currentValue > 0 ? (gain / currentValue) * 100 : 0;

    return {
      currentValue,
      futurePrice,
      futureValue: projectedValue,
      gain,
      gainPercent,
      ouncesBought,
    };
  }, [amount, unitPrice, futurePrice]);

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2
    }).format(v);

  // Use helper from hook
  const getLastUpdateText = () => formatTimeDiff(lastPriceUpdate);

  const sourceBadge = getSourceBadgeInfo(priceSource);

  // Chart data for visualization
  const chartData = useMemo(() => {
    const points = [];
    for (let i = 0; i <= years; i++) {
      const progress = years > 0 ? i / years : 0;
      const price = unitPrice + (futurePrice - unitPrice) * progress;
      const value = (amount / unitPrice) * price;
      const actualYear = startYear + i; // Năm cụ thể
      points.push({ year: i, actualYear, price, value });
    }
    return points;
  }, [amount, unitPrice, futurePrice, years, startYear]);

  // Max values for scaling charts
  const maxValue = Math.max(...chartData.map(d => d.value), result.futureValue);
  const minPrice = Math.min(unitPrice, futurePrice);
  const maxPrice = Math.max(unitPrice, futurePrice);

  const priceRange = maxPrice - minPrice || 1;
  const safeMaxValue = maxValue || 1;

  return (
    <div className="w-full">
      <div className="space-y-6 md:space-y-8">

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
          {/* Input Controls */}
          <div className="lg:col-span-1 space-y-5 md:space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 md:space-y-6 hover:border-slate-300 transition-all shadow-sm">
              {/* Investment Amount */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs md:text-sm font-semibold text-slate-900">
                    {t('calculator.investmentAmount')}
                  </label>
                  <button
                    onClick={() => fetchPrice()}
                    disabled={priceLoading}
                    title="Update gold price from API"
                    className="text-xs md:text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-all disabled:opacity-50"
                  >
                    {priceLoading ? '⟳ Updating...' : '⟳ Update Price'}
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 md:px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold text-sm md:text-base">€</span>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 100)}
                    className="flex-1 bg-transparent text-slate-900 font-semibold text-sm md:text-base outline-none placeholder-slate-400"
                  />
                </div>
                <input
                  type="range"
                  min="100"
                  max="100000"
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[0.7rem] md:text-xs text-slate-600">
                  <span>€100</span>
                  <span>€100,000</span>
                </div>
              </div>

              {/* Current Price */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs md:text-sm font-semibold text-slate-900">
                    {t('calculator.currentPrice')}
                  </label>
                  {useRealTimePrice && realTimePrice && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 border border-green-300 rounded-full text-[0.65rem] md:text-xs font-semibold text-green-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      Real-time
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 md:px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold text-sm md:text-base">€</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={unitPrice}
                    onChange={(e) => {
                      setUnitPrice(Number(e.target.value) || 100);
                      setUseRealTimePrice(false); // Disable real-time when manually edited
                    }}
                    disabled={useRealTimePrice && priceLoading}
                    className={`flex-1 bg-transparent text-slate-900 font-semibold text-sm md:text-base outline-none placeholder-slate-400 ${
                      useRealTimePrice && priceLoading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                {/* Real-time Toggle */}
                <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => setUseRealTimePrice(!useRealTimePrice)}
                    className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors ${
                      useRealTimePrice
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                        useRealTimePrice ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-slate-600">
                    {useRealTimePrice ? '📡 Auto-sync with API' : '📝 Manual price'}
                  </span>
                  {priceLoading && useRealTimePrice && (
                    <span className="text-[0.65rem] text-slate-500 ml-auto">Loading...</span>
                  )}
                </div>

                {/* Data Source Badge */}
                {sourceBadge && (
                  <div className={`mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] md:text-xs font-semibold border ${sourceBadge.color}`}>
                    <span>{sourceBadge.icon}</span>
                    <span>{sourceBadge.text}</span>
                  </div>
                )}

                {/* Last Update Info */}
                <div className="pt-2.5 text-[0.65rem] md:text-xs text-slate-500 space-y-1">
                  {lastPriceUpdate && (
                    <>
                      <p>📅 Last updated: <span className="font-semibold text-slate-600">{getLastUpdateText()}</span></p>
                      <p className="text-slate-400">
                        {priceSource === 'cache'
                          ? '💾 Using cached data from gold_cache.json'
                          : priceSource === 'api'
                          ? '🔄 Fresh data from Gold API'
                          : '⏱️ API refreshes every 10 hours'}
                      </p>
                    </>
                  )}
                </div>

                {realTimePrice && !useRealTimePrice && (
                  <p className="text-xs text-slate-500 pt-1.5">
                    Current market price: <span className="font-semibold text-slate-700">€{realTimePrice.toFixed(2)}</span>
                  </p>
                )}
              </div>

              {/* Projected Price */}
              <div className="space-y-2.5">
                <label className="block text-xs md:text-sm font-semibold text-slate-900">
                  {t('calculator.projectedPrice')}
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 md:px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold text-sm md:text-base">€</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={futurePrice}
                    onChange={(e) => setFuturePrice(Number(e.target.value) || 100)}
                    className="flex-1 bg-transparent text-slate-900 font-semibold text-sm md:text-base outline-none placeholder-slate-400"
                  />
                </div>
                <input
                  type="range"
                  min={Math.max(100, unitPrice * 0.5)}
                  max={unitPrice * 3}
                  step="10"
                  value={futurePrice}
                  onChange={(e) => setFuturePrice(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Years */}
              <div className="space-y-2.5">
                <label className="block text-xs md:text-sm font-semibold text-slate-900">
                  {t('calculator.investmentPeriod')}: <span className="text-blue-600 text-base md:text-lg">{years}</span> {years > 1 ? t('calculator.years') : t('calculator.year')}
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[0.7rem] md:text-xs text-slate-600">
                  <span>1</span>
                  <span>30 years</span>
                </div>
              </div>

              {/* Start Year */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200">
                <label className="block text-xs md:text-sm font-semibold text-slate-900">
                  Start Year: <span className="text-emerald-600 text-base md:text-lg">{startYear}</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 md:px-4 py-2 border border-slate-200 hover:border-emerald-300 transition-all">
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    step="1"
                    value={startYear}
                    onChange={(e) => setStartYear(Number(e.target.value) || new Date().getFullYear())}
                    className="flex-1 bg-transparent text-slate-900 font-semibold text-sm md:text-base outline-none placeholder-slate-400"
                  />
                </div>
                <div className="flex justify-between text-[0.7rem] md:text-xs text-slate-600">
                  <span>2000</span>
                  <span>2100</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts & Results */}
          <div className="lg:col-span-2 space-y-5 md:space-y-6">
            {/* Price Development Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 hover:border-amber-300 transition-all shadow-lg">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm md:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-1 h-5 bg-gradient-to-b from-amber-500 to-amber-400 rounded"></span>
                    Price Development Over {years} Year{years > 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-slate-500">Gold price projection from €{unitPrice.toFixed(0)} to €{futurePrice.toFixed(0)}</p>
                </div>

                {/* SVG Chart with line and bars */}
                <div className="relative h-48 md:h-56 bg-gradient-to-b from-amber-50/40 to-white rounded-xl p-4 border border-amber-100/50">
                  <svg viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                    <defs>
                      {/* Grid background */}
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" opacity="0.3"/>
                      </pattern>
                    </defs>

                    {/* Grid */}
                    <rect width="800" height="240" fill="url(#grid)" />

                    {/* Y-axis labels */}
                    <text x="35" y="15" fontSize="12" fill="#64748b" textAnchor="end" fontWeight="600">€{maxPrice.toFixed(0)}</text>
                    <text x="35" y="230" fontSize="12" fill="#64748b" textAnchor="end" fontWeight="600">€{minPrice.toFixed(0)}</text>

                    {/* Bars */}
                    {chartData.map((data, idx) => {
                      const barWidth = 800 / (chartData.length + 1);
                      const x = 50 + idx * barWidth;
                      const barHeight = ((data.price - minPrice) / priceRange) * 180;
                      const y = 220 - barHeight;
                      const percentChange = ((data.price - unitPrice) / unitPrice) * 100;

                      return (
                        <g key={`bar-${idx}`}>
                          {/* Bar with gradient */}
                          <defs>
                            <linearGradient id={`barGrad${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor={data.price >= unitPrice ? "#fbbf24" : "#fca5a5"} />
                              <stop offset="100%" stopColor={data.price >= unitPrice ? "#f59e0b" : "#f87171"} />
                            </linearGradient>
                          </defs>
                          <rect
                            x={x - barWidth / 2 + 15}
                            y={y}
                            width={barWidth - 20}
                            height={barHeight}
                            fill={`url(#barGrad${idx})`}
                            rx="4"
                            opacity="0.85"
                            className="hover:opacity-100 transition-all"
                          />

                          {/* Percentage label on top of bar */}
                          {barHeight > 30 && (
                            <text
                              x={x}
                              y={y - 8}
                              fontSize="11"
                              fill={data.price >= unitPrice ? "#d97706" : "#dc2626"}
                              textAnchor="middle"
                              fontWeight="700"
                            >
                              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
                            </text>
                          )}

                          {/* Price label */}
                          <text
                            x={x}
                            y={y - 20}
                            fontSize="10"
                            fill="#374151"
                            textAnchor="middle"
                            fontWeight="600"
                          >
                            €{data.price.toFixed(0)}
                          </text>

                          {/* Year label */}
                          <text
                            x={x}
                            y="235"
                            fontSize="11"
                            fill="#6b7280"
                            textAnchor="middle"
                            fontWeight="500"
                          >
                            {data.actualYear}
                          </text>
                        </g>
                      );
                    })}

                    {/* Trend line */}
                    <polyline
                      points={chartData.map((data, idx) => {
                        const barWidth = 800 / (chartData.length + 1);
                        const x = 50 + idx * barWidth;
                        const barHeight = ((data.price - minPrice) / priceRange) * 180;
                        const y = 220 - barHeight;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.6"
                    />
                  </svg>
                </div>

                {/* Chart Info */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-[0.65rem] text-slate-600 font-semibold uppercase">Start Price</p>
                    <p className="text-base font-bold text-blue-700 mt-1">€{unitPrice.toFixed(0)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-[0.65rem] text-slate-600 font-semibold uppercase">Target Price</p>
                    <p className="text-base font-bold text-amber-700 mt-1">€{futurePrice.toFixed(0)}</p>
                  </div>
                  <div className={`rounded-lg p-3 border ${result.gain >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-[0.65rem] text-slate-600 font-semibold uppercase">Total Increase</p>
                    <p className={`text-base font-bold mt-1 ${result.gainPercent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {result.gainPercent >= 0 ? '+' : ''}{result.gainPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Portfolio Value Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 hover:border-emerald-300 transition-all shadow-lg">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm md:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-emerald-400 rounded"></span>
                    Portfolio Value Growth Over {years} Year{years > 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-slate-500">Your €{amount.toFixed(0)} investment projected growth</p>
                </div>

                {/* SVG Chart with area and line */}
                <div className="relative h-48 md:h-56 bg-gradient-to-b from-emerald-50/40 to-white rounded-xl p-4 border border-emerald-100/50">
                  <svg viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
                    <defs>
                      {/* Grid background */}
                      <pattern id="gridValue" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" opacity="0.3"/>
                      </pattern>

                      {/* Area gradient - gain area */}
                      <linearGradient id="gainArea" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Grid */}
                    <rect width="800" height="240" fill="url(#gridValue)" />

                    {/* Y-axis labels */}
                    <text x="35" y="15" fontSize="12" fill="#64748b" textAnchor="end" fontWeight="600">€{safeMaxValue.toFixed(0)}</text>
                    <text x="35" y="100" fontSize="11" fill="#94a3b8" textAnchor="end" fontWeight="500">(Initial)</text>
                    <text x="35" y="230" fontSize="12" fill="#64748b" textAnchor="end" fontWeight="600">€0</text>

                    {/* Initial investment line */}
                    <line
                      x1="50"
                      y1={220 - (amount / safeMaxValue) * 180}
                      x2="750"
                      y2={220 - (amount / safeMaxValue) * 180}
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="5,5"
                      opacity="0.5"
                    />
                    <text x="760" y={220 - (amount / safeMaxValue) * 180 + 4} fontSize="10" fill="#3b82f6" fontWeight="600">
                      €{amount.toFixed(0)}
                    </text>

                    {/* Area under trend line (gain area) */}
                    {chartData.length > 1 && (
                      <polygon
                        points={[
                          `50,220`,
                          ...chartData.map((data, idx) => {
                            const barWidth = 800 / (chartData.length + 1);
                            const x = 50 + idx * barWidth;
                            const barHeight = (data.value / safeMaxValue) * 180;
                            const y = 220 - barHeight;
                            return `${x},${y}`;
                          }),
                          `${50 + (chartData.length - 1) * (800 / (chartData.length + 1))},220`
                        ].join(' ')}
                        fill="url(#gainArea)"
                      />
                    )}

                    {/* Bars */}
                    {chartData.map((data, idx) => {
                      const barWidth = 800 / (chartData.length + 1);
                      const x = 50 + idx * barWidth;
                      const barHeight = (data.value / safeMaxValue) * 180;
                      const y = 220 - barHeight;
                      const gainPercent = ((data.value - amount) / amount) * 100;

                      return (
                        <g key={`valuebar-${idx}`}>
                          {/* Bar with gradient */}
                          <defs>
                            <linearGradient id={`valueBarGrad${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                          </defs>
                          <rect
                            x={x - barWidth / 2 + 15}
                            y={y}
                            width={barWidth - 20}
                            height={barHeight}
                            fill={`url(#valueBarGrad${idx})`}
                            rx="4"
                            opacity="0.8"
                            className="hover:opacity-100 transition-all"
                          />

                          {/* Gain % label */}
                          {barHeight > 30 && gainPercent > 0 && (
                            <text
                              x={x}
                              y={y - 8}
                              fontSize="11"
                              fill="#059669"
                              textAnchor="middle"
                              fontWeight="700"
                            >
                              +{gainPercent.toFixed(1)}%
                            </text>
                          )}

                          {/* Value label */}
                          <text
                            x={x}
                            y={y - 20}
                            fontSize="10"
                            fill="#374151"
                            textAnchor="middle"
                            fontWeight="600"
                          >
                            €{data.value.toFixed(0)}
                          </text>

                          {/* Year label */}
                          <text
                            x={x}
                            y="235"
                            fontSize="11"
                            fill="#6b7280"
                            textAnchor="middle"
                            fontWeight="500"
                          >
                            {data.actualYear}
                          </text>
                        </g>
                      );
                    })}

                    {/* Trend line */}
                    <polyline
                      points={chartData.map((data, idx) => {
                        const barWidth = 800 / (chartData.length + 1);
                        const x = 50 + idx * barWidth;
                        const barHeight = (data.value / safeMaxValue) * 180;
                        const y = 220 - barHeight;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.8"
                    />
                  </svg>
                </div>

                {/* Chart Info */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-[0.65rem] text-slate-600 font-semibold uppercase">Initial</p>
                    <p className="text-base font-bold text-blue-700 mt-1">€{result.currentValue.toFixed(0)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <p className="text-[0.65rem] text-slate-600 font-semibold uppercase">Projected</p>
                    <p className="text-base font-bold text-emerald-700 mt-1">€{result.futureValue.toFixed(0)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-[0.65rem] text-slate-600 font-semibold uppercase">Total Gain</p>
                    <p className="text-base font-bold text-green-700 mt-1">+€{result.gain.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Investment Summary - Important Metrics */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm hover:border-slate-300 transition-all">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 mb-3 md:mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-gradient-to-b from-blue-600 to-blue-400 rounded"></span>
                  Investment Summary
                </h3>
                <div className="space-y-2.5 md:space-y-3">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                    <span className="text-[0.7rem] md:text-xs text-slate-600">{t('calculator.ouncesPurchased')}</span>
                    <span className="font-bold text-sm md:text-base text-slate-900">{result.ouncesBought.toFixed(4)} oz</span>
                  </div>
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                    <span className="text-[0.7rem] md:text-xs text-slate-600">Initial Investment</span>
                    <span className="font-bold text-sm md:text-base text-blue-600">{fmtCurrency(result.currentValue)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                    <span className="text-[0.7rem] md:text-xs text-slate-600">Target Price per oz</span>
                    <span className="font-bold text-sm md:text-base text-slate-900">{fmtCurrency(result.futurePrice)}</span>
                  </div>

                  {/* CAGR - Compound Annual Growth Rate */}
                  {years > 0 && (
                    <div className="flex justify-between items-center pt-2.5 border-t-2 border-blue-200 bg-blue-50 -mx-5 md:-mx-6 px-5 md:px-6 py-3 rounded-lg">
                      <span className="text-[0.7rem] md:text-xs text-slate-700 font-semibold uppercase">CAGR</span>
                      <span className="font-bold text-base md:text-lg text-blue-700">
                        {years > 0 ? (((Math.pow(result.futureValue / result.currentValue, 1 / years) - 1) * 100).toFixed(2)) : '0'}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Gain/Loss */}
              <div className={`border rounded-2xl p-5 md:p-6 shadow-sm transition-all hover:shadow-md ${
                result.gain >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 mb-3 md:mb-4 flex items-center gap-2">
                  <span className={`w-1 h-4 rounded ${result.gain >= 0 ? 'bg-gradient-to-b from-green-600 to-green-400' : 'bg-gradient-to-b from-red-600 to-red-400'}`}></span>
                  {t('calculator.gainLoss')}
                </h3>
                <div className="space-y-3.5 md:space-y-4">
                  <div>
                    <p className="text-[0.7rem] md:text-xs text-slate-600 mb-1.5 md:mb-2">Total Return</p>
                    <p className={`text-xl md:text-2xl font-bold ${
                      result.gain >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.gain >= 0 ? '+' : ''}{fmtCurrency(result.gain)}
                    </p>
                  </div>
                  <div className="pt-3 md:pt-4 border-t border-slate-200">
                    <p className="text-[0.7rem] md:text-xs text-slate-600 mb-1.5 md:mb-2">ROI</p>
                    <p className={`text-lg md:text-2xl font-bold ${
                      result.gainPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.gainPercent >= 0 ? '+' : ''}{result.gainPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="pt-3 md:pt-4 border-t border-slate-200">
                    <p className="text-[0.7rem] md:text-xs text-slate-600 mb-1.5 md:mb-2">Gain per Year</p>
                    <p className={`text-base md:text-lg font-bold ${
                      result.gain >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {years > 0 ? (result.gain >= 0 ? '+' : '') + fmtCurrency(result.gain / years) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200">
                <p className="text-[0.65rem] text-slate-600 font-semibold uppercase mb-1.5">Projected Value</p>
                <p className="text-sm md:text-base font-bold text-slate-900">{fmtCurrency(result.futureValue)}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-3 border border-emerald-200">
                <p className="text-[0.65rem] text-slate-600 font-semibold uppercase mb-1.5">Final Value</p>
                <p className="text-sm md:text-base font-bold text-emerald-700">{fmtCurrency(result.futureValue)}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
                <p className="text-[0.65rem] text-slate-600 font-semibold uppercase mb-1.5">Investment Period</p>
                <p className="text-sm md:text-base font-bold text-blue-700">{years} Year{years > 1 ? 's' : ''}</p>
              </div>
              <div className={`rounded-xl p-3 border transition-all ${
                result.gainPercent >= 0
                  ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                  : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
              }`}>
                <p className="text-[0.65rem] text-slate-600 font-semibold uppercase mb-1.5">Total ROI</p>
                <p className={`text-sm md:text-base font-bold ${
                  result.gainPercent >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>{result.gainPercent >= 0 ? '+' : ''}{result.gainPercent.toFixed(1)}%</p>
              </div>
            </div>

            {/* Warning Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
              <p className="text-xs text-slate-700">
                <span className="text-blue-600 font-semibold">ℹ️</span> {t('calculator.warningNote')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
