"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
    calculateCompoundInterest,
    generateYearlyBreakdown,
    formatCurrency,
    formatPercentage,
    CompoundInterestInputs,
    CompoundInterestResult,
    YearlyBreakdown,
} from "@/lib/calculators/compoundInterest";

interface CompoundInterestCalculatorProps {
    onResultChange?: (result: CompoundInterestResult) => void;
}

const CompoundInterestCalculator: React.FC<CompoundInterestCalculatorProps> = ({
    onResultChange,
}) => {
    const t = useTranslations("sparrechner");

    // Form state
    const [initialCapital, setInitialCapital] = useState<number>(10000);
    const [monthlyContribution, setMonthlyContribution] = useState<number>(500);
    const [annualReturnRate, setAnnualReturnRate] = useState<number>(6);
    const [years, setYears] = useState<number>(10);
    const [inflationRate, setInflationRate] = useState<number>(2);
    const [contributionTiming, setContributionTiming] = useState<"end" | "begin">("end");

    // Calculate results
    const inputs: CompoundInterestInputs = {
        initialCapital,
        monthlyContribution,
        annualReturnRate,
        years,
        inflationRate,
        contributionTiming,
    };

    const result = useMemo(() => {
        return calculateCompoundInterest(inputs);
    }, [inputs]);

    const breakdown: YearlyBreakdown[] = useMemo(() => {
        return generateYearlyBreakdown(inputs);
    }, [inputs]);

    React.useEffect(() => {
        if (onResultChange) {
            onResultChange(result);
        }
    }, [result, onResultChange]);

    const chartData = breakdown.slice(0, Math.min(breakdown.length, 12)).map((item) => ({
        year: item.year,
        capital: item.totalCapitalNominal,
    }));

    const maxCapital = Math.max(...chartData.map((d) => d.capital));

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-white via-blue-50 to-white py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('title')}</h1>
                    <p className="text-gray-600">Einfach und schnell berechnet</p>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-5">Ihre Parameter</h2>

                            <div className="space-y-5">
                                {/* Initial Capital */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('initial_capital')}
                                    </label>
                                    <input
                                        type="number"
                                        value={initialCapital}
                                        onChange={(e) => setInitialCapital(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formatCurrency(initialCapital)}</p>
                                </div>

                                {/* Monthly Contribution */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('monthly_contribution')}
                                    </label>
                                    <input
                                        type="number"
                                        value={monthlyContribution}
                                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formatCurrency(monthlyContribution)}/Monat</p>
                                </div>

                                {/* Annual Return */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('annual_return')}
                                    </label>
                                    <input
                                        type="number"
                                        step={0.1}
                                        value={annualReturnRate}
                                        onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formatPercentage(annualReturnRate)}</p>
                                </div>

                                {/* Years */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('years')}
                                    </label>
                                    <input
                                        type="number"
                                        value={years}
                                        onChange={(e) => setYears(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{years} Jahre</p>
                                </div>

                                {/* Inflation */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('inflation')}
                                    </label>
                                    <input
                                        type="number"
                                        step={0.1}
                                        value={inflationRate}
                                        onChange={(e) => setInflationRate(Number(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{formatPercentage(inflationRate)}</p>
                                </div>

                                {/* Timing Toggle */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        {t('contribution_timing')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setContributionTiming("end")}
                                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                                                contributionTiming === "end"
                                                    ? "bg-blue-500 text-white shadow-md"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                        >
                                            Nachschüssig
                                        </button>
                                        <button
                                            onClick={() => setContributionTiming("begin")}
                                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                                                contributionTiming === "begin"
                                                    ? "bg-blue-500 text-white shadow-md"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                        >
                                            Vorschüssig
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Panel */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Results Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Nominal */}
                            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">{t('result_nominal')}</p>
                                <h3 className="text-2xl font-bold text-gray-900 font-mono">
                                    {formatCurrency(result.finalCapitalNominal).split(',')[0]}
                                </h3>
                                <p className="text-xs text-gray-500 mt-2">
                                    Zinsertrag: {formatCurrency(result.totalInterest)}
                                </p>
                            </div>

                            {/* Real */}
                            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">{t('result_real')}</p>
                                <h3 className="text-2xl font-bold text-gray-900 font-mono">
                                    {formatCurrency(result.finalCapitalReal).split(',')[0]}
                                </h3>
                                <p className="text-xs text-gray-500 mt-2">
                                    (mit {formatPercentage(inflationRate)})
                                </p>
                            </div>

                            {/* Contributions */}
                            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-purple-500">
                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">{t('total_contributions')}</p>
                                <h3 className="text-2xl font-bold text-gray-900 font-mono">
                                    {formatCurrency(result.totalContributions).split(',')[0]}
                                </h3>
                                <p className="text-xs text-gray-500 mt-2">
                                    ROI: {formatPercentage(result.interestAsPercentage, 1)}
                                </p>
                            </div>

                            {/* Effective Return */}
                            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-orange-500">
                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">{t('effective_return')}</p>
                                <h3 className="text-2xl font-bold text-gray-900 font-mono">
                                    {formatPercentage(result.effectiveAnnualReturn)}
                                </h3>
                                <p className="text-xs text-gray-500 mt-2">
                                    p.a. (CAGR)
                                </p>
                            </div>
                        </div>

                        {/* Simple Chart */}
                        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Wachstum</h3>
                            <div className="flex items-end justify-between h-40 gap-1">
                                {chartData.map((item, idx) => {
                                    const heightPercent = Math.round((item.capital / maxCapital) * 100 * 100) / 100;
                                    return (
                                    <div
                                        key={idx}
                                        className="flex-1 flex flex-col items-center group"
                                        title={`Jahr ${item.year}: ${formatCurrency(item.capital)}`}
                                    >
                                        <div
                                            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative group/tooltip"
                                            style={{
                                                height: `${Math.max(heightPercent, 2)}%`,
                                            }}
                                        >
                                            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                                {formatCurrency(item.capital)}
                                            </div>
                                        </div>
                                        {idx % Math.max(Math.ceil(chartData.length / 4), 1) === 0 && (
                                            <p className="text-xs text-gray-500 mt-2">{item.year}</p>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simple Table - Only show every other year for compact view */}
                <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">{t('yearly_breakdown')}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left font-semibold text-gray-900">Jahr</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-900">Kapital</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-900">Zinsertrag</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-900">ROI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {breakdown
                                    .filter((_, idx) => idx % Math.max(Math.ceil(breakdown.length / 10), 1) === 0)
                                    .map((row) => (
                                        <tr key={row.year} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900">{row.year}</td>
                                            <td className="px-4 py-3 text-right text-gray-700 font-mono">
                                                {formatCurrency(row.totalCapitalNominal)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-600 font-mono">
                                                {formatCurrency(row.interestEarnedToDate)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                {row.contributionsToDate > 0
                                                    ? formatPercentage((row.interestEarnedToDate / row.contributionsToDate) * 100, 1)
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompoundInterestCalculator;

