"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  calculateTotalPension,
  formatCurrency,
  formatNumber,
  getAge,
  DEFAULT_SETTINGS,
  PensionSettings,
  type PensionCalculationResult,
} from "@/src/utils/pension";

interface PensionStep1Props {
  initialNetIncome?: number;
  initialPrivateRente?: number;
  initialBirthYear?: number;
  initialWunschrente?: number;
  maxIncome?: number;
  maxRente?: number;
}

export default function PensionStep1({
  initialNetIncome = 2500,
  initialPrivateRente = 200,
  initialBirthYear = 1975,
  initialWunschrente = 3000,
  maxIncome = 7000,
  maxRente = 5000,
}: PensionStep1Props) {
  // Input state
  const [netIncome, setNetIncome] = useState(initialNetIncome);
  const [birthYear, setBirthYear] = useState(initialBirthYear);
  const [privateRente, setPrivateRente] = useState(initialPrivateRente);
  const [wunschrente, setWunschrente] = useState(initialWunschrente);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PensionSettings>(DEFAULT_SETTINGS);

  // Calculated values
  const calculation: PensionCalculationResult = useMemo(() => {
    return calculateTotalPension(netIncome, birthYear, privateRente, settings, wunschrente);
  }, [netIncome, birthYear, privateRente, settings, wunschrente]);

  // Age calculation
  const currentAge = getAge(birthYear);
  const yearsUntilRetirement = Math.max(0, settings.rentenbeginnAlter - currentAge);

  // Refs for drag handlers
  const incomeBarRef = useRef<HTMLDivElement>(null);
  const pensionBarRef = useRef<HTMLDivElement>(null);
  const incomeHandleRef = useRef<HTMLDivElement>(null);
  const pensionHandleRef = useRef<HTMLDivElement>(null);

  // Handle income bar drag (vertical, but we'll make it intuitive for adjusting value)
  const handleIncomeDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!incomeBarRef.current) return;

      const rect = incomeBarRef.current.getBoundingClientRect();
      const maxX = rect.width;
      const relativeX = e.clientX - rect.left;
      const percentage = Math.min(Math.max(relativeX / maxX, 0), 1);
      setNetIncome(Math.round(percentage * maxIncome));
    },
    [maxIncome]
  );

  const handleIncomeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleIncomeDrag(e);

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!incomeBarRef.current) return;
      const rect = incomeBarRef.current.getBoundingClientRect();
      const relativeX = moveE.clientX - rect.left;
      const percentage = Math.min(Math.max(relativeX / rect.width, 0), 1);
      setNetIncome(Math.round(percentage * maxIncome));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle pension bar drag (horizontal for wunschrente)
  const handlePensionDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!pensionBarRef.current) return;

      const rect = pensionBarRef.current.getBoundingClientRect();
      const maxX = rect.width;
      const relativeX = e.clientX - rect.left;
      const percentage = Math.min(Math.max(relativeX / maxX, 0), 1);
      setWunschrente(Math.round(percentage * maxRente));
    },
    [maxRente]
  );

  const handlePensionMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handlePensionDrag(e);

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!pensionBarRef.current) return;
      const rect = pensionBarRef.current.getBoundingClientRect();
      const relativeX = moveE.clientX - rect.left;
      const percentage = Math.min(Math.max(relativeX / rect.width, 0), 1);
      setWunschrente(Math.round(percentage * maxRente));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Calculate percentages for bar segments
  const incomePercentage = (netIncome / maxIncome) * 100;
  const gesetzlichePercentage = Math.min((calculation.gesetzlicheRenteNetto / maxRente) * 100, 100);
  const privatePercentage = Math.min(((calculation.gesetzlicheRenteNetto + calculation.privateRente) / maxRente) * 100, 100);
  const gesamtPercentage = Math.min((calculation.gesamtRente / maxRente) * 100, 100);

  const pensionGapPercentage = Math.max(0, Math.min((calculation.vorsorgeluecke / maxRente) * 100, 100 - gesamtPercentage));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Schritt 1: Berechnen Sie Ihre monatliche Rente</h1>
            <p className="text-slate-600">Gesetzliche Rente + Private Altersvorsorge</p>
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
          {/* Bars Container */}
          <div className="flex gap-12 mb-12 justify-center">
            {/* Income Bar */}
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Nettoeinkommen heute</h3>
              </div>
              <div
                ref={incomeBarRef}
                onClick={handleIncomeDrag}
                className="relative w-24 h-80 bg-slate-100 rounded-lg cursor-pointer border-2 border-slate-300 overflow-hidden group hover:border-slate-400 transition-colors"
              >
                {/* Income fill */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-75"
                  style={{ height: `${incomePercentage}%` }}
                />

                {/* Income value label inside bar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow-md">{formatCurrency(netIncome)}</div>
                    <div className="text-xs font-medium text-white drop-shadow-sm">pro Monat</div>
                  </div>
                </div>

                {/* Handle at top */}
                <div
                  ref={incomeHandleRef}
                  onMouseDown={handleIncomeMouseDown}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full shadow-md border-2 border-blue-400 cursor-grab active:cursor-grabbing flex items-center justify-center hover:shadow-lg transition-shadow group-hover:border-blue-500"
                >
                  <span className="text-blue-500 text-xl font-bold">⇕</span>
                </div>
              </div>

              {/* Range slider for income */}
              <div className="mt-6 w-48">
                <input
                  type="range"
                  min="0"
                  max={maxIncome}
                  value={netIncome}
                  onChange={(e) => setNetIncome(Number(e.target.value))}
                  className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0 €</span>
                  <span>{formatCurrency(maxIncome)}</span>
                </div>
              </div>
            </div>

            {/* Pension Bar (Stacked) */}
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Rente bei Rentenbeginn</h3>
                <p className="text-xs text-slate-500 text-center">Wunschrente: {formatCurrency(wunschrente)}</p>
              </div>
              <div
                ref={pensionBarRef}
                onClick={handlePensionDrag}
                className="relative w-24 h-80 bg-slate-100 rounded-lg cursor-pointer border-2 border-slate-300 overflow-hidden group hover:border-slate-400 transition-colors"
              >
                {/* Statutory pension segment (green) */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-75"
                  style={{ height: `${gesetzlichePercentage}%` }}
                  title={`Gesetzliche Rente: ${formatCurrency(calculation.gesetzlicheRenteNetto)}`}
                />

                {/* Private pension segment (teal) */}
                {calculation.privateRente > 0 && (
                  <div
                    className="absolute left-0 right-0 bg-gradient-to-t from-teal-500 to-teal-400 transition-all duration-75"
                    style={{
                      bottom: `${gesetzlichePercentage}%`,
                      height: `${privatePercentage - gesetzlichePercentage}%`,
                    }}
                    title={`Private Rente: ${formatCurrency(calculation.privateRente)}`}
                  />
                )}

                {/* Pension gap segment (orange/red) */}
                {calculation.vorsorgeluecke > 0 && (
                  <div
                    className="absolute left-0 right-0 bg-gradient-to-t from-orange-400 to-orange-300 transition-all duration-75"
                    style={{
                      bottom: `${gesamtPercentage}%`,
                      height: `${pensionGapPercentage}%`,
                    }}
                    title={`Vorsorgelücke: ${formatCurrency(calculation.vorsorgeluecke)}`}
                  />
                )}

                {/* Total pension value label inside bar */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white drop-shadow-md">{formatCurrency(calculation.gesamtRente)}</div>
                    <div className="text-xs font-medium text-white drop-shadow-sm">gesamt</div>
                  </div>
                </div>

                {/* Handle at top */}
                <div
                  ref={pensionHandleRef}
                  onMouseDown={handlePensionMouseDown}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full shadow-md border-2 border-emerald-400 cursor-grab active:cursor-grabbing flex items-center justify-center hover:shadow-lg transition-shadow group-hover:border-emerald-500"
                >
                  <span className="text-emerald-500 text-xl font-bold">↔</span>
                </div>
              </div>

              {/* Range slider for wunschrente */}
              <div className="mt-6 w-48">
                <input
                  type="range"
                  min="0"
                  max={maxRente}
                  value={wunschrente}
                  onChange={(e) => setWunschrente(Number(e.target.value))}
                  className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0 €</span>
                  <span>{formatCurrency(maxRente)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Row */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-600 mb-1">Gesetzliche Rente (netto)</div>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(calculation.gesetzlicheRenteNetto)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-600 mb-1">Private Rente</div>
                <div className="text-2xl font-bold text-teal-600">{formatCurrency(calculation.privateRente)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-600 mb-1">Vorsorgelücke</div>
                <div
                  className={`text-2xl font-bold ${calculation.vorsorgeluecke > 0 ? "text-orange-600" : "text-green-600"}`}
                >
                  {formatCurrency(calculation.vorsorgeluecke)}
                </div>
              </div>
            </div>
          </div>

          {/* Settings & Input Sliders */}
          <div className="space-y-6">
            {/* Birth Year Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Geburtsjahr</label>
                <span className="text-lg font-bold text-slate-900">{birthYear}</span>
              </div>
              <input
                type="range"
                min="1940"
                max="2005"
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1940</span>
                <span>2005</span>
              </div>
            </div>

            {/* Private Rente Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Monatliche private Rente (existierend)</label>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(privateRente)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={privateRente}
                onChange={(e) => setPrivateRente(Number(e.target.value))}
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0 €</span>
                <span>2.000 €</span>
              </div>
            </div>

            {/* Settings Button */}
            <div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                {showSettings ? "Einstellungen ausblenden" : "⚙ Einstellungen"}
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-8 p-6 bg-slate-50 rounded-lg border-2 border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Erweiterte Einstellungen</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Anspruch auf Rente */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.anspruchRente}
                        onChange={(e) => setSettings({ ...settings, anspruchRente: e.target.checked })}
                        className="w-5 h-5 accent-blue-500 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-700">Anspruch auf gesetzliche Rente</span>
                    </label>
                  </div>

                  {/* Bundesland */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Bundesland / Region</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bundesland"
                          value="west"
                          checked={settings.bundesland === "west"}
                          onChange={() => setSettings({ ...settings, bundesland: "west" })}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-slate-700">West</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bundesland"
                          value="east"
                          checked={settings.bundesland === "east"}
                          onChange={() => setSettings({ ...settings, bundesland: "east" })}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-slate-700">Ost</span>
                      </label>
                    </div>
                  </div>

                  {/* Entgeltpunkte heute */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Entgeltpunkte (heute): <span className="text-blue-600">{formatNumber(settings.entgeltpunkteHeute, 1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={settings.entgeltpunkteHeute}
                      onChange={(e) => setSettings({ ...settings, entgeltpunkteHeute: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-slate-700"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Inflation */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Inflation (% p.a.): <span className="text-blue-600">{formatNumber(settings.inflation, 1)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={settings.inflation}
                      onChange={(e) => setSettings({ ...settings, inflation: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-slate-700"
                    />
                  </div>

                  {/* Gehaltssteigerung */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Gehaltssteigerung (% p.a.): <span className="text-blue-600">{formatNumber(settings.gehaltssteigerung, 1)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={settings.gehaltssteigerung}
                      onChange={(e) => setSettings({ ...settings, gehaltssteigerung: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-slate-700"
                    />
                  </div>

                  {/* Rentenbeginn Alter */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Rentenbeginn Alter: <span className="text-blue-600">{settings.rentenbeginnAlter}</span>
                    </label>
                    <input
                      type="range"
                      min="60"
                      max="75"
                      step="1"
                      value={settings.rentenbeginnAlter}
                      onChange={(e) => setSettings({ ...settings, rentenbeginnAlter: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-slate-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

