"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

// ==================== Step Navigation Component ====================
function StepNav({
  currentStep,
  onBack,
  onNext,
  canGoNext,
  t,
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
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center justify-between">
          {/* Left: Back button */}
          <button
            onClick={onBack}
            disabled={currentStep === 1}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Zurück
          </button>

          {/* Center: Tabs */}
          <div className="flex items-center gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <button
                  className={`text-sm font-medium whitespace-nowrap pb-3 ${
                    currentStep === step.number
                      ? "text-[#C8102E]"
                      : "text-gray-500"
                  }`}
                >
                  {step.number}. {step.title}
                </button>
                {/* Red underline for active tab */}
                {currentStep === step.number && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#C8102E]"></div>
                )}
                {/* Grey underline for all tabs */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200"></div>
              </div>
            ))}
          </div>

          {/* Right: Next button */}
          <button
            onClick={onNext}
            disabled={!canGoNext || currentStep === 3}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Weiter →
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Step 1: Wunschrente Component ====================
function Step1Wunschrente({
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
}: {
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

// ==================== Main Page Component ====================
export default function RentenrechnerPage() {
  const tFunc = useTranslations("rentenrechner");

  // Fallback translations if useTranslations fails
  const fallbackT = {
    title: "Rentenrechner",
    subtitle: "Berechnen Sie Ihre Altersvorsorge mit unserem interaktiven Tool",
    step1: "Ihre Wunschrente",
    step2: "Ihre Vorsorgelücke",
    step3: "Ihr Ergebnis",
    back: "← Zurück",
    next: "Weiter →",
    rentSituation: "Ihre Rentensituation",
    desiredRetirement: "Wunschrente",
    netIncome: "Nettoeinkommen",
    statutoryPension: "Gesetzliche Rente (netto)",
    statutoryPensionLabel: "Gesetzliche Rente",
    yourInformation: "Ihre Angaben",
    yearOfBirth: "Jahrgang",
    age: "Alter",
    privateSavings: "Angesparte private Rente",
    gapAnalysis: "Ihre Vorsorgelücke",
    gap: "Lücke",
    savingRecommendation: "💡 Sie sollten monatlich €",
    savingRecommendationEnd: "sparen, um Ihre Vorsorgelücke zu schließen.",
    results: "Ihr Ergebnis",
    yearOfBirthLabel: "Geburtsjahr",
    retirementAge: "Renteneintrittsalter",
    privateSavingsLabel: "Private Ersparnisse",
    totalRetirement: "✓ Ihre Altersvorsorge",
    privatePensionLabel: "Private Rente",
    totalPension: "Gesamte Rente",
    disclaimer: "Dieser Rentenrechner ist ein Planungstool und dient nur zu Informationszwecken. Für personalisierte Beratung konsultieren Sie bitte einen Rentenberater.",
    loading: "Lädt...",
  };

  // Build translation object by calling the translation function for each key
  const t: any = {};
  Object.keys(fallbackT).forEach((key) => {
    try {
      t[key] = tFunc(key as any);
    } catch (e) {
      t[key] = fallbackT[key as keyof typeof fallbackT];
    }
  });

  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [nettoeinkommen, setNettoeinkommen] = useState(3500);
  const [gesetzlicheRente, setGesetzlicheRente] = useState(1800);
  const [wunschrente, setWunschrente] = useState(2500);
  const [jahrgang, setJahrgang] = useState(1965);
  const [privatrente, setPrivatrente] = useState(3500);

  useEffect(() => {
    setMounted(true);
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
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900">{t.title}</h1>
          <p className="text-gray-600 mt-2">{t.subtitle}</p>
        </div>
      </div>

      <StepNav
        currentStep={currentStep}
        onBack={handleBack}
        onNext={handleNext}
        canGoNext={true}
      />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {currentStep === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <Step1Wunschrente
              nettoeinkommen={nettoeinkommen}
              gesetzlicheRente={gesetzlicheRente}
              wunschrente={wunschrente}
              jahrgang={jahrgang}
              privatrente={privatrente}
              maxIncome={8000}
              maxRente={5000}
              onNettoeinkommenChange={setNettoeinkommen}
              onWunschrenterChange={setWunschrente}
              onJahrgangChange={setJahrgang}
              onPrivatrenterChange={setPrivatrente}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 animate-fadeIn">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">{t.gapAnalysis}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <p className="text-gray-600 text-sm font-semibold mb-2">{t.desiredRetirement}</p>
                <p className="text-4xl font-bold text-blue-600">€{wunschrente.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm font-semibold mb-2">{t.statutoryPensionLabel}</p>
                <p className="text-4xl font-bold text-teal-600">€{gesetzlicheRente.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm font-semibold mb-2">{t.gap}</p>
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
                  {t.savingRecommendation}
                  {Math.round((wunschrente - gesetzlicheRente) / 20).toLocaleString()}
                  {t.savingRecommendationEnd}
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">{t.results}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-blue-50 rounded-xl p-8">
                  <p className="text-blue-600 text-sm font-semibold mb-2">{t.yearOfBirthLabel}</p>
                  <p className="text-3xl font-bold text-blue-900">{jahrgang}</p>
                  <p className="text-sm text-blue-700 mt-2">
                    {t.retirementAge}: {67 + Math.max(0, jahrgang - 1960)}
                  </p>
                </div>
                <div className="bg-teal-50 rounded-xl p-8">
                  <p className="text-teal-600 text-sm font-semibold mb-2">{t.privateSavingsLabel}</p>
                  <p className="text-3xl font-bold text-teal-900">€{privatrente.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-bold text-green-900 mb-2">{t.totalRetirement}</h3>
                <ul className="space-y-2 text-green-800">
                  <li>• {t.statutoryPensionLabel}: €{gesetzlicheRente.toLocaleString()}</li>
                  <li>• {t.privatePensionLabel}: €{privatrente.toLocaleString()}</li>
                  <li>• {t.totalPension}: €{(gesetzlicheRente + privatrente).toLocaleString()}</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          <p>{t.disclaimer}</p>
        </div>
      </footer>

      <style jsx>{`
        /* animations here if needed */
      `}</style>
    </div>
  );
}

