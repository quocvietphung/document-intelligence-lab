"use client";

import { useState, useEffect, useRef } from "react";

// ==================== Step Navigation Component ====================
function StepNav({
  currentStep,
  onBack,
  onNext,
  canGoNext,
}: {
  currentStep: number;
  onBack: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  const steps = [
    { number: 1, title: "Ihre Wunschrente" },
    { number: 2, title: "Ihre Vorsorgelücke" },
    { number: 3, title: "Ihr Ergebnis" },
  ];

  return (
    <div className="bg-white border-b border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4">
        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all ${
                  currentStep >= step.number
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {step.number}
              </div>
              <div className="ml-3 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    currentStep >= step.number ? "text-gray-900" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    currentStep > step.number ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            disabled={currentStep === 1}
            className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ← Zurück
          </button>
          <button
            onClick={onNext}
            disabled={!canGoNext || currentStep === 3}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Weiter →
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Rent Chart Component ====================
function RentChart({
  nettoeinkommen,
  gesetzlicheRente,
  wunschrente,
  maxIncome,
  maxRente,
  onNettoeinkommenChange,
  onWunschrenterChange,
}: {
  nettoeinkommen: number;
  gesetzlicheRente: number;
  wunschrente: number;
  maxIncome: number;
  maxRente: number;
  onNettoeinkommenChange: (value: number) => void;
  onWunschrenterChange: (value: number) => void;
}) {
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
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Ihre Rentensituation</h2>

      {/* Wunschrente Line */}
      <div className="relative mb-16 h-16">
        <div className="absolute top-8 w-full h-0.5 bg-gray-200"></div>
        <div
          className="absolute top-6 w-1 h-4 bg-red-500 transition-all duration-300"
          style={{ left: `${wunschePercentage}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-red-600">
            Wunschrente: €{wunschrente.toLocaleString()}
          </div>
        </div>
        <div
          onMouseDown={startWunschDrag}
          className="absolute top-4 w-8 h-8 bg-red-500 rounded-full cursor-grab active:cursor-grabbing shadow-md hover:scale-110 transition-transform"
          style={{ left: `calc(${wunschePercentage}% - 16px)` }}
          title="Drag to adjust"
        />
      </div>

      {/* Main Chart */}
      <div
        ref={chartRef}
        className="relative h-32 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl overflow-hidden"
      >
        {/* Nettoeinkommen Bar */}
        <div className="absolute top-0 left-0 h-1/2 w-full bg-gray-200">
          <div
            className="h-full bg-gray-400 transition-all duration-300 flex items-center justify-center text-sm font-bold text-white"
            style={{ width: `${incomePercentage}%` }}
          >
            {incomePercentage > 15 && `€${nettoeinkommen.toLocaleString()}`}
          </div>
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-400 rounded-full cursor-grab active:cursor-grabbing shadow-lg hover:scale-110 transition-transform"
          style={{ left: `calc(${incomePercentage}% - 16px)` }}
          onMouseDown={startIncomeDrag}
          title="Drag to adjust Nettoeinkommen"
        />

        <div className="absolute top-2 left-4 text-xs font-semibold text-gray-700">
          Nettoeinkommen
        </div>

        {/* Gesetzliche Rente Bar */}
        <div className="absolute bottom-0 left-0 h-1/2 w-full bg-teal-100">
          <div
            className="h-full bg-teal-500 transition-all duration-300 flex items-center justify-center text-sm font-bold text-white"
            style={{ width: `${gesetzlichePercentage}%` }}
          >
            {gesetzlichePercentage > 15 && `€${gesetzlicheRente.toLocaleString()}`}
          </div>
        </div>

        <div className="absolute bottom-2 left-4 text-xs font-semibold text-teal-700">
          Gesetzliche Rente (netto)
        </div>
      </div>

      {/* Summary */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-600 font-semibold mb-1">Nettoeinkommen</p>
          <p className="text-2xl font-bold text-gray-900">€{nettoeinkommen.toLocaleString()}</p>
        </div>
        <div className="bg-teal-50 rounded-lg p-4">
          <p className="text-xs text-teal-600 font-semibold mb-1">Gesetzliche Rente</p>
          <p className="text-2xl font-bold text-teal-600">€{gesetzlicheRente.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-red-600 font-semibold mb-1">Wunschrente</p>
          <p className="text-2xl font-bold text-red-600">€{wunschrente.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== Slider Group Component ====================
function SliderGroup({
  jahrgang,
  privatrente,
  onJahrgangChange,
  onPrivatrenterChange,
}: {
  jahrgang: number;
  privatrente: number;
  onJahrgangChange: (value: number) => void;
  onPrivatrenterChange: (value: number) => void;
}) {
  const alter = new Date().getFullYear() - jahrgang;

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900 mb-8">Ihre Angaben</h3>

      {/* Jahrgang Slider */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-gray-700">Jahrgang</label>
          <span className="text-lg font-bold text-gray-900">
            {jahrgang} (Alter: {alter})
          </span>
        </div>
        <input
          type="range"
          min="1940"
          max="2005"
          value={jahrgang}
          onChange={(e) => onJahrgangChange(parseInt(e.target.value))}
          className="w-full h-3 bg-red-100 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${
              ((jahrgang - 1940) / (2005 - 1940)) * 100
            }%, #fecaca ${((jahrgang - 1940) / (2005 - 1940)) * 100}%, #fecaca 100%)`,
          }}
        />
      </div>

      {/* Private Rente Slider */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-gray-700">
            Angesparte private Rente
          </label>
          <span className="text-lg font-bold text-gray-900">
            €{privatrente.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10000"
          step="100"
          value={privatrente}
          onChange={(e) => onPrivatrenterChange(parseInt(e.target.value))}
          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #9ca3af 0%, #9ca3af ${
              (privatrente / 10000) * 100
            }%, #e5e7eb ${(privatrente / 10000) * 100}%, #e5e7eb 100%)`,
          }}
        />
      </div>
    </div>
  );
}

// ==================== Main Page Component ====================
export default function RentenrechnerPage() {
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [nettoeinkommen, setNettoeinkommen] = useState(3500);
  const [gesetzlicheRente, setGesetzlicheRente] = useState(1800);
  const [wunschrente, setWunschrente] = useState(2500);
  const [jahrgang, setJahrgang] = useState(1965);
  const [privatrente, setPrivatrente] = useState(3500);

  useEffect(() => {
    setMounted(true);
    // Calculate statutory pension based on age
    const alter = new Date().getFullYear() - jahrgang;
    const estimatedRente = Math.max(800, 2500 - (67 - alter) * 50);
    setGesetzlicheRente(estimatedRente);
  }, [jahrgang]);

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Lädt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900">Rentenrechner</h1>
          <p className="text-gray-600 mt-2">
            Berechnen Sie Ihre Altersvorsorge mit unserem interaktiven Tool
          </p>
        </div>
      </div>

      {/* Step Navigation */}
      <StepNav
        currentStep={currentStep}
        onBack={handleBack}
        onNext={handleNext}
        canGoNext={true}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {currentStep === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <RentChart
              nettoeinkommen={nettoeinkommen}
              gesetzlicheRente={gesetzlicheRente}
              wunschrente={wunschrente}
              maxIncome={8000}
              maxRente={5000}
              onNettoeinkommenChange={setNettoeinkommen}
              onWunschrenterChange={setWunschrente}
            />
            <SliderGroup
              jahrgang={jahrgang}
              privatrente={privatrente}
              onJahrgangChange={setJahrgang}
              onPrivatrenterChange={setPrivatrente}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Ihre Vorsorgelücke</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <p className="text-gray-600 text-sm font-semibold mb-2">Wunschrente</p>
                <p className="text-4xl font-bold text-blue-600">€{wunschrente.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm font-semibold mb-2">Gesetzliche Rente</p>
                <p className="text-4xl font-bold text-teal-600">€{gesetzlicheRente.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm font-semibold mb-2">Lücke</p>
                <p
                  className={`text-4xl font-bold ${
                    wunschrente - gesetzlicheRente > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  €{Math.abs(wunschrente - gesetzlicheRente).toLocaleString()}
                </p>
              </div>
            </div>
            {wunschrente > gesetzlicheRente && (
              <div className="mt-8 p-6 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-900 font-semibold">
                  💡 Sie sollten monatlich €
                  {Math.round((wunschrente - gesetzlicheRente) / 20).toLocaleString()} sparen, um Ihre
                  Vorsorgelücke zu schließen.
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Ihr Ergebnis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-blue-50 rounded-xl p-8">
                  <p className="text-blue-600 text-sm font-semibold mb-2">Geburtsjahr</p>
                  <p className="text-3xl font-bold text-blue-900">{jahrgang}</p>
                  <p className="text-sm text-blue-700 mt-2">
                    Renteneintrittsalter: {67 + Math.max(0, jahrgang - 1960)} Jahre
                  </p>
                </div>
                <div className="bg-teal-50 rounded-xl p-8">
                  <p className="text-teal-600 text-sm font-semibold mb-2">Private Ersparnisse</p>
                  <p className="text-3xl font-bold text-teal-900">€{privatrente.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-bold text-green-900 mb-2">✓ Ihre Altersvorsorge</h3>
                <ul className="space-y-2 text-green-800">
                  <li>• Gesetzliche Rente: €{gesetzlicheRente.toLocaleString()}</li>
                  <li>• Private Rente: €{privatrente.toLocaleString()}</li>
                  <li>
                    • Gesamte Rente: €{(gesetzlicheRente + privatrente).toLocaleString()}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          <p>
            Dieser Rentenrechner ist ein Planungstool und dient nur zu
            Informationszwecken. Für personalisierte Beratung konsultieren Sie bitte
            einen Rentenberater.
          </p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}

