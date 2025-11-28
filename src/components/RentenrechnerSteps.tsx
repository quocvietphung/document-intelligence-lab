"use client";

import React, { useState } from "react";
import PensionStep1 from "./PensionStep1";
import PensionStep2 from "./PensionStep2";

interface Step1Data {
  netIncome: number;
  privateRente: number;
  birthYear: number;
  wunschrente: number;
}

const RentenrechnerSteps: React.FC = () => {
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Data>({
    netIncome: 2500,
    privateRente: 200,
    birthYear: 1975,
    wunschrente: 3000,
  });

  // Callback from PensionStep1 to update step1Data
  const handleStep1DataChange = (data: Partial<Step1Data>) => {
    setStep1Data((prev) => ({ ...prev, ...data }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-gray-300">
          <button
            onClick={() => setActiveStep(1)}
            className={`px-6 py-3 font-semibold transition-all ${
              activeStep === 1
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[2px]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Schritt 1: Berechnung
          </button>
          <button
            onClick={() => setActiveStep(2)}
            className={`px-6 py-3 font-semibold transition-all ${
              activeStep === 2
                ? "text-blue-600 border-b-2 border-blue-600 -mb-[2px]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Schritt 2: Vorsorgeplanung
          </button>
        </div>

        {/* Step 1 */}
        {activeStep === 1 && (
          <PensionStep1
            initialNetIncome={step1Data.netIncome}
            initialPrivateRente={step1Data.privateRente}
            initialBirthYear={step1Data.birthYear}
            initialWunschrente={step1Data.wunschrente}
            maxIncome={5000}
            maxRente={5000}
            onDataChange={handleStep1DataChange}
            onStepComplete={() => setActiveStep(2)}
          />
        )}

        {/* Step 2 */}
        {activeStep === 2 && (
          <PensionStep2
            netIncome={step1Data.netIncome}
            birthYear={step1Data.birthYear}
            existingPrivateRente={step1Data.privateRente}
            wunschrente={step1Data.wunschrente}
            onBack={() => setActiveStep(1)}
          />
        )}
      </div>
    </div>
  );
};

export default RentenrechnerSteps;

