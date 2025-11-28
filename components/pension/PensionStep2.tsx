"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  calculateTotalPension,
  formatCurrency,
  DEFAULT_SETTINGS,
  PensionSettings,
} from "@/utils/pension";

export interface PensionStep2Props {
  netIncome?: number;
  birthYear?: number;
  existingPrivateRente?: number;
  wunschrente?: number;
  onBack?: () => void;
}

/**
 * Simple annuity model to estimate how much monthly contribution can build up
 * to a target amount by retirement
 *
 * Formula: FV = PMT * [((1 + r)^n - 1) / r]
 * Where:
 * - FV = Future Value (target private pension)
 * - PMT = Monthly contribution
 * - r = Monthly interest rate
 * - n = Number of months
 */
function estimatePrivatePensionFromContribution(
  monthlyContribution: number,
  yearsUntilRetirement: number,
  annualReturnRate: number = 0.03 // 3% annual return
): number {
  if (yearsUntilRetirement <= 0) return 0;

  const monthlyRate = annualReturnRate / 12;
  const months = yearsUntilRetirement * 12;

  // Future value of annuity formula
  const fv = monthlyContribution * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;

  // Convert lump sum to monthly annuity (assume 4% withdrawal rate)
  return fv * 0.04 / 12;
}

const PensionStep2: React.FC<PensionStep2Props> = ({
  netIncome = 2500,
  birthYear = 1975,
  existingPrivateRente = 200,
  wunschrente = 3000,
  onBack,
}) => {
  const t = useTranslations("rentenrechner");

  // State
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [settings] = useState<PensionSettings>(DEFAULT_SETTINGS);

  // Compute age and years until retirement
  const currentAge = new Date().getFullYear() - birthYear;
  const yearsUntilRetirement = Math.max(0, settings.rentenbeginnAlter - currentAge);

  // Calculate pension results without additional contribution
  const basePensionResult = useMemo(() => {
    return calculateTotalPension(netIncome, birthYear, existingPrivateRente, settings, wunschrente);
  }, [netIncome, birthYear, existingPrivateRente, settings, wunschrente]);

  // Estimate additional private pension from monthly contribution
  const additionalPrivatePension = useMemo(() => {
    return estimatePrivatePensionFromContribution(monthlyContribution, yearsUntilRetirement);
  }, [monthlyContribution, yearsUntilRetirement]);

  // Total private pension after additional contribution
  const totalPrivatePension = existingPrivateRente + additionalPrivatePension;

  // Recalculate pension results with additional private pension
  const projectedPensionResult = useMemo(() => {
    return calculateTotalPension(netIncome, birthYear, totalPrivatePension, settings, wunschrente);
  }, [netIncome, birthYear, totalPrivatePension, settings, wunschrente]);

  // Calculate annual cost and cumulative investment
  const totalAnnualInvestment = monthlyContribution * 12;
  const totalCumulativeInvestment = monthlyContribution * 12 * yearsUntilRetirement;

  // Calculate gap reduction and percentage
  const gapReduction = basePensionResult.vorsorgeluecke - projectedPensionResult.vorsorgeluecke;
  const gapReductionPercent = basePensionResult.vorsorgeluecke > 0
    ? (gapReduction / basePensionResult.vorsorgeluecke) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {t('step2_title')}
            </span>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-blue-600">{yearsUntilRetirement}</span>
              <span className="font-medium">{t('step2_years')}</span>
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t('step2_title')}
          </h1>
        </div>

        {/* Main 3-Column Grid */}
        <div className="grid lg:grid-cols-3 gap-5 mb-6">
          {/* LEFT: Aktuelle Situation */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-400"></span>
              {t('step2_current')}
            </h3>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">{t('step2_statutory_pension_label')}</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(basePensionResult.gesetzlicheRenteNetto)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">{t('legend_private')}</p>
                <p className="text-lg font-bold text-cyan-600">
                  {formatCurrency(existingPrivateRente)}
                </p>
              </div>

              <div className={`rounded-lg p-3 ${
                basePensionResult.vorsorgeluecke > 0
                  ? "bg-orange-50 border border-orange-200"
                  : "bg-green-50 border border-green-200"
              }`}>
                <p className="text-xs text-gray-600 mb-1">{t('legend_gap')}</p>
                <p className={`text-lg font-bold ${
                  basePensionResult.vorsorgeluecke > 0
                    ? "text-orange-600"
                    : "text-green-600"
                }`}>
                  {formatCurrency(basePensionResult.vorsorgeluecke)}
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">{t('step2_total_invested')}</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(basePensionResult.gesamtRente)}
                </p>
              </div>
            </div>
          </div>

          {/* MIDDLE: Slider */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              {t('step2_monthly_contribution')}
            </h3>

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-600 mb-2">{t('step2_monthly_contribution')}</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(monthlyContribution)}
                  </p>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="25"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(parseInt(e.target.value))}
                  className="w-full h-3 bg-gradient-to-r from-blue-200 to-blue-400 rounded-lg accent-blue-600 mb-3"
                />

                <div className="flex justify-between text-xs text-gray-500 font-semibold">
                  <span>{formatCurrency(0)}</span>
                  <span>{formatCurrency(1000)}</span>
                </div>
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{t('step2_annually')}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalAnnualInvestment)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{yearsUntilRetirement}{t('step2_years')}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalCumulativeInvestment)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Projetkiert */}
          <div className="bg-gradient-to-br from-emerald-50 to-transparent rounded-2xl p-5 shadow-lg border border-emerald-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500"></span>
              {t('step2_with_savings')}
            </h3>

            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">{t('step2_statutory_pension_label')}</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(projectedPensionResult.gesetzlicheRenteNetto)}
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">{t('step2_private_pension_with_addition')}</p>
                <p className="text-lg font-bold text-cyan-600">
                  {formatCurrency(totalPrivatePension)}
                </p>
              </div>

              <div className={`rounded-lg p-3 ${
                projectedPensionResult.vorsorgeluecke > 0
                  ? "bg-orange-100 border border-orange-300"
                  : "bg-green-100 border border-green-300"
              }`}>
                <p className="text-xs text-gray-600 mb-1">{t('step2_remaining_gap')}</p>
                <p className={`text-lg font-bold ${
                  projectedPensionResult.vorsorgeluecke > 0
                    ? "text-orange-700"
                    : "text-green-700"
                }`}>
                  {formatCurrency(projectedPensionResult.vorsorgeluecke)}
                </p>
              </div>

              <div className="bg-emerald-100 rounded-lg p-3 border border-emerald-300">
                <p className="text-xs text-gray-600 mb-1">{t('step2_new_total_monthly')}</p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(projectedPensionResult.gesamtRente)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Impact Summary - Compact */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <p className="text-xs text-gray-600 mb-1">{t('step2_gap_closure_label')}</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(gapReduction)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{gapReductionPercent.toFixed(0)}{t('step2_of_gap')}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <p className="text-xs text-gray-600 mb-1">{t('step2_additional_pension_label')}</p>
            <p className="text-2xl font-bold text-cyan-600">
              {formatCurrency(additionalPrivatePension)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('step2_from_savings_plan')}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <p className="text-xs text-gray-600 mb-1">{t('step2_pension_increase_label')}</p>
            <p className="text-2xl font-bold text-blue-600">
              +{formatCurrency(projectedPensionResult.gesamtRente - basePensionResult.gesamtRente)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('step2_monthly_more_label')}</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-700">
            <span className="font-semibold text-blue-900">💡 Info:</span> Mit {formatCurrency(monthlyContribution)}/Monat sparen Sie {formatCurrency(totalCumulativeInvestment)} bis Rente ({yearsUntilRetirement} Jahre). Dies schließt {gapReductionPercent.toFixed(0)}% Ihrer Vorsorgelücke.
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-between items-center gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('step2_back_to_step1')}
          </button>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t('step2_done')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PensionStep2;

