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
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
            {t('calculator.title')}
          </h2>
          <p className="text-slate-600">{t('calculator.description')}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Input Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 hover:border-slate-300 transition-all shadow-sm">
              {/* Investment Amount */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900">
                  {t('calculator.investmentAmount')}
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold">€</span>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 100)}
                    className="flex-1 bg-transparent text-slate-900 font-semibold outline-none placeholder-slate-400"
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
                <div className="flex justify-between text-xs text-slate-600">
                  <span>€100</span>
                  <span>€100,000</span>
                </div>
              </div>

              {/* Current Price */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900">
                  {t('calculator.currentPrice')}
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold">€</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value) || 100)}
                    className="flex-1 bg-transparent text-slate-900 font-semibold outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Projected Price */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900">
                  {t('calculator.projectedPrice')}
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200 hover:border-blue-300 transition-all">
                  <span className="text-slate-600 font-bold">€</span>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={futurePrice}
                    onChange={(e) => setFuturePrice(Number(e.target.value) || 100)}
                    className="flex-1 bg-transparent text-slate-900 font-semibold outline-none placeholder-slate-400"
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
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-900">
                  {t('calculator.investmentPeriod')}: <span className="text-blue-600 text-lg">{years}</span> {years > 1 ? t('calculator.years') : t('calculator.year')}
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
                <div className="flex justify-between text-xs text-slate-600">
                  <span>1</span>
                  <span>30 years</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts & Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Development Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-slate-300 transition-all shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Price Development</h3>
              <div className="h-40 flex items-end justify-between gap-1 bg-slate-50 rounded-lg p-4">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center group"
                    title={`Year ${data.year}: €${data.price.toFixed(0)}`}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-500 rounded-t opacity-75 hover:opacity-100 transition-all group-hover:shadow-lg group-hover:shadow-blue-600/30 cursor-pointer"
                      style={{
                        height: `${((data.price - minPrice) / (maxPrice - minPrice)) * 100}%`,
                        minHeight: '4px'
                      }}
                    />
                    {(idx === 0 || idx === chartData.length - 1) && (
                      <span className="text-xs text-slate-600 mt-2">Year {data.year}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs text-slate-600">
                <span>€{minPrice.toFixed(0)}</span>
                <span className="text-blue-600 font-semibold">€{maxPrice.toFixed(0)}</span>
              </div>
            </div>

            {/* Portfolio Value Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-slate-300 transition-all shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Portfolio Value Growth</h3>
              <div className="h-40 flex items-end justify-between gap-1 bg-slate-50 rounded-lg p-4">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center group relative"
                    title={`Year ${data.year}: €${data.value.toFixed(0)}`}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-green-600 to-green-500 rounded-t opacity-75 hover:opacity-100 transition-all group-hover:shadow-lg group-hover:shadow-green-600/30 cursor-pointer"
                      style={{
                        height: `${(data.value / maxValue) * 100}%`,
                        minHeight: '4px'
                      }}
                    />
                    {(idx === 0 || idx === chartData.length - 1) && (
                      <span className="text-xs text-slate-600 mt-2">Year {data.year}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs text-slate-600">
                <span>€{result.currentValue.toFixed(0)}</span>
                <span className="text-green-600 font-semibold">€{result.futureValue.toFixed(0)}</span>
              </div>
            </div>

            {/* Results Summary */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Key Metrics */}
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Key Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">{t('calculator.ouncesPurchased')}</span>
                    <span className="font-bold text-blue-600">{result.ouncesBought.toFixed(4)} oz</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">{t('calculator.projectedPriceLabel')}</span>
                    <span className="font-bold text-blue-600">{fmtCurrency(result.futurePrice)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <span className="text-slate-900 font-semibold">{t('calculator.projectedValue')}</span>
                    <span className="text-2xl font-bold text-blue-600">{fmtCurrency(result.futureValue)}</span>
                  </div>
                </div>
              </div>

              {/* Gain/Loss */}
              <div className={`border rounded-2xl p-6 shadow-sm transition-all ${
                result.gain >= 0
                  ? 'bg-gradient-to-br from-green-50 to-slate-50 border-green-100'
                  : 'bg-gradient-to-br from-red-50 to-slate-50 border-red-100'
              }`}>
                <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('calculator.gainLoss')}</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-slate-600 text-sm mb-2">Total Return</p>
                    <p className={`text-3xl font-bold ${
                      result.gain >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.gain >= 0 ? '+' : ''}{fmtCurrency(result.gain)}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-slate-600 text-sm mb-2">ROI</p>
                    <p className={`text-2xl font-bold ${
                      result.gainPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.gainPercent >= 0 ? '+' : ''}{result.gainPercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
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
