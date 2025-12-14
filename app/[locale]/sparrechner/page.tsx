"use client";

import CompoundInterestCalculator from "@/components/calculators/CompoundInterestCalculator";

export default function SparrechnerPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <CompoundInterestCalculator />
            </div>
        </div>
    );
}

