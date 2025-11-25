"use client";

import { useRef, useCallback } from "react";
import { calcVorsorgeluecke, getAge, RENT_CONSTANTS } from "@/utils/renteCalculator";

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
 * Pixel-accurate UI with Next.js + Tailwind CSS
 *
 * Features:
 * - Income block with minus/plus circles
 * - Draggable bars for income, desired pension, and statutory pension
 * - Timeline showing "Today" to "Retirement at 67"
 * - Sliders for year of birth (red gradient) and private savings (gray gradient)
 * - Calculated pension gap (Vorsorgelücke)
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
  const incomeBarRef = useRef<HTMLDivElement>(null);
  const wunscheBarRef = useRef<HTMLDivElement>(null);

  const incomePercentage = (nettoeinkommen / maxIncome) * 100;
  const gesetzlichePercentage = (gesetzlicheRente / maxRente) * 100;
  const wunschePercentage = (wunschrente / maxRente) * 100;

  // Calculate pension gap
  const vorsorgeluecke = calcVorsorgeluecke(
    wunschrente,
    gesetzlicheRente,
    privatrente
  );

  // Get current age
  const age = getAge(jahrgang);

  /**
   * Generic drag handler that calculates value from mouse position
   * @param containerRef - Reference to the draggable container
   * @param maxValue - Maximum value for the range
   * @param onValueChange - Callback to update the value
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
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const value = (percentage / 100) * maxValue;
        onValueChange(Math.round(value));
      };
    },
    []
  );

  /**
   * Setup drag listener on mouse down
   * Handles continuous dragging until mouse up
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
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const value = (percentage / 100) * maxValue;
        onValueChange(Math.round(value));
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

  const handleIncomeBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      createDragHandler(incomeBarRef, maxIncome, onNettoeinkommenChange)(e);
    },
    [createDragHandler, maxIncome, onNettoeinkommenChange]
  );

  const handleWunscheBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      createDragHandler(wunscheBarRef, maxRente, onWunschrenterChange)(e);
    },
    [createDragHandler, maxRente, onWunschrenterChange]
  );

  const handleIncomeHandleMouseDown = useCallback(() => {
    startDrag(incomeBarRef, maxIncome, onNettoeinkommenChange);
  }, [startDrag, maxIncome, onNettoeinkommenChange]);

  const handleWunscheHandleMouseDown = useCallback(() => {
    startDrag(wunscheBarRef, maxRente, onWunschrenterChange);
  }, [startDrag, maxRente, onWunschrenterChange]);

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">
          Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Alter: {age} Jahre | Rentenbeginn in {Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age)} Jahren
        </p>
      </div>

      {/* Income Block */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          {/* Minus circle */}
          <button
            className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors"
            onClick={() => onNettoeinkommenChange(Math.max(0, nettoeinkommen - 100))}
            tabIndex={0}
          >
            <span className="text-gray-600 font-bold">−</span>
          </button>

          {/* Income info */}
          <div>
            <p className="text-sm text-gray-600">Monatliches Nettoeinkommen</p>
            <p className="text-2xl font-bold text-gray-900">€{nettoeinkommen.toLocaleString()}</p>
          </div>

          {/* Plus circle */}
          <button
            className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors ml-auto"
            onClick={() => onNettoeinkommenChange(Math.min(maxIncome, nettoeinkommen + 100))}
            tabIndex={0}
          >
            <span className="text-gray-600 font-bold">+</span>
          </button>
        </div>
      </div>

      {/* Bars Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        {/* Income Bar */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Einkommen (Basis für Rente)</label>
          <div
            ref={incomeBarRef}
            className="relative h-12 bg-gray-100 rounded-lg overflow-hidden mb-2 cursor-pointer"
            onClick={handleIncomeBarClick}
          >
            <div
              className="h-full bg-gray-400 flex items-center pr-4 justify-end text-white text-sm font-bold transition-all duration-200 ease-out"
              style={{ width: `${incomePercentage}%` }}
            >
              {incomePercentage > 20 && `€${nettoeinkommen}`}
            </div>
            {/* Drag handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-8 bg-gray-400 cursor-grab active:cursor-grabbing rounded shadow hover:scale-105 transition-transform focus:ring-2 focus:ring-gray-300 focus:outline-none"
              style={{ left: `calc(${incomePercentage}% - 12px)` }}
              onMouseDown={handleIncomeHandleMouseDown}
              tabIndex={0}
              role="slider"
              aria-label={`Einkommen: €${nettoeinkommen}`}
              aria-valuenow={nettoeinkommen}
              aria-valuemin={0}
              aria-valuemax={maxIncome}
            />
          </div>
        </div>

        {/* Wunschrente Bar */}
        <div className="mb-8">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Gewünschte Rentenhöhe</label>
          <div
            ref={wunscheBarRef}
            className="relative h-8 bg-gray-100 rounded-lg overflow-hidden mb-2 cursor-pointer"
            onClick={handleWunscheBarClick}
          >
            <div
              className="h-full bg-red-600 transition-all duration-200 ease-out"
              style={{ width: `${wunschePercentage}%` }}
            />
            {/* Drag handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-8 bg-red-600 cursor-grab active:cursor-grabbing rounded shadow hover:scale-105 transition-transform focus:ring-2 focus:ring-red-300 focus:outline-none"
              style={{ left: `calc(${wunschePercentage}% - 12px)` }}
              onMouseDown={handleWunscheHandleMouseDown}
              tabIndex={0}
              role="slider"
              aria-label={`Wunschrente: €${wunschrente}`}
              aria-valuenow={wunschrente}
              aria-valuemin={0}
              aria-valuemax={maxRente}
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold text-red-600">Wunschrente</p>
            <p className="text-sm font-bold text-gray-900">€{wunschrente}</p>
          </div>
        </div>

        {/* Statutory Pension Bar */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Gesetzliche Rente (netto)</label>
          <div
            className="relative h-16 bg-blue-100 rounded-lg overflow-hidden flex items-center px-4 transition-all duration-200 ease-out"
            style={{ width: `${Math.min(100, gesetzlichePercentage)}%`, minWidth: "60px" }}
          >
            <div className="bg-blue-500 text-white text-sm font-semibold rounded px-3 py-2 whitespace-nowrap">
              €{gesetzlicheRente}
            </div>
          </div>
        </div>
      </div>

      {/* Vorsorgelücke Card */}
      <div
        className={`rounded-lg p-6 shadow-sm border ${
          vorsorgeluecke > 0
            ? "bg-red-50 border-red-200"
            : "bg-green-50 border-green-200"
        }`}
      >
        <h3 className="font-semibold text-gray-900 mb-2">Versorgungslücke (Vorsorgelücke)</h3>
        <p
          className={`text-2xl font-bold ${
            vorsorgeluecke > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          €{vorsorgeluecke.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600 mt-2">
          {vorsorgeluecke > 0
            ? "Zusätzliche monatliche Altersvorsorge erforderlich"
            : "Ihre Altersversorgung ist gesichert"}
        </p>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Heute</span>
          </div>
          <div className="flex-1 h-1 bg-gray-300 mx-4" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Rentenbeginn mit {RENT_CONSTANTS.RETIREMENT_AGE} Jahren
            </span>
          </div>
        </div>
      </div>

      {/* Sliders Section */}
      <div className="space-y-6 bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        {/* Jahrgang Slider */}
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
            onChange={(e) => onJahrgangChange(parseInt(e.target.value))}
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

        {/* Private Rente Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Angesparte private Rente (monatlich)</label>
            <span className="text-sm font-bold text-gray-900">€{privatrente.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="100"
            value={privatrente}
            onChange={(e) => onPrivatrenterChange(parseInt(e.target.value))}
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

