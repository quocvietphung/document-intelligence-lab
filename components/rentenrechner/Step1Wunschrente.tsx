"use client";

import { useRef, useCallback } from "react";
import {
  calcVorsorgeluecke,
  getAge,
  RENT_CONSTANTS,
} from "@/utils/renteCalculator";

interface Step1WunschrrenteProps {
  nettoeinkommen: number;
  gesetzlicheRente: number;
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
 * ERGO-compliant UI with:
 * - White cards (#F5F5F5 background, 12px rounded corners)
 * - Draggable bars: Income (gray), Wunschrente (red 4px line), gesetzliche Rente (blue capsule)
 * - Interactive plus/minus buttons for income
 * - Red gradient Jahrgang slider
 * - Real-time Vorsorgelücke calculation
 * - Full keyboard accessibility
 */
export function Step1Wunschrente({
  nettoeinkommen,
  gesetzlicheRente,
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
  // Refs for draggable elements
  const incomeBarRef = useRef<HTMLDivElement>(null);
  const wunscheBarRef = useRef<HTMLDivElement>(null);

  // Calculate percentages for bar widths
  const incomePercentage = Math.max(10, (nettoeinkommen / maxIncome) * 100);
  const gesetzlichePercentage = Math.max(10, (gesetzlicheRente / maxRente) * 100);
  const wunschePercentage = (wunschrente / maxRente) * 100;

  // Validate and clamp Wunschrente: cannot be less than gesetzliche Rente
  const clampedWunschrente = Math.max(gesetzlicheRente, wunschrente);

  // Calculate pension gap (Vorsorgelücke)
  const vorsorgeluecke = calcVorsorgeluecke(
    clampedWunschrente,
    gesetzlicheRente,
    privatrente
  );

  // Get current age
  const age = getAge(jahrgang);
  const yearsUntilRetirement = Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age);

  /**
   * Create a drag handler that calculates values from mouse position
   * Handles both click-to-position and drag interactions
   */
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

  /**
   * Start continuous drag: attaches mousemove listener
   * Updates values smoothly while dragging
   */
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

  // Handlers for income bar
  const handleIncomeBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      createDragHandler(incomeBarRef, maxIncome, onNettoeinkommenChange)(e);
    },
    [createDragHandler, maxIncome, onNettoeinkommenChange]
  );

  const handleIncomeHandleMouseDown = useCallback(() => {
    startDrag(incomeBarRef, maxIncome, onNettoeinkommenChange);
  }, [startDrag, maxIncome, onNettoeinkommenChange]);

