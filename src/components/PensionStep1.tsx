"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  calculateTotalPension,
  formatCurrency,
  formatNumber,
  DEFAULT_SETTINGS,
  PensionSettings,
} from "@/src/utils/pension";

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

  // Refs for drag handling
  const incomeBarRef = useRef<HTMLDivElement>(null);
  const pensionBarRef = useRef<HTMLDivElement>(null);
  const incomeHandleRef = useRef<HTMLDivElement>(null);
  const pensionHandleRef = useRef<HTMLDivElement>(null);

  // Drag handling for income bar (vertical bar, dragged horizontally via handle)
  const handleIncomeMouseDown = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!incomeBarRef.current) return;
      const rect = incomeBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      setNetIncome(Math.round(percentage * maxIncome));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [maxIncome]);

  // Drag handling for pension bar (changes wunschrente)
  const handlePensionMouseDown = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pensionBarRef.current) return;
      const rect = pensionBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      setWunschrente(Math.round(percentage * maxRente));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [maxRente]);

  // Click on income bar to set income
  const handleIncomeBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!incomeBarRef.current) return;
      const rect = incomeBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      setNetIncome(Math.round(percentage * maxIncome));
    },
    [maxIncome]
  );

  // Click on pension bar to set wunschrente
  const handlePensionBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pensionBarRef.current) return;
      const rect = pensionBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      setWunschrente(Math.round(percentage * maxRente));
    },
    [maxRente]
  );

  // Calculate bar segments for pension bar
  const barHeight = 300; // CSS height
  const gesetzlicheHeight = (pensionResult.gesetzlicheRenteNetto / wunschrente) * 100;
  const privateHeight = (pensionResult.privateRente / wunschrente) * 100;
  const vorsorgelueckeHeight = (pensionResult.vorsorgeluecke / wunschrente) * 100;

  // Income bar percentage
  const incomePercentage = (netIncome / maxIncome) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Schritt 1: Berechnen Sie Ihre monatliche Rente
          </h1>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p className="mb-1">
            <span className="font-semibold">Alter:</span> {currentAge} Jahre
          </p>
          <p>
            <span className="font-semibold">Rentenbeginn in</span> {yearsUntilRetirement} Jahren
            <br />
            <span className="text-xs">(mit Rentenalter {settings.rentenbeginnAlter})</span>
          </p>
        </div>
      </div>

      {/* Settings Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition"
        >
          {showSettings ? "Einstellungen verbergen" : "Einstellungen"}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold mb-4 text-gray-900">Einstellungen</h3>

          {/* Anspruch auf Rente */}
          <div className="mb-4 flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.anspruchRente}
                onChange={(e) =>
                  setSettings({ ...settings, anspruchRente: e.target.checked })
                }
                className="w-4 h-4 rounded"
              />
              <span className="ml-3 text-sm text-gray-700 font-semibold">
                Anspruch auf gesetzliche Rente
              </span>
            </label>
          </div>

          {/* Bundesland */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bundesland
            </label>
            <div className="flex gap-4">
              {(["west", "east"] as const).map((region) => (
                <label key={region} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="bundesland"
                    checked={settings.bundesland === region}
                    onChange={() => setSettings({ ...settings, bundesland: region })}
                    className="w-4 h-4"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {region === "west" ? "West" : "Ost"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Inflation */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Inflation: {formatNumber(settings.inflation, 1)} %
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
              className="w-full"
            />
          </div>

          {/* Gehaltssteigerung */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gehaltssteigerung: {formatNumber(settings.gehaltssteigerung, 1)} %
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
              className="w-full"
            />
          </div>

          {/* Entgeltpunkte */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Entgeltpunkte heute: {formatNumber(settings.entgeltpunkteHeute, 1)}
            </label>
            <input
              type="number"
              step="0.5"
              value={settings.entgeltpunkteHeute}
              onChange={(e) =>
                setSettings({ ...settings, entgeltpunkteHeute: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Rentenbeginn Alter */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Rentenbeginnsalter: {settings.rentenbeginnAlter}
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
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div className="mb-8">
        <div className="flex gap-8 items-flex-end justify-center mb-8">
          {/* LEFT BAR: Today's Net Income */}
          <div className="flex flex-col items-center">
            <div
              ref={incomeBarRef}
              onClick={handleIncomeBarClick}
              className="relative w-24 bg-gray-200 rounded-b-lg cursor-pointer group overflow-hidden"
              style={{ height: `${barHeight}px` }}
            >
              {/* Fill */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-200"
                style={{ height: `${incomePercentage}%` }}
              />

              {/* Label inside bar */}
              <div className="absolute bottom-4 left-0 right-0 text-center text-white text-xs font-bold pointer-events-none">
                <p className="text-xs">Nettoeinkommen</p>
                <p className="font-bold">{formatCurrency(netIncome)}</p>
              </div>

              {/* Handle at top */}
              <div
                ref={incomeHandleRef}
                onMouseDown={handleIncomeMouseDown}
                className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg transition z-10"
              >
                <span className="text-xl text-blue-500">⇕</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 font-semibold">Einkommen</p>
          </div>

          {/* RIGHT BAR: Pension at Retirement (Stacked) */}
          <div className="flex flex-col items-center">
            <div
              ref={pensionBarRef}
              onClick={handlePensionBarClick}
              className="relative w-24 bg-gray-100 rounded-b-lg cursor-pointer group overflow-hidden border border-gray-300"
              style={{ height: `${barHeight}px` }}
            >
              {/* Segment 1: Statutory Pension (Bottom, Green) */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all duration-200"
                style={{ height: `${gesetzlicheHeight}%` }}
              />

              {/* Segment 2: Private Pension (Middle, Teal) */}
              <div
                className="absolute left-0 right-0 bg-gradient-to-t from-cyan-400 to-cyan-300 transition-all duration-200"
                style={{
                  bottom: `${gesetzlicheHeight}%`,
                  height: `${privateHeight}%`,
                }}
              />

              {/* Segment 3: Pension Gap (Top, Orange/Red) */}
              {vorsorgelueckeHeight > 0 && (
                <div
                  className="absolute left-0 right-0 bg-gradient-to-t from-orange-400 to-orange-300 transition-all duration-200"
                  style={{
                    bottom: `${gesetzlicheHeight + privateHeight}%`,
                    height: `${vorsorgelueckeHeight}%`,
                  }}
                />
              )}

              {/* Label at top */}
              <div className="absolute top-2 left-0 right-0 text-center text-xs font-bold text-gray-800 pointer-events-none">
                <p className="text-xs">Wunschrente</p>
                <p className="font-bold">{formatCurrency(wunschrente)}</p>
              </div>

              {/* Handle at top right */}
              <div
                onMouseDown={handlePensionMouseDown}
                className="absolute -top-6 right-0 w-12 h-12 bg-white border-2 border-emerald-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg transition z-10"
              >
                <span className="text-xl text-emerald-500">↔</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 font-semibold">Rente</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded" />
            <span className="text-gray-700">Gesetzliche Rente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-t from-cyan-400 to-cyan-300 rounded" />
            <span className="text-gray-700">Private Rente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-t from-orange-400 to-orange-300 rounded" />
            <span className="text-gray-700">Vorsorgelücke</span>
          </div>
        </div>
      </div>

      {/* Sliders Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Birth Year Slider */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Geburtsjahr: {birthYear}
          </label>
          <input
            type="range"
            min="1940"
            max="2005"
            step="1"
            value={birthYear}
            onChange={(e) => setBirthYear(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1940</span>
            <span>2005</span>
          </div>
        </div>

        {/* Private Pension Slider */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Private Rente: {formatCurrency(privateRente)} / Monat
          </label>
          <input
            type="range"
            min="0"
            max="1000"
            step="50"
            value={privateRente}
            onChange={(e) => setPrivateRente(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(1000)}</span>
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="border-t pt-6 grid grid-cols-3 gap-4 text-center">
        <div className="p-4 bg-emerald-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Gesetzliche Rente (netto)</p>
          <p className="text-lg font-bold text-emerald-700">
            {formatCurrency(pensionResult.gesetzlicheRenteNetto)}
          </p>
        </div>

        <div className="p-4 bg-cyan-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Private Rente</p>
          <p className="text-lg font-bold text-cyan-700">
            {formatCurrency(pensionResult.privateRente)}
          </p>
        </div>

        <div
          className={`p-4 rounded-lg ${
            pensionResult.vorsorgeluecke > 0 ? "bg-orange-50" : "bg-green-50"
          }`}
        >
          <p className="text-xs text-gray-600 mb-1">Vorsorgelücke</p>
          <p
            className={`text-lg font-bold ${
              pensionResult.vorsorgeluecke > 0 ? "text-orange-700" : "text-green-700"
            }`}
          >
            {formatCurrency(pensionResult.vorsorgeluecke)}
          </p>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Gesamtrente:</span>{" "}
          <span className="font-bold text-lg">{formatCurrency(pensionResult.gesamtRente)}</span>
        </p>
        <p className="text-xs text-gray-600 mt-2">
          Diese Berechnung basiert auf vereinfachten Annahmen. Die tatsächliche Rente kann
          unterschiedlich ausfallen.
        </p>
      </div>

      {/* Next Button */}
      {onStepComplete && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={onStepComplete}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-md hover:shadow-lg"
          >
            Weiter zu Schritt 2 →
          </button>
        </div>
      )}
    </div>
  );
};

export default PensionStep1;

