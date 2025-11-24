"use client";

interface StepNavProps {
  currentStep: number;
  onBack: () => void;
  onNext: () => void;
  canGoNext?: boolean;
}

/**
 * ERGO Rentenrechner - Step Navigation Bar
 * Pixel-accurate horizontal tabs with red active state
 *
 * Features:
 * - "← Zurück" button on left
 * - Centered horizontal tabs (1. Ihre Wunschrente, 2. Ihre Vorsorgelücke, 3. Ihr Ergebnis)
 * - Red active tab (#C8102E) with white underline
 * - "Weiter →" button on right
 * - Grey border-bottom for all tabs
 */
export function StepNav({
  currentStep,
  onBack,
  onNext,
  canGoNext = true,
}: StepNavProps) {
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

export default StepNav;

