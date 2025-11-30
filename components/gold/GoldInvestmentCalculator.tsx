"use client";

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';

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

  // Chart data for visualization
  const chartData = useMemo(() => {
    const points = [];
    for (let i = 0; i <= years; i++) {
      const progress = years > 0 ? i / years : 0;
      const price = unitPrice + (futurePrice - unitPrice) * progress;
      const value = (amount / unitPrice) * price;
      points.push({ year: i, price, value });
    }
    return points;
  }, [amount, unitPrice, futurePrice, years]);

  // Max values for scaling charts
  const maxValue = Math.max(...chartData.map(d => d.value), result.futureValue);
  const minPrice = Math.min(unitPrice, futurePrice);
  const maxPrice = Math.max(unitPrice, futurePrice);

  return (
    <div className="w-full">
      <div className="space-y-6 md:space-y-8">

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
          {/* Input Controls */}
          <div className="lg:col-span-1 space-y-5 md:space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 md:space-y-6 hover:border-slate-300 transition-all shadow-sm">
              {/* Investment Amount */}
              <div className="space-y-2.5">
                <label className="block text-xs md:text-sm font-semibold text-slate-900">
                  {t('calculator.investmentAmount')}
                </label>
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
                <label className="block text-xs md:text-sm font-semibold text-slate-900">
                  {t('calculator.currentPrice')}
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 md:px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold text-sm md:text-base">€</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value) || 100)}
                    className="flex-1 bg-transparent text-slate-900 font-semibold text-sm md:text-base outline-none placeholder-slate-400"
                  />
                </div>
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
            </div>
          </div>

          {/* Charts & Results */}
          <div className="lg:col-span-2 space-y-5 md:space-y-6">
            {/* Price Development Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 hover:border-slate-300 transition-all shadow-sm">
              <h3 className="text-sm md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Price Development</h3>
              <div className="h-36 md:h-40 flex items-end justify-between gap-1.5 bg-slate-50 rounded-lg p-3 md:p-4">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center group"
                    title={`Year ${data.year}: €${data.price.toFixed(0)}`}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t opacity-75 hover:opacity-100 transition-all group-hover:shadow-lg group-hover:shadow-amber-500/40 cursor-pointer"
                      style={{
                        height: `${((data.price - minPrice) / (maxPrice - minPrice)) * 100}%`,
                        minHeight: '4px'
                      }}
                    />
                    {(idx === 0 || idx === chartData.length - 1) && (
                      <span className="text-[0.65rem] md:text-xs text-slate-600 mt-2">Year {data.year}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 md:mt-4 flex justify-between text-[0.65rem] md:text-xs text-slate-600">
                <span>€{minPrice.toFixed(0)}</span>
                <span className="text-amber-600 font-semibold">€{maxPrice.toFixed(0)}</span>
              </div>
            </div>

            {/* Portfolio Value Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 hover:border-slate-300 transition-all shadow-sm">
              <h3 className="text-sm md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">Portfolio Value Growth</h3>
              <div className="h-36 md:h-40 flex items-end justify-between gap-1.5 bg-slate-50 rounded-lg p-3 md:p-4">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center group relative"
                    title={`Year ${data.year}: €${data.value.toFixed(0)}`}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t opacity-75 hover:opacity-100 transition-all group-hover:shadow-lg group-hover:shadow-emerald-500/40 cursor-pointer"
                      style={{
                        height: `${(data.value / maxValue) * 100}%`,
                        minHeight: '4px'
                      }}
                    />
                    {(idx === 0 || idx === chartData.length - 1) && (
                      <span className="text-[0.65rem] md:text-xs text-slate-600 mt-2">Year {data.year}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 md:mt-4 flex justify-between text-[0.65rem] md:text-xs text-slate-600">
                <span>€{result.currentValue.toFixed(0)}</span>
                <span className="text-emerald-600 font-semibold">€{result.futureValue.toFixed(0)}</span>
              </div>
            </div>

            {/* Results Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Key Metrics */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm hover:border-slate-300 transition-all">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 mb-3 md:mb-4">Key Metrics</h3>
                <div className="space-y-2.5 md:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[0.7rem] md:text-xs text-slate-600">{t('calculator.ouncesPurchased')}</span>
                    <span className="font-bold text-sm md:text-base text-slate-900">{result.ouncesBought.toFixed(4)} oz</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[0.7rem] md:text-xs text-slate-600">{t('calculator.projectedPriceLabel')}</span>
                    <span className="font-bold text-sm md:text-base text-slate-900">{fmtCurrency(result.futurePrice)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <span className="text-xs md:text-sm font-semibold text-slate-900">{t('calculator.projectedValue')}</span>
                    <span className="text-lg md:text-xl font-bold text-blue-600">{fmtCurrency(result.futureValue)}</span>
                  </div>
                </div>
              </div>

              {/* Gain/Loss */}
              <div className={`border rounded-2xl p-5 md:p-6 shadow-sm transition-all hover:shadow-md ${
                result.gain >= 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 mb-3 md:mb-4">{t('calculator.gainLoss')}</h3>
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
                </div>
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
