'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface GoldPriceData {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  currency: string;
}

const OUNCE_TO_GRAM = 31.1034768;

export default function GoldPriceWidget() {
  const [goldData, setGoldData] = useState<GoldPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'VND'>('USD');
  const [unit, setUnit] = useState<'ounce' | 'gram'>('ounce');
  const [fxRate, setFxRate] = useState<number | null>(null); // USD -> VND
  const t = useTranslations('gold');

  useEffect(() => {
    fetchGoldPrice();
    fetchFxRate();
  }, []);

  useEffect(() => {
    // refresh fx rate occasionally
    const id = setInterval(fetchFxRate, 60 * 60 * 1000); // each hour
    return () => clearInterval(id);
  }, []);

  const fetchGoldPrice = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gold-price');
      if (!response.ok) throw new Error('Failed to fetch gold price');
      const data = await response.json();
      setGoldData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching gold price:', err);
      setError(t('priceWidget.error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFxRate = async () => {
    try {
      // public exchangerate.host API (no API key)
      const resp = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=VND');
      if (!resp.ok) return;
      const json = await resp.json();
      const rate = Number(json?.rates?.VND) || null;
      setFxRate(rate);
    } catch (err) {
      console.warn('Could not fetch FX rate', err);
      setFxRate(null);
    }
  };

  const formatPriceLocal = (priceUSD: number) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(priceUSD);
    }
    // VND
    const rate = fxRate ?? 0;
    const vnd = priceUSD * rate;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(vnd || 0);
  };

  const formatSmall = (value: number) => {
    return value.toFixed(2);
  };

  // Prefer server-provided history; otherwise fallback to small synthetic history
  const history = useMemo(() => {
    if (!goldData) return [] as number[];
    if (Array.isArray((goldData as any).history) && (goldData as any).history.length > 0) {
      return (goldData as any).history as number[];
    }

    const base = goldData.price || 0;
    const points = 24; // 24 points for 24h mini chart
    const arr: number[] = [];
    const trend = (goldData.change || 0) / Math.max(1, points);
    for (let i = points - 1; i >= 0; i--) {
      const noise = (Math.sin(i) * 0.5 + (Math.random() - 0.5)) * (base * 0.002);
      const value = Math.max(0.1, base - trend * i + noise);
      arr.push(Math.round(value * 100) / 100);
    }
    return arr;
  }, [goldData]);

  const renderSparkline = (points: number[]) => {
    if (!points || points.length === 0) return null;
    const w = 200;
    const h = 48;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = w / (points.length - 1);
    const d = points
      .map((p, i) => {
        const x = i * step;
        const y = h - ((p - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    const last = points[points.length - 1];
    const first = points[0];
    const positive = last >= first;
    const stroke = positive ? 'url(#g-plus)' : 'url(#g-minus)';

    return (
      <svg width={w} height={h} role="img" aria-label={t('priceWidget.chart')}>
        <defs>
          <linearGradient id="g-plus" x1="0" x2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="g-minus" x1="0" x2="1">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke={positive ? '#10b981' : '#ef4444'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* subtle area */}
        <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={positive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)'} />
      </svg>
    );
  };

  const formatChange = (change: number | null | undefined, changePercent: number | null | undefined) => {
    const rawChange = Number(change ?? 0);
    const safeChangePercent = Number(changePercent ?? 0);

    // adjust change according to selected unit: API returns change per ounce
    const changePerUnit = unit === 'ounce' ? rawChange : rawChange / OUNCE_TO_GRAM;

    // convert to VND if needed
    const displayAmount = currency === 'VND' && fxRate ? changePerUnit * fxRate : changePerUnit;

    const amountStr = currency === 'VND'
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(displayAmount)
      : `${displayAmount >= 0 ? '+' : ''}${displayAmount.toFixed(2)} ${currency}`;

    const sign = rawChange >= 0 ? '+' : '';
    return `${amountStr} (${sign}${safeChangePercent.toFixed(2)}%)`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6" role="status" aria-live="polite">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-1/2 mb-4"></div>
        </div>
      </div>
    );
  }

  if (error || !goldData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('priceWidget.error')}</h3>
          <p className="text-gray-600 mb-4">{error ?? t('priceWidget.error')}</p>
          <button onClick={fetchGoldPrice} className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">{t('priceWidget.retry')}</button>
        </div>
      </div>
    );
  }

  // compute displayed price based on unit and currency
  const baseUSD = goldData.price || 0; // per troy ounce USD
  const perUnitUSD = unit === 'ounce' ? baseUSD : baseUSD / OUNCE_TO_GRAM;
  const displayedPrice = currency === 'USD' ? perUnitUSD : (fxRate ? perUnitUSD * fxRate : perUnitUSD);

  const isPositive = (goldData.change ?? 0) >= 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('priceWidget.title')}</h3>
            <p className="text-sm text-gray-500">{t('priceWidget.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="sr-only">Currency</span>
            <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="rounded-md border-gray-200 text-sm px-2 py-1">
              <option value="USD">USD</option>
              <option value="VND">VND</option>
            </select>
          </label>

          <div className="inline-flex rounded-md bg-gray-100 p-1">
            <button onClick={() => setUnit('ounce')} aria-pressed={unit === 'ounce'} className={`px-3 py-1 text-sm font-medium ${unit === 'ounce' ? 'bg-white shadow rounded' : 'text-gray-600'}`}>
              oz
            </button>
            <button onClick={() => setUnit('gram')} aria-pressed={unit === 'gram'} className={`px-3 py-1 text-sm font-medium ${unit === 'gram' ? 'bg-white shadow rounded' : 'text-gray-600'}`}>
              g
            </button>
          </div>

          <button onClick={fetchGoldPrice} title={t('priceWidget.refresh')} className="p-2 text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div className="text-center md:text-left">
          <div className="text-3xl md:text-4xl font-bold text-gray-900">{formatPriceLocal(perUnitUSD)}</div>
          <div className="text-sm text-gray-500 mt-1">{unit === 'ounce' ? t('priceWidget.perOunce') : `per gram`}</div>

          <div className={`inline-block mt-3 px-3 py-1 rounded-full text-sm font-medium ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {formatChange(goldData.change, goldData.changePercent)}
          </div>

          <div className="text-xs text-gray-400 mt-2">{t('priceWidget.lastUpdated')}: {new Date(goldData.lastUpdated).toLocaleString()}</div>
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-2">{renderSparkline(history)}</div>
          <div className="text-xs text-gray-500">{t('priceWidget.chart')} • {t('priceWidget.last24h')}</div>
        </div>
      </div>
    </div>
  );
}
