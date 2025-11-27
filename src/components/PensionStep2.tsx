"use client";

import React, { useState, useMemo } from "react";
import {
  calculateTotalPension,
  formatCurrency,
  formatNumber,
  getAge,
  DEFAULT_SETTINGS,
  PensionSettings,
  type PensionCalculationResult,
} from "@/src/utils/pension";

interface PensionStep2Props {
  initialNetIncome?: number;
  initialPrivateRente?: number;
  initialBirthYear?: number;
  initialWunschrente?: number;
  maxIncome?: number;
  maxRente?: number;
}

export default function PensionStep2({
  initialNetIncome = 2500,
  initialPrivateRente = 200,
  initialBirthYear = 1975,
  initialWunschrente = 3000,
  maxIncome = 7000,
  maxRente = 5000,
}: PensionStep2Props) {
  // Input state - fixed values from step 1
  const netIncome = initialNetIncome;
  const birthYear = initialBirthYear;
  const initialTotalPrivateRente = initialPrivateRente;
  const wunschrente = initialWunschrente;
  const [settings] = useState<PensionSettings>(DEFAULT_SETTINGS);
  const [additionalMonthlyContribution, setAdditionalMonthlyContribution] = useState(100);

  // Age calculation
  const currentAge = getAge(birthYear);
  const yearsUntilRetirement = Math.max(0, settings.rentenbeginnAlter - currentAge);

  // Calculate current pension gap
  const currentCalculation: PensionCalculationResult = useMemo(() => {
    return calculateTotalPension(netIncome, birthYear, initialTotalPrivateRente, settings, wunschrente);
  }, [netIncome, birthYear, initialTotalPrivateRente, settings, wunschrente]);

  // Simplified annuity calculation
  // Assumes: contribution grows with salary growth, invested at 3% real return, annuitized at 4% withdrawal rate
  const calculateAnnuity = (monthlyContribution: number): number => {
    const yearlyContribution = monthlyContribution * 12;
    const annualReturn = 0.03; // 3% real return
    const withdrawalRate = 0.04; // 4% withdrawal rate in retirement

    // Future value of annuity over years until retirement
    let futureValue = 0;
    let currentContribution = yearlyContribution;

    for (let i = 0; i < yearsUntilRetirement; i++) {
      futureValue = (futureValue + currentContribution) * (1 + annualReturn);
      currentContribution *= 1 + settings.gehaltssteigerung / 100;
    }

    // Convert to monthly retirement income (simplified)
    const monthlyRetirementIncome = (futureValue * withdrawalRate) / 12;
    return monthlyRetirementIncome;
  };

  const additionalRetirementIncome = calculateAnnuity(additionalMonthlyContribution);
  const totalFuturePrivateRente = initialTotalPrivateRente + additionalRetirementIncome;

  // Recalculate with new private pension
  const projectedCalculation: PensionCalculationResult = useMemo(() => {
    return calculateTotalPension(netIncome, birthYear, totalFuturePrivateRente, settings, wunschrente);
  }, [netIncome, birthYear, totalFuturePrivateRente, settings, wunschrente]);

  // Calculate percentages for bar segments
  const incomePercentage = (netIncome / maxIncome) * 100;
  const gesetzlichePercentage = Math.min((projectedCalculation.gesetzlicheRenteNetto / maxRente) * 100, 100);
  const privatePercentage = Math.min(
    ((projectedCalculation.gesetzlicheRenteNetto + projectedCalculation.privateRente) / maxRente) * 100,
    100
  );
  const gesamtPercentage = Math.min((projectedCalculation.gesamtRente / maxRente) * 100, 100);
  const pensionGapPercentage = Math.max(0, Math.min((projectedCalculation.vorsorgeluecke / maxRente) * 100, 100 - gesamtPercentage));

  const gapClosed = Math.max(0, currentCalculation.vorsorgeluecke - projectedCalculation.vorsorgeluecke);
  const gapClosedPercentage = (gapClosed / currentCalculation.vorsorgeluecke) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Schritt 2: Zusätzliche private Vorsorge</h1>
            <p className="text-slate-600">Schließen Sie Ihre Vorsorgelücke durch regelmäßige Einzahlungen</p>
          </div>
          <div className="mt-4 md:mt-0 text-right space-y-1">
            <div className="text-sm font-semibold text-slate-700">
              Alter: <span className="text-blue-600">{currentAge} Jahre</span>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              Rentenbeginn in{" "}
              <span className="text-blue-600">
                {yearsUntilRetirement} Jahren (mit Rentenalter {settings.rentenbeginnAlter})
              </span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          {/* Current vs Projected Comparison */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Vorsorgelücke schließen</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Current Situation */}
              <div className="border-2 border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Heute (ohne zusätzliche Vorsorge)</h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gesetzliche Rente:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(currentCalculation.gesetzlicheRenteNetto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Private Rente:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(currentCalculation.privateRente)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gesamtrente:</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(currentCalculation.gesamtRente)}</span>
                  </div>
                  <div className="flex justify-between bg-red-50 p-3 rounded">
                    <span className="text-slate-600">Vorsorgelücke:</span>
                    <span className="text-lg font-bold text-red-600">{formatCurrency(currentCalculation.vorsorgeluecke)}</span>
                  </div>
                </div>
              </div>

              {/* Projected Situation */}
              <div className="border-2 border-emerald-200 rounded-lg p-6 bg-emerald-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Prognose (mit zusätzlicher Vorsorge)</h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gesetzliche Rente:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(projectedCalculation.gesetzlicheRenteNetto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Private Rente{" "}
                      <span className="text-xs text-slate-500">
                        ({formatCurrency(initialTotalPrivateRente)} + {formatCurrency(additionalRetirementIncome)})
                      </span>
                      :
                    </span>
                    <span className="font-semibold text-slate-900">{formatCurrency(projectedCalculation.privateRente)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gesamtrente:</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(projectedCalculation.gesamtRente)}</span>
                  </div>
                  <div
                    className={`flex justify-between p-3 rounded ${
                      projectedCalculation.vorsorgeluecke > 0 ? "bg-orange-50" : "bg-green-50"
                    }`}
                  >
                    <span className="text-slate-600">Verbleibende Lücke:</span>
                    <span
                      className={`text-lg font-bold ${
                        projectedCalculation.vorsorgeluecke > 0 ? "text-orange-600" : "text-green-600"
                      }`}
                    >
                      {formatCurrency(projectedCalculation.vorsorgeluecke)}
                    </span>
                  </div>
                </div>

                {/* Gap Closed Indicator */}
                {gapClosed > 0 && (
                  <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded text-sm">
                    <div className="font-semibold text-green-800">
                      Vorsorgelücke um {formatCurrency(gapClosed)} reduziert ({formatNumber(gapClosedPercentage, 1)}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visualization */}
          <div className="flex gap-12 mb-12 justify-center">
            {/* Income Bar */}
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Nettoeinkommen heute</h3>
              </div>
              <div className="relative w-24 h-80 bg-slate-100 rounded-lg border-2 border-slate-300 overflow-hidden">
                {/* Income fill */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400"
                  style={{ height: `${incomePercentage}%` }}
                />
                {/* Income value label inside bar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow-md">{formatCurrency(netIncome)}</div>
                    <div className="text-xs font-medium text-white drop-shadow-sm">pro Monat</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pension Bar (Stacked) */}
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Rente bei Rentenbeginn</h3>
                <p className="text-xs text-slate-500 text-center">Wunschrente: {formatCurrency(wunschrente)}</p>
              </div>
              <div className="relative w-24 h-80 bg-slate-100 rounded-lg border-2 border-slate-300 overflow-hidden">
                {/* Statutory pension segment (green) */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-75"
                  style={{ height: `${gesetzlichePercentage}%` }}
                  title={`Gesetzliche Rente: ${formatCurrency(projectedCalculation.gesetzlicheRenteNetto)}`}
                />

                {/* Private pension segment (teal) */}
                {projectedCalculation.privateRente > 0 && (
                  <div
                    className="absolute left-0 right-0 bg-gradient-to-t from-teal-500 to-teal-400 transition-all duration-75"
                    style={{
                      bottom: `${gesetzlichePercentage}%`,
                      height: `${privatePercentage - gesetzlichePercentage}%`,
                    }}
                    title={`Private Rente: ${formatCurrency(projectedCalculation.privateRente)}`}
                  />
                )}

                {/* Pension gap segment (orange/red) */}
                {projectedCalculation.vorsorgeluecke > 0 && (
                  <div
                    className="absolute left-0 right-0 bg-gradient-to-t from-orange-400 to-orange-300 transition-all duration-75"
                    style={{
                      bottom: `${gesamtPercentage}%`,
                      height: `${pensionGapPercentage}%`,
                    }}
                    title={`Vorsorgelücke: ${formatCurrency(projectedCalculation.vorsorgeluecke)}`}
                  />
                )}

                {/* Total pension value label inside bar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow-md">{formatCurrency(projectedCalculation.gesamtRente)}</div>
                    <div className="text-xs font-medium text-white drop-shadow-sm">gesamt</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contribution Slider */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Zusätzliche monatliche Vorsorge</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Slider */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-slate-700">Monatsbeitrag</label>
                  <div className="text-3xl font-bold text-emerald-600">{formatCurrency(additionalMonthlyContribution)}</div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  value={additionalMonthlyContribution}
                  onChange={(e) => setAdditionalMonthlyContribution(Number(e.target.value))}
                  className="w-full h-3 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>0 €</span>
                  <span>1.000 €</span>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-slate-700">
                  <p className="font-semibold mb-2">Diese monatliche Einzahlung wird angenommen:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Jährliche Wertentwicklung: 3%</li>
                    <li>• Gehaltssteigerung: {formatNumber(settings.gehaltssteigerung, 1)}% p.a.</li>
                    <li>• Rentenbeginn in {yearsUntilRetirement} Jahren</li>
                    <li>• Entnommen mit 4% Entnahmerate</li>
                  </ul>
                </div>
              </div>

              {/* Impact Summary */}
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Zusätzliche Rente/Monat</div>
                  <div className="text-2xl font-bold text-emerald-600">{formatCurrency(additionalRetirementIncome)}</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Gesamte private Rente</div>
                  <div className="text-2xl font-bold text-teal-600">{formatCurrency(totalFuturePrivateRente)}</div>
                </div>

                <div
                  className={`p-4 rounded-lg border ${
                    projectedCalculation.vorsorgeluecke <= 0
                      ? "bg-green-50 border-green-200"
                      : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-600 mb-1">Verbleibende Lücke</div>
                  <div
                    className={`text-2xl font-bold ${
                      projectedCalculation.vorsorgeluecke <= 0 ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {formatCurrency(projectedCalculation.vorsorgeluecke)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {projectedCalculation.vorsorgeluecke <= 0 && (
            <div className="mt-8 p-6 bg-green-50 border-2 border-green-300 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="text-3xl">✓</div>
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-2">Ziel erreicht!</h3>
                  <p className="text-green-700">
                    Mit einem monatlichen Beitrag von <strong>{formatCurrency(additionalMonthlyContribution)}</strong> können Sie
                    Ihre gewünschte Rentenhöhe von <strong>{formatCurrency(wunschrente)}</strong> erreichen.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

