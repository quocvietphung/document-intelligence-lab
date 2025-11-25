"use client";

import { useRef, useCallback, useState } from "react";
import {
  calcVorsorgeluecke,
  getAge,
  calculatePension,
  RENT_CONSTANTS,
  SETTINGS_DEFAULTS,
} from "@/utils/renteCalculator";

interface Step1WunschrrenteProps {
  nettoeinkommen: number;
  gesetzlicheRente?: number;
  wunschrente: number;
  jahrgang: number;
  privatrente: number;
  maxIncome: number;
  maxRente: number;
  onNettoeinkommenChange: (value: number) => void;
  onWunschrenterChange: (value: number) => void;
  onJahrgangChange: (value: number) => void;
  onPrivatrenterChange: (value: number) => void;
}

/**
 * ERGO Rentenrechner - Step 1: "Ihre Wunschrente"
 * 
 * ERGO PIXEL-PERFECT UI:
 * - 2-Block Chart: Grey income + Green gesetzliche rente
 * - Red Wunschrente line (draggable)
 * - Vorsorgelücke label
 * - Einstellungen panel with inflation, salary growth, bundesland, entgeltpunkte
 * - Timeline section
 * - Sliders with gradients
 * - All ERGO colors, spacing, fonts
 */
export function Step1Wunschrente({
  nettoeinkommen,
  gesetzlicheRente: _,
  wunschrente,
  jahrgang,
  privatrente,
  maxIncome,
  maxRente,
  onNettoeinkommenChange,
  onWunschrenterChange,
  onJahrgangChange,
  onPrivatrenterChange,
}: Step1WunschrrenteProps) {
  // ===== SETTINGS STATE =====
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    anspruchRente: SETTINGS_DEFAULTS.anspruchRente,
    inflation: SETTINGS_DEFAULTS.inflation,
    gehaltssteigerung: SETTINGS_DEFAULTS.gehaltssteigerung,
    bundesland: SETTINGS_DEFAULTS.bundesland,
    entgeltpunktHeute: SETTINGS_DEFAULTS.entgeltpunktHeute,
  });

  // ===== REFS FOR DRAGGABLE ELEMENTS =====
  const incomeBlockRef = useRef<HTMLDivElement>(null);
  const wunschrenterLineRef = useRef<HTMLDivElement>(null);

  // ===== CALCULATE VALUES =====
  const age = getAge(jahrgang);
  const yearsUntilRetirement = Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age);

  // Comprehensive calculation with settings
  const calculation = calculatePension(nettoeinkommen, wunschrente, privatrente, jahrgang, settings);
  const computedGesetzlicheRente = calculation.nettoRente;

  // Clamp wunschrente
  const clampedWunschrente = Math.max(computedGesetzlicheRente, wunschrente);

  // Calculate chart percentages
  const incomePercentage = Math.min(100, (nettoeinkommen / maxIncome) * 100);
  const gesetzlichePercentage = Math.min(100, (computedGesetzlicheRente / maxRente) * 100);
  const wunschePercentage = (clampedWunschrente / maxRente) * 100;

  // Vorsorgelücke
  const vorsorgeluecke = calcVorsorgeluecke(clampedWunschrente, computedGesetzlicheRente, privatrente);

  // ===== DRAG HANDLERS =====
  const createDragHandler = useCallback(
    (
      containerRef: React.RefObject<HTMLDivElement | null>,
      maxValue: number,
      onValueChange: (value: number) => void
    ) => {
      return (e: React.MouseEvent<HTMLDivElement>) => {
        const element = containerRef.current;
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const percentage = (x / rect.width) * 100;
        const value = Math.round((percentage / 100) * maxValue);
        onValueChange(value);
      };
    },
    []
  );

  const startDrag = useCallback(
    (
      containerRef: React.RefObject<HTMLDivElement | null>,
      maxValue: number,
      onValueChange: (value: number) => void
    ) => {
      const element = containerRef.current;
      if (!element) return;

      const handleMouseMove = (e: MouseEvent) => {
        const rect = element.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const percentage = (x / rect.width) * 100;
        const value = Math.round((percentage / 100) * maxValue);
        onValueChange(value);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    []
  );

  // ===== INCOME BLOCK HANDLERS =====
  const handleIncomeBlockClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      createDragHandler(incomeBlockRef, maxIncome, onNettoeinkommenChange)(e);
    },
    [createDragHandler, maxIncome, onNettoeinkommenChange]
  );

  const handleIncomeBlockDragStart = useCallback(() => {
    startDrag(incomeBlockRef, maxIncome, onNettoeinkommenChange);
  }, [startDrag, maxIncome, onNettoeinkommenChange]);

  // ===== WUNSCHRENTE LINE HANDLERS =====
  const handleWunschrenterLineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      createDragHandler(wunschrenterLineRef, maxRente, (value) => {
        const clamped = Math.max(computedGesetzlicheRente, value);
        onWunschrenterChange(clamped);
      })(e);
    },
    [createDragHandler, maxRente, computedGesetzlicheRente, onWunschrenterChange]
  );

  const handleWunschrenterLineDragStart = useCallback(() => {
    startDrag(wunschrenterLineRef, maxRente, (value) => {
      const clamped = Math.max(computedGesetzlicheRente, value);
      onWunschrenterChange(clamped);
    });
  }, [startDrag, maxRente, computedGesetzlicheRente, onWunschrenterChange]);

  // ===== SETTINGS HANDLERS =====
  const handleSettingsChange = useCallback(
    (key: string, value: any) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const handleResetSettings = useCallback(() => {
    setSettings(SETTINGS_DEFAULTS);
  }, []);

  // ===== RENDER =====
  return (
    <div className="space-y-8">
      {/* ===== TITLE SECTION ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Schritt 1: Berechnen Sie Ihre monatliche Rente
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              Alter: <span className="font-semibold">{age}</span> Jahre | Rentenbeginn in{" "}
              <span className="font-semibold">{yearsUntilRetirement}</span> Jahren
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Einstellungen
          </button>
        </div>
      </div>

      {/* ===== SETTINGS PANEL ===== */}
      {showSettings && (
        <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Einstellungen</h3>

          {/* Anspruch Rente Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Anspruch gesetzliche Rente</label>
            <button
              onClick={() => handleSettingsChange("anspruchRente", !settings.anspruchRente)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.anspruchRente ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.anspruchRente ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Inflation Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Inflation (%)</label>
              <span className="text-sm font-semibold text-gray-900">{settings.inflation.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.inflation}
              onChange={(e) => handleSettingsChange("inflation", parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Gehaltssteigerung Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Gehaltssteigerung (%)</label>
              <span className="text-sm font-semibold text-gray-900">{settings.gehaltssteigerung.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.gehaltssteigerung}
              onChange={(e) => handleSettingsChange("gehaltssteigerung", parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Bundesland Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Bundesland</label>
            <div className="flex gap-4">
              <button
                onClick={() => handleSettingsChange("bundesland", "west")}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  settings.bundesland === "west"
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                West
              </button>
              <button
                onClick={() => handleSettingsChange("bundesland", "east")}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  settings.bundesland === "east"
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                Ost
              </button>
            </div>
          </div>

          {/* Entgeltpunkte Heute Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Entgeltpunkte heute</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={settings.entgeltpunktHeute}
              onChange={(e) => handleSettingsChange("entgeltpunktHeute", parseFloat(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleResetSettings}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Zurücksetzen
          </button>
        </div>
      )}

      {/* ===== 2-BLOCK CHART (ERGO PIXEL-PERFECT) ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
        <div className="space-y-5">
          {/* Labels Row */}
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Monatliches Nettoeinkommen
              </p>
              <p className="text-2xl font-bold text-gray-900">€{nettoeinkommen.toLocaleString("de-DE")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                Gesetzliche Rente (netto)
              </p>
              <p className="text-2xl font-bold text-green-700">
                €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
              </p>
            </div>
          </div>

          {/* CHART CONTAINER - 2 BLOCKS */}
          <div className="relative h-32 bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center">
            {/* Income Block (Grey) - LEFT */}
            <div
              ref={incomeBlockRef}
              className="absolute left-0 top-0 bottom-0 bg-gray-400 rounded-r-lg cursor-grab active:cursor-grabbing hover:bg-gray-500 transition-all flex items-center justify-center overflow-hidden group shadow-sm"
              style={{
                width: `${Math.max(incomePercentage, 3)}%`,
                minWidth: "50px",
              }}
              onClick={handleIncomeBlockClick}
            >
              {/* Black Drag Handle at Right Edge */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 bg-black cursor-grab active:cursor-grabbing hover:bg-gray-800"
                onMouseDown={handleIncomeBlockDragStart}
              />
              {incomePercentage > 12 && (
                <span className="text-white text-xs font-bold text-center px-2 truncate">
                  €{nettoeinkommen.toLocaleString("de-DE")}
                </span>
              )}
            </div>

            {/* Gesetzliche Rente Block (Green) - RIGHT */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-green-500 rounded-l-lg flex items-center justify-center overflow-hidden group shadow-sm"
              style={{
                width: `${Math.max(gesetzlichePercentage, 3)}%`,
                minWidth: "50px",
              }}
            >
              {/* Black Drag Handle at Left Edge (Non-draggable) */}
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-black" />
              {gesetzlichePercentage > 12 && (
                <span className="text-white text-xs font-bold text-center px-2 truncate">
                  €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
                </span>
              )}
            </div>

            {/* Wunschrente RED LINE (Draggable) */}
            <div
              ref={wunschrenterLineRef}
              className="absolute top-0 bottom-0 w-1 bg-red-600 cursor-grab active:cursor-grabbing hover:w-1.5 transition-all"
              style={{ left: `${wunschePercentage}%` }}
              onClick={handleWunschrenterLineClick}
              onMouseDown={handleWunschrenterLineDragStart}
            />
          </div>

          {/* Wunschrente Label - RIGHT ALIGNED */}
          <div className="text-right">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Wunschrente</p>
            <p className="text-lg font-bold text-red-600">€{Math.round(clampedWunschrente).toLocaleString("de-DE")}</p>
          </div>

          {/* Vorsorgelücke Label - BOTTOM */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Vorsorgelücke</p>
            <p className={`text-sm font-bold ${vorsorgeluecke > 0 ? "text-red-600" : "text-green-600"}`}>
              €{Math.round(vorsorgeluecke).toLocaleString("de-DE")}
            </p>
          </div>
        </div>
      </div>

      {/* ===== TIMELINE ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-gray-600">0 € — Heute</span>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex-1 h-px bg-gray-300" />
            <div className="mx-3 w-3 h-3 rounded-full bg-black" />
            <div className="flex-1 h-px bg-gray-300" />
          </div>
          <span className="text-xs font-semibold text-gray-600 text-right">
            Rentenbeginn {RENT_CONSTANTS.RETIREMENT_AGE} Jahre
          </span>
        </div>
      </div>

      {/* ===== SLIDERS SECTION ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200 space-y-6">
        {/* Jahrgang Slider - Red Gradient */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Geburtsjahr</label>
            <span className="text-sm font-bold text-gray-900">{jahrgang}</span>
          </div>
          <input
            type="range"
            min="1940"
            max="2005"
            value={jahrgang}
            onChange={(e) => onJahrgangChange(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #C8102E 0%, #C8102E ${
                ((jahrgang - 1940) / (2005 - 1940)) * 100
              }%, #fecaca ${((jahrgang - 1940) / (2005 - 1940)) * 100}%, #fecaca 100%)`,
            }}
          />
        </div>

        {/* Private Rente Slider - Grey Gradient */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Angesparte private Rente (monatlich)</label>
            <span className="text-sm font-bold text-gray-900">€{privatrente.toLocaleString("de-DE")}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="100"
            value={privatrente}
            onChange={(e) => onPrivatrenterChange(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #9ca3af 0%, #9ca3af ${
                (privatrente / 10000) * 100
              }%, #e5e7eb ${(privatrente / 10000) * 100}%, #e5e7eb 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Step1Wunschrente;

