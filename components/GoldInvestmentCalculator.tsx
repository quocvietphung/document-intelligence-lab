'use client';

import React, { useState, useMemo } from 'react';

interface CalculatorResult {
  currentValue: number;
  futurePrice: number;
  futureValue: number;
  gain: number;
  gainPercent: number;
}

export default function GoldInvestmentCalculator() {
  const [amount, setAmount] = useState<number>(1000);
  const [unitPrice, setUnitPrice] = useState<number>(2050);
  const [futurePrice, setFuturePrice] = useState<number>(2200);
  const [years, setYears] = useState<number>(1);

  const result: CalculatorResult = useMemo(() => {
    const currentValue = amount;
    const ouncesBought = amount / unitPrice;
    const projectedValue = ouncesBought * futurePrice;
    const gain = projectedValue - currentValue;
    const gainPercent = (gain / currentValue) * 100;

    return {
      currentValue,
      futurePrice,
      futureValue: projectedValue,
      gain,
      gainPercent,
    };
  }, [amount, unitPrice, futurePrice]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        💰 Gold Investment Calculator
      </h2>
      <p className="text-gray-600 mb-6">
        Estimate your potential returns based on price projections
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Investment Amount (USD)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">$</span>
              <input
                type="number"
                min="100"
                step="100"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <input
              type="range"
              min="100"
              max="100000"
              step="500"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>$100</span>
              <span>$100,000</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Current Gold Price (per oz)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">$</span>
              <input
                type="number"
                min="100"
                step="10"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Projected Price (per oz)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">$</span>
              <input
                type="number"
                min="100"
                step="10"
                value={futurePrice}
                onChange={(e) => setFuturePrice(Number(e.target.value) || 0)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <input
              type="range"
              min={unitPrice * 0.5}
              max={unitPrice * 2}
              step="10"
              value={futurePrice}
              onChange={(e) => setFuturePrice(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Investment Period: {years} year{years !== 1 ? 's' : ''}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 year</span>
              <span>10 years</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Projection Results</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-yellow-200">
              <span className="text-gray-600">Initial Investment</span>
              <span className="font-semibold text-gray-900">
                ${result.currentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-yellow-200">
              <span className="text-gray-600">Ounces Purchased</span>
              <span className="font-semibold text-gray-900">
                {(result.currentValue / result.futurePrice).toFixed(4)} oz
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-yellow-200">
              <span className="text-gray-600">Projected Price</span>
              <span className="font-semibold text-gray-900">
                ${result.futurePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b-2 border-yellow-400 bg-white rounded-lg px-3">
              <span className="text-gray-900 font-semibold">Projected Value</span>
              <span className="text-2xl font-bold text-yellow-600">
                ${result.futureValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className={`flex justify-between items-center py-3 rounded-lg px-3 font-semibold ${
              result.gain >= 0
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              <span>Gain/Loss ({years}y)</span>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {result.gain >= 0 ? '+' : ''}${result.gain.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm">
                  ({result.gainPercent >= 0 ? '+' : ''}{result.gainPercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 italic pt-4 border-t border-yellow-200">
            ⚠️ This calculator is for informational purposes only. Actual results may vary.
            Consult a financial advisor before investing.
          </p>
        </div>
      </div>
    </div>
  );
}