  // Handlers for wunschrente bar
  const handleWunscheBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Clamp wunschrente to be at least as high as gesetzliche Rente
      createDragHandler(wunscheBarRef, maxRente, (value) => {
        const clamped = Math.max(gesetzlicheRente, value);
        onWunschrenterChange(clamped);
      })(e);
    },
    [createDragHandler, maxRente, gesetzlicheRente, onWunschrenterChange]
  );

  const handleWunscheHandleMouseDown = useCallback(() => {
    startDrag(wunscheBarRef, maxRente, (value) => {
      const clamped = Math.max(gesetzlicheRente, value);
      onWunschrenterChange(clamped);
    });
  }, [startDrag, maxRente, gesetzlicheRente, onWunschrenterChange]);

  // Handler for income +/- buttons
  const handleIncomeChange = useCallback(
    (delta: number) => {
      const newValue = Math.max(0, Math.min(maxIncome, nettoeinkommen + delta));
      onNettoeinkommenChange(newValue);
    },
    [nettoeinkommen, maxIncome, onNettoeinkommenChange]
  );

  return (
    <div className="space-y-8">
      {/* ===== TITLE SECTION ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen
        </h2>
        <p className="text-sm font-medium text-gray-600 mt-2">
          Alter: <span className="font-semibold text-gray-900">{age}</span> Jahre |
          Rentenbeginn in{" "}
          <span className="font-semibold text-gray-900">{yearsUntilRetirement}</span> Jahren
        </p>
      </div>

      {/* ===== INCOME BLOCK (BRUTTO) ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          {/* Minus Button */}
          <button
            className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            onClick={() => handleIncomeChange(-100)}
            tabIndex={0}
            aria-label="Einkommen um 100€ reduzieren"
          >
            <span className="text-gray-700 font-bold text-lg">−</span>
          </button>

          {/* Income Display */}
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Monatliches Nettoeinkommen
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              €{nettoeinkommen.toLocaleString("de-DE")}
            </p>
          </div>

          {/* Plus Button */}
          <button
            className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            onClick={() => handleIncomeChange(100)}
            tabIndex={0}
            aria-label="Einkommen um 100€ erhöhen"
          >
            <span className="text-gray-700 font-bold text-lg">+</span>
          </button>
        </div>
      </div>

      {/* ===== INTERACTIVE BARS SECTION ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200 space-y-6">
        {/* ===== INCOME BAR (GREY) ===== */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Einkommen (Basis für Rentenberechnung)
          </label>

          <div
            ref={incomeBarRef}
            className="relative h-12 bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
            onClick={handleIncomeBarClick}
            role="slider"
            aria-label="Einkommen"
            aria-valuenow={nettoeinkommen}
            aria-valuemin={0}
            aria-valuemax={maxIncome}
          >
            {/* Grey fill bar */}
            <div
              className="h-full bg-gray-400 flex items-center justify-end pr-4 text-white text-sm font-bold transition-all duration-200 ease-out"
              style={{ width: `${incomePercentage}%` }}
            >
              {incomePercentage > 20 && `€${nettoeinkommen.toLocaleString("de-DE")}`}
            </div>

            {/* Drag Handle - small rounded rectangle with shadow */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-8 bg-gray-500 rounded shadow-md cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ left: `calc(${incomePercentage}% - 12px)` }}
              onMouseDown={handleIncomeHandleMouseDown}
              tabIndex={0}
              role="button"
              aria-label={`Einkommen: €${nettoeinkommen.toLocaleString("de-DE")}`}
            />
          </div>
        </div>

        {/* ===== WUNSCHRENTE BAR (RED 4px LINE) ===== */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Gewünschte monatliche Rentenhöhe
          </label>

          <div
            ref={wunscheBarRef}
            className="relative h-12 bg-gray-100 rounded-lg overflow-hidden cursor-pointer flex items-center"
            onClick={handleWunscheBarClick}
            role="slider"
            aria-label="Gewünschte Rente"
            aria-valuenow={clampedWunschrente}
            aria-valuemin={gesetzlicheRente}
            aria-valuemax={maxRente}
          >
            {/* Red 4px line representing wunschrente */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-red-600 transition-all duration-200 ease-out"
              style={{ left: `${wunschePercentage}%` }}
            />

            {/* Drag Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-8 bg-red-600 rounded shadow-md cursor-grab active:cursor-grabbing hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
              style={{ left: `calc(${wunschePercentage}% - 10px)` }}
              onMouseDown={handleWunscheHandleMouseDown}
              tabIndex={0}
              role="button"
              aria-label={`Gewünschte Rente: €${clampedWunschrente.toLocaleString("de-DE")}`}
            />

            {/* Visual background for context */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-50 to-transparent pointer-events-none" />
          </div>

          <div className="flex justify-between items-center mt-2">
            <p className="text-xs font-semibold text-red-600">Zielwert</p>
            <p className="text-sm font-bold text-gray-900">
              €{clampedWunschrente.toLocaleString("de-DE")}
            </p>
          </div>
        </div>

        {/* ===== GESETZLICHE RENTE BAR (BLUE CAPSULE) ===== */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
            Gesetzliche Rente (netto)
          </label>

          <div className="relative h-12 bg-blue-50 rounded-lg overflow-hidden flex items-center px-4">
            {/* Blue capsule container */}
            <div
              className="h-full bg-blue-500 rounded-md flex items-center px-3 py-2 text-white text-sm font-bold whitespace-nowrap transition-all duration-200 ease-out shadow-sm"
              style={{ width: `${Math.min(100, gesetzlichePercentage)}%`, minWidth: "120px" }}
            >
              €{gesetzlicheRente.toLocaleString("de-DE")}
            </div>
          </div>
        </div>
      </div>

      {/* ===== VORSORGELÜCKE CARD (PENSION GAP) ===== */}
      <div
        className={`rounded-[12px] p-6 shadow-sm border transition-colors ${
          vorsorgeluecke > 0
            ? "bg-red-50 border-red-200"
            : "bg-green-50 border-green-200"
        }`}
      >
        <h3 className="font-semibold text-gray-900">
          Versorgungslücke (Vorsorgelücke)
        </h3>
        <p
          className={`text-3xl font-bold mt-2 ${
            vorsorgeluecke > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          €{vorsorgeluecke.toLocaleString("de-DE")}
        </p>
        <p className="text-sm text-gray-600 mt-2">
          {vorsorgeluecke > 0
            ? "Zusätzliche monatliche Altersvorsorge erforderlich"
            : "Ihre Altersversorgung ist vollständig gesichert"}
        </p>
      </div>

      {/* ===== TIMELINE ===== */}
      <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-gray-600">Heute</span>
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-xs font-semibold text-gray-600 text-right">
            Rentenbeginn mit {RENT_CONSTANTS.RETIREMENT_AGE} Jahren
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
            aria-label="Geburtsjahr"
            aria-valuenow={jahrgang}
            aria-valuemin={1940}
            aria-valuemax={2005}
          />
        </div>

        {/* Private Rente Slider - Grey Gradient */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">
              Angesparte private Rente (monatlich)
            </label>
            <span className="text-sm font-bold text-gray-900">
              €{privatrente.toLocaleString("de-DE")}
            </span>
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
            aria-label="Private Altersvorsorge"
            aria-valuenow={privatrente}
            aria-valuemin={0}
            aria-valuemax={10000}
          />
        </div>
      </div>
    </div>
  );
}

export default Step1Wunschrente;

