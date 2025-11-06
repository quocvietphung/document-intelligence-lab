'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface GoldPriceData {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  currency: string;
}

export default function GoldPriceWidget() {
  const [goldData, setGoldData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('gold');

  useEffect(() => {
    fetchGoldPrice();
  }, []);

  const fetchGoldPrice = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gold-price');
      if (!response.ok) {
        throw new Error('Failed to fetch gold price');
      }
      const data = await response.json();
      setGoldData(data);
      setError(null);
    } catch (err) {
      setError('Unable to load gold price data');
      console.error('Error fetching gold price:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change: number, changePercent: number) => {
    // Handle null/undefined values
    const safeChange = change ?? 0;
    const safeChangePercent = changePercent ?? 0;

    const isPositive = safeChange >= 0;
    const sign = isPositive ? '+' : '';
    return `${sign}${safeChange.toFixed(2)} (${sign}${safeChangePercent.toFixed(2)}%)`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error || !goldData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('priceWidget.error')}
          </h3>
          <p className="text-gray-600 mb-4">
            {error || 'Unable to load gold price data'}
          </p>
          <button
            onClick={fetchGoldPrice}
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            {t('priceWidget.retry')}
          </button>
        </div>
      </div>
    );
  }

  const isPositive = goldData.change >= 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('priceWidget.title')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('priceWidget.subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={fetchGoldPrice}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title={t('priceWidget.refresh')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Current Price */}
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {formatPrice(goldData.price)}
          </div>
          <div className="text-sm text-gray-600 mb-4">
            {t('priceWidget.perOunce')}
          </div>
          <div className={`text-lg font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {formatChange(goldData.change, goldData.changePercent)}
          </div>
        </div>

        {/* Price Chart Placeholder */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-700">
              {t('priceWidget.chart')}
            </span>
            <span className="text-xs text-gray-500">
              {t('priceWidget.last24h')}
            </span>
          </div>
          <div className="h-24 flex items-end justify-between">
            {/* Mock chart bars */}
            {[0.3, 0.5, 0.4, 0.7, 0.6, 0.8, 0.9, 1].map((height, index) => (
              <div
                key={index}
                className={`w-4 bg-gradient-to-t ${isPositive ? 'from-green-400 to-green-600' : 'from-red-400 to-red-600'} rounded-t`}
                style={{ height: `${height * 100}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 text-center">
          {t('priceWidget.lastUpdated')}: {new Date(goldData.lastUpdated).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
