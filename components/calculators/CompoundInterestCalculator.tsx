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

    // Notify parent of changes
    React.useEffect(() => {
        if (onResultChange) {
            onResultChange(result);
        }
    }, [result, onResultChange]);

    return (
        <div className="w-full">
            {/* Input Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
                <h2 className="text-2xl font-bold mb-6">{t('title')}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Initial Capital */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('initial_capital')} (€)
                        </label>
                        <input
                            type="number"
                            value={initialCapital}
                            onChange={(e) => setInitialCapital(Number(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Monthly Contribution */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('monthly_contribution')} (€)
                        </label>
                        <input
                            type="number"
                            value={monthlyContribution}
                            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Annual Return */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('annual_return')} (%)
                        </label>
                        <input
                            type="number"
                            step={0.1}
                            value={annualReturnRate}
                            onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Years */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('years')}
                        </label>
                        <input
                            type="number"
                            value={years}
                            onChange={(e) => setYears(Number(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Inflation Rate */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('inflation')} (%)
                        </label>
                        <input
                            type="number"
                            step={0.1}
                            value={inflationRate}
                            onChange={(e) => setInflationRate(Number(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Contribution Timing */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('contribution_timing')}
                        </label>
                        <select
                            value={contributionTiming}
                            onChange={(e) => setContributionTiming(e.target.value as "end" | "begin")}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="end">{t('timing_end')}</option>
                            <option value="begin">{t('timing_begin')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold mb-4">{t('result_nominal')}</h3>
                    <p className="text-3xl font-bold text-blue-600">
                        {formatCurrency(result.finalCapitalNominal)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('interest')}: {formatCurrency(result.totalInterest)}
                    </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold mb-4">{t('result_real')}</h3>
                    <p className="text-3xl font-bold text-green-600">
                        {formatCurrency(result.finalCapitalReal)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('adjusted_inflation')} {inflationRate}%
                    </p>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                    <h3 className="text-lg font-semibold mb-4">{t('total_contributions')}</h3>
                    <p className="text-3xl font-bold text-purple-600">
                        {formatCurrency(result.totalContributions)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('return_pct')}: {formatPercentage(result.interestAsPercentage)}
                    </p>
                </div>

                <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                    <h3 className="text-lg font-semibold mb-4">{t('effective_return')}</h3>
                    <p className="text-3xl font-bold text-orange-600">
                        {formatPercentage(result.effectiveAnnualReturn)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('cagr')}
                    </p>
                </div>
            </div>

            {/* Year-by-year Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">{t('yearly_breakdown')}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-100 border-b border-gray-300">
                                <th className="px-4 py-3 text-left font-semibold">{t('year')}</th>
                                <th className="px-4 py-3 text-right font-semibold">{t('capital_nominal')}</th>
                                <th className="px-4 py-3 text-right font-semibold">{t('capital_real')}</th>
                                <th className="px-4 py-3 text-right font-semibold">{t('interest_earned')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {breakdown.map((row) => (
                                <tr key={row.year} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-4 py-3">{row.year}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(row.totalCapitalNominal)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(row.totalCapitalReal)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(row.interestEarnedToDate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CompoundInterestCalculator;

