"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  calculateTotalPension,
  formatCurrency,
  formatNumber,
  DEFAULT_SETTINGS,
  PensionSettings,
} from "@/utils/pension";

export interface PensionStep1Props {
  initialNetIncome?: number;
  initialPrivateRente?: number;
  initialBirthYear?: number;
  initialWunschrente?: number;
  maxIncome?: number;
  maxRente?: number;
  onDataChange?: (data: {
    netIncome?: number;
    privateRente?: number;
    birthYear?: number;
    wunschrente?: number;
  }) => void;
  onStepComplete?: () => void;
}

const PensionStep1: React.FC<PensionStep1Props> = ({
  initialNetIncome = 2500,
  initialPrivateRente = 200,
  initialBirthYear = 1975,
  initialWunschrente = 3000,
  maxIncome = 5000,
  maxRente = 5000,
  onDataChange,
  onStepComplete,
}) => {
  // State for main inputs
  const [netIncome, setNetIncome] = useState(initialNetIncome);
  const [privateRente, setPrivateRente] = useState(initialPrivateRente);
  const [birthYear, setBirthYear] = useState(initialBirthYear);
  const [wunschrente, setWunschrente] = useState(initialWunschrente);

  // State for settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PensionSettings>(DEFAULT_SETTINGS);

  // Notify parent when state changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        netIncome,
        privateRente,
        birthYear,
        wunschrente,
      });
    }
  }, [netIncome, privateRente, birthYear, wunschrente, onDataChange]);

  // Calculate pension results
  const pensionResult = useMemo(() => {
    return calculateTotalPension(netIncome, birthYear, privateRente, settings, wunschrente);
  }, [netIncome, birthYear, privateRente, settings, wunschrente]);

  // Compute age and years until retirement
  const currentAge = new Date().getFullYear() - birthYear;
  const yearsUntilRetirement = Math.max(0, settings.rentenbeginnAlter - currentAge);

  // ...existing code...

  // Refs for sliders
  const incomeBarRef = useRef<HTMLInputElement>(null);
  const pensionBarRef = useRef<HTMLInputElement>(null);


  // Income bar percentage for donut
  const incomePercentage = (netIncome / maxIncome) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                  SCHRITT 1/2
                </span>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Alter:</span>
                  <span className="font-bold text-blue-600">{currentAge}</span>
                  <span className="mx-1">•</span>
                  <span className="font-medium">Rentenbeginn:</span>
                  <span className="font-bold text-gray-900">{yearsUntilRetirement} Jahren</span>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Ihre Rente <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">visualisieren</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Main Compact Chart Section */}
        <div className="grid lg:grid-cols-12 gap-4 mb-6">
          {/* Left: Donut Chart - Compact */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 h-full">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Einkommen</h3>
              <p className="text-xs text-gray-600 mb-3">Monatlich netto</p>

              {/* Compact Donut */}
              <div className="relative h-32 mb-3">
                <svg className="w-full h-full" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="url(#blueGradient)"
                    strokeWidth="12"
                    strokeDasharray={`${(incomePercentage / 100) * 314} 314`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                    transform="rotate(-90 60 60)"
                  />
                  <defs>
                    <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xl font-bold text-blue-600">{incomePercentage.toFixed(0)}%</p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Netto</span>
                  <span className="font-bold text-blue-600">{formatCurrency(netIncome)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Brutto ~</span>
                  <span className="font-bold text-gray-700">{formatCurrency(netIncome * 3)}</span>
                </div>
              </div>

              <input
                ref={incomeBarRef}
                type="range"
                min="0"
                max={maxIncome}
                step="100"
                value={netIncome}
                onChange={(e) => setNetIncome(parseInt(e.target.value))}
                className="w-full h-2 bg-gradient-to-r from-blue-200 to-blue-400 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Middle: Horizontal Bars - Compact */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 h-full">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Rentenübersicht</h3>
              <p className="text-xs text-gray-600 mb-3">Mit {settings.rentenbeginnAlter} Jahren</p>

              <div className="space-y-4">
                {/* Bar 1: Current */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">Aktuell</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(pensionResult.gesamtRente)}</span>
                  </div>
                  <div className="flex h-8 rounded-full overflow-hidden shadow-sm border border-gray-200">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 transition-all flex items-center justify-center"
                      style={{ width: `${(pensionResult.gesetzlicheRenteNetto / pensionResult.gesamtRente) * 100}%` }}
                    >
                      {(pensionResult.gesetzlicheRenteNetto / pensionResult.gesamtRente) * 100 > 20 && (
                        <span className="text-white text-xs font-bold">{((pensionResult.gesetzlicheRenteNetto / pensionResult.gesamtRente) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    {pensionResult.privateRente > 0 && (
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 transition-all flex items-center justify-center"
                        style={{ width: `${(pensionResult.privateRente / pensionResult.gesamtRente) * 100}%` }}
                      >
                        {(pensionResult.privateRente / pensionResult.gesamtRente) * 100 > 20 && (
                          <span className="text-white text-xs font-bold">{((pensionResult.privateRente / pensionResult.gesamtRente) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bar 2: Target */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">Wunschrente</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(wunschrente)}</span>
                  </div>
                  <div className="flex h-8 rounded-full overflow-hidden shadow-sm border border-gray-200">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 transition-all flex items-center justify-center"
                      style={{ width: `${(pensionResult.gesetzlicheRenteNetto / wunschrente) * 100}%` }}
                    >
                      {(pensionResult.gesetzlicheRenteNetto / wunschrente) * 100 > 15 && (
                        <span className="text-white text-xs font-bold">{((pensionResult.gesetzlicheRenteNetto / wunschrente) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    {pensionResult.privateRente > 0 && (
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 transition-all flex items-center justify-center"
                        style={{ width: `${(pensionResult.privateRente / wunschrente) * 100}%` }}
                      >
                        {(pensionResult.privateRente / wunschrente) * 100 > 15 && (
                          <span className="text-white text-xs font-bold">{((pensionResult.privateRente / wunschrente) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                    {pensionResult.vorsorgeluecke > 0 && (
                      <div
                        className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 transition-all flex items-center justify-center"
                        style={{ width: `${(pensionResult.vorsorgeluecke / wunschrente) * 100}%` }}
                      >
                        {(pensionResult.vorsorgeluecke / wunschrente) * 100 > 15 && (
                          <span className="text-white text-xs font-bold">{((pensionResult.vorsorgeluecke / wunschrente) * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Compact Legend */}
              <div className="flex gap-3 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-600">Gesetzlich</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full"></div>
                  <span className="text-gray-600">Privat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
                  <span className="text-gray-600">Lücke</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <input
                  ref={pensionBarRef}
                  type="range"
                  min="0"
                  max={maxRente}
                  step="100"
                  value={wunschrente}
                  onChange={(e) => setWunschrente(parseInt(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-emerald-200 to-emerald-400 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right: Compact Stats Cards */}
          <div className="lg:col-span-3">
            <div className="space-y-2 h-full flex flex-col">
              {/* Statutory */}
              <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-3 border border-emerald-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-emerald-700 font-bold">GESETZLICH</p>
                  <div className="w-6 h-6 bg-emerald-500 rounded-lg"></div>
                </div>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(pensionResult.gesetzlicheRenteNetto)}</p>
                <p className="text-xs text-emerald-600">monatlich</p>
              </div>

              {/* Private */}
              <div className="bg-gradient-to-br from-cyan-50 to-white rounded-xl p-3 border border-cyan-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-cyan-700 font-bold">PRIVAT</p>
                  <div className="w-6 h-6 bg-cyan-500 rounded-lg"></div>
                </div>
                <p className="text-xl font-bold text-cyan-700">{formatCurrency(pensionResult.privateRente)}</p>
                <p className="text-xs text-cyan-600">monatlich</p>
              </div>

              {/* Gap/Success */}
              <div className={`rounded-xl p-3 border shadow-sm ${
                pensionResult.vorsorgeluecke > 0
                  ? "bg-gradient-to-br from-orange-50 to-white border-orange-100"
                  : "bg-gradient-to-br from-green-50 to-white border-green-100"
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-xs font-bold ${pensionResult.vorsorgeluecke > 0 ? "text-orange-700" : "text-green-700"}`}>
                    {pensionResult.vorsorgeluecke > 0 ? "LÜCKE" : "✓ ZIEL"}
                  </p>
                  <div className={`w-6 h-6 rounded-lg ${pensionResult.vorsorgeluecke > 0 ? "bg-orange-500" : "bg-green-500"}`}></div>
                </div>
                <p className={`text-xl font-bold ${pensionResult.vorsorgeluecke > 0 ? "text-orange-700" : "text-green-700"}`}>
                  {formatCurrency(pensionResult.vorsorgeluecke)}
                </p>
                <p className={`text-xs ${pensionResult.vorsorgeluecke > 0 ? "text-orange-600" : "text-green-600"}`}>
                  {pensionResult.vorsorgeluecke > 0 ? "erforderlich" : "erreicht"}
                </p>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-3 shadow-lg text-white flex-1 flex flex-col justify-center">
                <p className="text-xs font-semibold opacity-90 mb-1">GESAMTRENTE</p>
                <p className="text-2xl font-bold">{formatCurrency(pensionResult.gesamtRente)}</p>
              </div>
            </div>
          </div>
        </div>


        {/* Sliders Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Birth Year Slider */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <label className="block text-lg font-bold text-gray-900">Geburtsjahr</label>
              <div className="text-3xl font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl">
                {birthYear}
              </div>
            </div>
            <input
              type="range"
              min="1940"
              max="2005"
              step="1"
              value={birthYear}
              onChange={(e) => setBirthYear(parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-blue-200 to-blue-400 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-4 font-semibold">
              <span>1940</span>
              <span>2005</span>
            </div>
          </div>

          {/* Private Pension Slider */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <label className="block text-lg font-bold text-gray-900">Private Rente</label>
              <div className="text-3xl font-bold text-cyan-600 bg-cyan-50 px-4 py-2 rounded-xl">
                {formatCurrency(privateRente)}
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={privateRente}
              onChange={(e) => setPrivateRente(parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-cyan-200 to-cyan-400 rounded-lg appearance-none cursor-pointer accent-cyan-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-4 font-semibold">
              <span>{formatCurrency(0)}</span>
              <span>{formatCurrency(1000)}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-12">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Renten-Komponenten</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-4 h-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Gesetzliche Rente</p>
                <p className="text-sm text-gray-600">Staatliche Rentenversicherung basierend auf Entgeltpunkten</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-4 h-4 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Private Rente</p>
                <p className="text-sm text-gray-600">Angesparte private Altersvorsorge und Zusatzversicherungen</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Vorsorgelücke</p>
                <p className="text-sm text-gray-600">Unterschied zwischen Wunsch und Deckung</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Button */}
        <div className="flex justify-between items-center mb-12">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-gray-300 hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.26 2.37 1.806a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.26 3.31-1.806 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.26-2.37-1.806a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.26-3.31 1.806-2.37a1.724 1.724 0 002.572-1.065z" />
            </svg>
            Erweiterte Einstellungen
          </button>

          <button
            onClick={onStepComplete}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-xl transition-all transform hover:scale-105"
          >
            Weiter zu Schritt 2
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={"M13 7l5 5m0 0l-5 5m5-5H6"} />
            </svg>
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-2xl font-bold mb-8 text-gray-900">Erweiterte Einstellungen</h3>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Anspruch auf Rente */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.anspruchRente}
                    onChange={(e) =>
                      setSettings({ ...settings, anspruchRente: e.target.checked })
                    }
                    className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
                  />
                  <span className="text-gray-900 font-semibold group-hover:text-blue-600 transition">
                    Anspruch auf gesetzliche Rente
                  </span>
                </label>
              </div>

              {/* Bundesland */}
              <div className="space-y-3">
                <p className="font-semibold text-gray-900 mb-3">Bundesland</p>
                <div className="flex gap-4">
                  {(["west", "east"] as const).map((region) => (
                    <label key={region} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bundesland"
                        checked={settings.bundesland === region}
                        onChange={() => setSettings({ ...settings, bundesland: region })}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-gray-700 font-medium">{region === "west" ? "West" : "Ost"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Inflation */}
              <div>
                <label className="block font-semibold text-gray-900 mb-3">
                  Inflation: <span className="text-blue-600">{formatNumber(settings.inflation, 1)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={settings.inflation}
                  onChange={(e) =>
                    setSettings({ ...settings, inflation: parseFloat(e.target.value) })
                  }
                  className="w-full h-2 bg-blue-200 rounded-lg accent-blue-600"
                />
              </div>

              {/* Gehaltssteigerung */}
              <div>
                <label className="block font-semibold text-gray-900 mb-3">
                  Gehaltssteigerung: <span className="text-blue-600">{formatNumber(settings.gehaltssteigerung, 1)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={settings.gehaltssteigerung}
                  onChange={(e) =>
                    setSettings({ ...settings, gehaltssteigerung: parseFloat(e.target.value) })
                  }
                  className="w-full h-2 bg-blue-200 rounded-lg accent-blue-600"
                />
              </div>

              {/* Entgeltpunkte */}
              <div>
                <label className="block font-semibold text-gray-900 mb-3">
                  Entgeltpunkte heute: <span className="text-blue-600">{formatNumber(settings.entgeltpunkteHeute, 1)}</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.entgeltpunkteHeute}
                  onChange={(e) =>
                    setSettings({ ...settings, entgeltpunkteHeute: parseFloat(e.target.value) })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Rentenbeginn Alter */}
              <div>
                <label className="block font-semibold text-gray-900 mb-3">
                  Rentenbeginnsalter: <span className="text-blue-600">{settings.rentenbeginnAlter}</span>
                </label>
                <input
                  type="range"
                  min="60"
                  max="75"
                  step="1"
                  value={settings.rentenbeginnAlter}
                  onChange={(e) =>
                    setSettings({ ...settings, rentenbeginnAlter: parseInt(e.target.value) })
                  }
                  className="w-full h-2 bg-blue-200 rounded-lg accent-blue-600"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PensionStep1;

