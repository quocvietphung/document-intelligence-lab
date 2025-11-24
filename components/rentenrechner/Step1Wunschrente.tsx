"use client";

import { useRef } from "react";

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
 * - Navigation bar with horizontal tabs (red active state)
 * - Title: "Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen"
 * - Income block with minus/plus circles
 * - Draggable bars for income, desired pension, and statutory pension
 * - Timeline showing "Today" to "Retirement at 67"
 * - Sliders for year of birth (red gradient) and private savings (gray gradient)
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
  const chartRef = useRef<HTMLDivElement>(null);
  const incomePercentage = (nettoeinkommen / maxIncome) * 100;
  const gesetzlichePercentage = (gesetzlicheRente / maxRente) * 100;
  const wunschePercentage = (wunschrente / maxRente) * 100;

  const handleIncomeDrag = (e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const value = (percentage / 100) * maxIncome;
    onNettoeinkommenChange(Math.round(value));
  };

  const handleWunscheDrag = (e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const value = (percentage / 100) * maxRente;
    onWunschrenterChange(Math.round(value));
  };

  const startIncomeDrag = () => {
    const handleMouseMove = (e: MouseEvent) => handleIncomeDrag(e as any);
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const startWunschDrag = () => {
    const handleMouseMove = (e: MouseEvent) => handleWunscheDrag(e as any);
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">
          Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen
        </h2>
      </div>

      {/* Income Block */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          {/* Minus circle */}
          <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
            <span className="text-gray-600 font-bold">−</span>
          </div>

          {/* Income info */}
          <div>
            <p className="text-sm text-gray-600">Einkommen</p>
            <p className="text-2xl font-bold text-gray-900">€{nettoeinkommen.toLocaleString()}</p>
          </div>

          {/* Plus circle */}
          <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center ml-auto">
            <span className="text-gray-600 font-bold">+</span>
          </div>
        </div>
      </div>

      {/* Bars Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        {/* Income Bar */}
        <div className="mb-8">
          <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden mb-2">
            <div
              className="h-full bg-gray-400 flex items-center pr-4 justify-end text-white text-sm font-bold transition-all duration-300"
              style={{ width: `${incomePercentage}%` }}
            >
              {incomePercentage > 20 && `€${nettoeinkommen}`}
            </div>
            {/* Left drag handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-8 bg-gray-400 cursor-grab active:cursor-grabbing rounded shadow hover:scale-105 transition-transform"
              style={{ left: `calc(${incomePercentage}% - 12px)` }}
              onMouseDown={startIncomeDrag}
            />
          </div>
        </div>

        {/* Wunschrente thin line */}
        <div className="mb-8">
          <div className="relative h-1 bg-gray-300 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-red-600 transition-all duration-300"
              style={{ width: `${wunschePercentage}%` }}
            />
            {/* Right drag handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-8 bg-red-600 cursor-grab active:cursor-grabbing rounded shadow hover:scale-105 transition-transform"
              style={{ left: `calc(${wunschePercentage}% - 12px)` }}
              onMouseDown={startWunschDrag}
            />
          </div>
          <p className="text-xs text-gray-600 font-semibold">Wunschrente</p>
        </div>

        {/* Statutory Pension Blue Bar */}
        <div
          ref={chartRef}
          className="relative h-16 bg-blue-100 rounded-lg overflow-hidden flex items-center px-4"
          style={{ width: `${gesetzlichePercentage}%`, minWidth: `${Math.max(10, gesetzlichePercentage)}%` }}
        >
          <div className="bg-blue-500 text-white text-sm font-semibold rounded px-3 py-2">
            Gesetzliche Rente (netto) {gesetzlicheRente} €
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">0 € — Heute</span>
          </div>
          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600">Rentenbeginn 67 Jahre</span>
          </div>
        </div>
      </div>

      {/* Sliders Section */}
      <div className="space-y-6 bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        {/* Jahrgang Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Jahrgang</label>
            <span className="text-sm font-bold text-gray-900">{jahrgang}</span>
          </div>
          <input
            type="range"
            min="1940"
            max="2005"
            value={jahrgang}
            onChange={(e) => onJahrgangChange(parseInt(e.target.value))}
            className="w-full h-2 bg-red-100 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #C8102E 0%, #C8102E ${
                ((jahrgang - 1940) / (2005 - 1940)) * 100
              }%, #fecaca ${((jahrgang - 1940) / (2005 - 1940)) * 100}%, #fecaca 100%)`,
            }}
          />
        </div>

        {/* Angesparte private Rente Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-semibold text-gray-700">Angesparte private Rente</label>
            <span className="text-sm font-bold text-gray-900">€{privatrente.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="100"
            value={privatrente}
            onChange={(e) => onPrivatrenterChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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

