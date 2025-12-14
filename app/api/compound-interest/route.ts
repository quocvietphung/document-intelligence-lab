import { NextResponse } from "next/server";
import {
    calculateCompoundInterest,
    generateYearlyBreakdown,
    CompoundInterestInputs,
} from "@/lib/calculators/compoundInterest";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            initialCapital,
            monthlyContribution,
            annualReturnRate,
            years,
            compoundingFrequency,
            contributionTiming,
            inflationRate,
        }: CompoundInterestInputs = body;

        // Validate required fields
        if (
            initialCapital === undefined ||
            monthlyContribution === undefined ||
            annualReturnRate === undefined ||
            years === undefined
        ) {
            return NextResponse.json(
                {
                    error: "Missing required fields: initialCapital, monthlyContribution, annualReturnRate, years",
                },
                { status: 400 }
            );
        }

        // Validate input ranges
        if (
            typeof initialCapital !== "number" ||
            initialCapital < 0 ||
            typeof monthlyContribution !== "number" ||
            monthlyContribution < 0 ||
            typeof annualReturnRate !== "number" ||
            typeof years !== "number" ||
            years <= 0
        ) {
            return NextResponse.json(
                {
                    error: "Invalid input values. Check types and ranges.",
                },
                { status: 400 }
            );
        }

        const inputs: CompoundInterestInputs = {
            initialCapital,
            monthlyContribution,
            annualReturnRate,
            years,
            compoundingFrequency: compoundingFrequency ?? 12,
            contributionTiming: contributionTiming ?? "end",
            inflationRate: inflationRate ?? 0,
        };

        // Calculate results
        const result = calculateCompoundInterest(inputs);
        const breakdown = generateYearlyBreakdown(inputs);

        return NextResponse.json(
            {
                success: true,
                data: {
                    inputs,
                    result,
                    breakdown,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Compound Interest API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

