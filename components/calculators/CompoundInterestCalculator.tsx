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

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                        {t('title')}
                    </h1>
                    <p className="text-gray-600 text-lg">Ihre Vermögensaufbau mit eleganten Schiebereglern</p>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Input Panel - Sliders */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 bg-white rounded-2xl shadow-lg p-8 border border-gray-200 backdrop-blur-sm bg-white/95">
                            <h2 className="text-2xl font-bold text-gray-900 mb-8">Einstellungen</h2>

                            <div className="space-y-8">
                                {/* Initial Capital Slider */}
                                <div className="group">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                            {t('initial_capital')}
                                        </label>
                                        <span className="text-2xl font-bold text-blue-600 font-mono">
                                            {formatCurrency(initialCapital).split(',')[0]}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="500000"
                                        step="1000"
                                        value={initialCapital}
                                        onChange={(e) => setInitialCapital(Number(e.target.value))}
                                        className="w-full h-3 bg-gradient-to-r from-blue-200 to-blue-400 rounded-full appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>€0</span>
                                        <span>€500k</span>
                                    </div>
                                </div>

                                {/* Monthly Contribution Slider */}
                                <div className="group">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                            {t('monthly_contribution')}
                                        </label>
                                        <span className="text-2xl font-bold text-green-600 font-mono">
                                            {formatCurrency(monthlyContribution).split(',')[0]}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10000"
                                        step="100"
                                        value={monthlyContribution}
                                        onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                        className="w-full h-3 bg-gradient-to-r from-green-200 to-green-400 rounded-full appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>€0</span>
                                        <span>€10k</span>
                                    </div>
                                </div>

                                {/* Annual Return Slider */}
                                <div className="group">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                            {t('annual_return')}
                                        </label>
                                        <span className="text-2xl font-bold text-purple-600 font-mono">
                                            {formatPercentage(annualReturnRate, 1)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="20"
                                        step="0.1"
                                        value={annualReturnRate}
                                        onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
                                        className="w-full h-3 bg-gradient-to-r from-purple-200 to-purple-400 rounded-full appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>0%</span>
                                        <span>20%</span>
                                    </div>
                                </div>

                                {/* Years Slider */}
                                <div className="group">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                            {t('years')}
                                        </label>
                                        <span className="text-2xl font-bold text-orange-600 font-mono">
                                            {years}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        step="1"
                                        value={years}
                                        onChange={(e) => setYears(Number(e.target.value))}
                                        className="w-full h-3 bg-gradient-to-r from-orange-200 to-orange-400 rounded-full appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>1 Jahr</span>
                                        <span>50 Jahre</span>
                                    </div>
                                </div>

                                {/* Inflation Slider */}
                                <div className="group">
                                    <div className="flex justify-between items-baseline mb-3">
                                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                            {t('inflation')}
                                        </label>
                                        <span className="text-2xl font-bold text-red-600 font-mono">
                                            {formatPercentage(inflationRate, 1)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="5"
                                        step="0.1"
                                        value={inflationRate}
                                        onChange={(e) => setInflationRate(Number(e.target.value))}
                                        className="w-full h-3 bg-gradient-to-r from-red-200 to-red-400 rounded-full appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span>0%</span>
                                        <span>5%</span>
                                    </div>
                                </div>

                                {/* Timing Toggle */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                                        {t('contribution_timing')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setContributionTiming("end")}
                                            className={`py-3 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${
                                                contributionTiming === "end"
                                                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                        >
                                            Ende
                                        </button>
                                        <button
                                            onClick={() => setContributionTiming("begin")}
                                            className={`py-3 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${
                                                contributionTiming === "begin"
                                                    ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg scale-105"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                        >
                                            Anfang
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Nominal Result */}
                            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                                    {t('result_nominal')}
                                </p>
                                <h3 className="text-3xl font-bold text-gray-900 font-mono mb-2">
                                    {formatCurrency(result.finalCapitalNominal).split(',')[0]}
                                </h3>
                                <p className="text-sm text-blue-600">
                                    Zins: {formatCurrency(result.totalInterest)}
                                </p>
                            </div>

                            {/* Real Result */}
                            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                                    {t('result_real')}
                                </p>
                                <h3 className="text-3xl font-bold text-gray-900 font-mono mb-2">
                                    {formatCurrency(result.finalCapitalReal).split(',')[0]}
                                </h3>
                                <p className="text-sm text-green-600">
                                    (mit {formatPercentage(inflationRate, 1)})
                                </p>
                            </div>

                            {/* Total Contributions */}
                            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                                    {t('total_contributions')}
                                </p>
                                <h3 className="text-3xl font-bold text-gray-900 font-mono mb-2">
                                    {formatCurrency(result.totalContributions).split(',')[0]}
                                </h3>
                                <p className="text-sm text-purple-600">
                                    ROI: {formatPercentage(result.interestAsPercentage, 1)}
                                </p>
                            </div>

                            {/* Effective Return */}
                            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                                    {t('effective_return')}
                                </p>
                                <h3 className="text-3xl font-bold text-gray-900 font-mono mb-2">
                                    {formatPercentage(result.effectiveAnnualReturn, 1)}
                                </h3>
                                <p className="text-sm text-orange-600">
                                    p.a. (CAGR)
                                </p>
                            </div>
                        </div>

                        {/* Yearly Breakdown Table */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50">
                                <h3 className="text-lg font-bold text-gray-900">Wachstum - Jahresübersicht</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-6 py-4 text-left font-semibold text-gray-900">Jahr</th>
                                            <th className="px-6 py-4 text-right font-semibold text-gray-900">Kapital (Nominal)</th>
                                            <th className="px-6 py-4 text-right font-semibold text-gray-900">Kapital (Real)</th>
                                            <th className="px-6 py-4 text-right font-semibold text-gray-900">Zinsertrag</th>
                                            <th className="px-6 py-4 text-right font-semibold text-gray-900">ROI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {breakdown.map((row) => (
                                            <tr key={row.year} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900">{row.year}</td>
                                                <td className="px-6 py-4 text-right text-gray-700 font-mono text-sm">
                                                    {formatCurrency(row.totalCapitalNominal)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-600 font-mono text-sm">
                                                    {formatCurrency(row.totalCapitalReal)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-blue-600 font-mono text-sm">
                                                    {formatCurrency(row.interestEarnedToDate)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-green-600">
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
            </div>

            <style>{`
                input[type="range"].slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    border: 2px solid currentColor;
                }

                input[type="range"].slider::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    border: 2px solid currentColor;
                }

                input[type="range"].slider::-webkit-slider-thumb:hover {
                    transform: scale(1.15);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }

                input[type="range"].slider::-moz-range-thumb:hover {
                    transform: scale(1.15);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
            `}</style>
        </div>
    );
};

export default CompoundInterestCalculator;

