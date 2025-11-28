"use client";

import React, { useState, useMemo } from "react";
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
  // State
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [settings] = useState<PensionSettings>(DEFAULT_SETTINGS);

  // ...existing code...

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
  const totalMonthlyInvestment = monthlyContribution;
  const totalAnnualInvestment = monthlyContribution * 12;
  const totalCumulativeInvestment = monthlyContribution * 12 * yearsUntilRetirement;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Schritt 2: Zusätzliche private Vorsorge planen
        </h1>
        <p className="text-gray-600">
          Berechnen Sie, wie viel Sie monatlich sparen müssen, um Ihre Vorsorgelücke zu schließen.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left: Current Situation */}
        <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Aktuelle Situation</h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-600">Nettoeinkommen (monatlich)</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(netIncome)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-600">Gesetzliche Rente (netto)</p>
              <p className="text-xl font-bold text-emerald-700">
                {formatCurrency(basePensionResult.gesetzlicheRenteNetto)}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-600">Angesparte private Rente</p>
              <p className="text-xl font-bold text-cyan-700">
                {formatCurrency(existingPrivateRente)}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-300">
              <p className="text-xs text-gray-600 mb-1">Vorsorgelücke</p>
              <p
                className={`text-xl font-bold ${
                  basePensionResult.vorsorgeluecke > 0
                    ? "text-orange-700"
                    : "text-green-700"
                }`}
              >
                {formatCurrency(basePensionResult.vorsorgeluecke)}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-300">
              <p className="text-xs text-gray-600 mb-1">Gesamtrente</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(basePensionResult.gesamtRente)}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Projected Situation */}
        <div className="p-6 bg-green-50 rounded-lg border border-green-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Mit zusätzlicher Vorsorge</h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-600">Monatliche zusätzliche Sparbeitrag</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(monthlyContribution)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-600">Gesetzliche Rente (netto) [unverändert]</p>
              <p className="text-xl font-bold text-emerald-700">
                {formatCurrency(projectedPensionResult.gesetzlicheRenteNetto)}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-600">Geschätzte private Rente (inkl. Zusatz)</p>
              <p className="text-xl font-bold text-cyan-700">
                {formatCurrency(totalPrivatePension)}
              </p>
            </div>

            <div className="pt-2 border-t border-green-300">
              <p className="text-xs text-gray-600 mb-1">Verbleibende Vorsorgelücke</p>
              <p
                className={`text-xl font-bold ${
                  projectedPensionResult.vorsorgeluecke > 0
                    ? "text-orange-700"
                    : "text-green-700"
                }`}
              >
                {formatCurrency(projectedPensionResult.vorsorgeluecke)}
              </p>
            </div>

            <div className="pt-2 border-t border-green-300">
              <p className="text-xs text-gray-600 mb-1">Geschätzte Gesamtrente</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(projectedPensionResult.gesamtRente)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contribution Slider */}
      <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Monatlicher Sparbeitrag: {formatCurrency(monthlyContribution)}
        </h3>

        <input
          type="range"
          min="0"
          max="1000"
          step="50"
          value={monthlyContribution}
          onChange={(e) => setMonthlyContribution(parseInt(e.target.value))}
          className="w-full mb-4"
        />

        <div className="flex justify-between text-sm text-gray-600">
          <span>{formatCurrency(0)} / Monat</span>
          <span>{formatCurrency(1000)} / Monat</span>
        </div>
      </div>

      {/* Investment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs text-gray-600 mb-1">Monatlicher Sparbeitrag</p>
          <p className="text-2xl font-bold text-purple-700">
            {formatCurrency(totalMonthlyInvestment)}
          </p>
        </div>

        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <p className="text-xs text-gray-600 mb-1">Jährliche Sparleistung</p>
          <p className="text-2xl font-bold text-indigo-700">
            {formatCurrency(totalAnnualInvestment)}
          </p>
        </div>

        <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
          <p className="text-xs text-gray-600 mb-1">
            Kumulative Investition <br />
            ({yearsUntilRetirement} Jahre)
          </p>
          <p className="text-2xl font-bold text-pink-700">
            {formatCurrency(totalCumulativeInvestment)}
          </p>
        </div>
      </div>

      {/* Impact Analysis */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Auswirkungsanalyse</h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Schließung der Vorsorgelücke</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(
                basePensionResult.vorsorgeluecke - projectedPensionResult.vorsorgeluecke
              )}
            </span>
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Verbleibende Vorsorgelücke</span>
            <span
              className={`font-bold ${
                projectedPensionResult.vorsorgeluecke > 0
                  ? "text-orange-700"
                  : "text-green-700"
              }`}
            >
              {formatCurrency(projectedPensionResult.vorsorgeluecke)}
            </span>
          </div>

          <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
            <span className="text-gray-700 font-semibold">Neue Gesamtrente monatlich</span>
            <span className="text-lg font-bold text-green-700">
              {formatCurrency(projectedPensionResult.gesamtRente)}
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-xs text-gray-700">
          <span className="font-semibold">Hinweis:</span> Dies ist eine vereinfachte Schätzung
          basierend auf durchschnittlichen Annahmen. Die tatsächliche Rendite kann variieren.
          Konsultieren Sie einen Finanzberater für eine persönliche Analyse.
        </p>
      </div>

      {/* Back Button */}
      {onBack && (
        <div className="mt-8 flex justify-start">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition shadow-md hover:shadow-lg"
          >
            ← Zurück zu Schritt 1
          </button>
        </div>
      )}
    </div>
  );
};

export default PensionStep2;

