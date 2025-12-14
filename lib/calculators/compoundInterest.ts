/**
 * Compound Interest Calculator for Private Investments (Sparplan)
 *
 * This module is INDEPENDENT from the public pension (gesetzliche Rente).
 * It handles private savings, ETF investments, and regular contributions
 * with compound interest (Zinseszins) calculations.
 *
 * No reference to Entgeltpunkte, Rentenwert, DRV, or public pension logic.
 */

export type ContributionTiming = "end" | "begin"; // nachschüssig | vorschüssig

export interface CompoundInterestInputs {
    initialCapital: number;           // Starting capital in €
    monthlyContribution: number;      // Regular monthly contribution (PMT) in €
    annualReturnRate: number;         // Expected annual return in % (e.g., 6 for 6%)
    years: number;                    // Investment duration in years
    compoundingFrequency?: number;    // Periods per year (default: 12 = monthly)
    contributionTiming?: ContributionTiming; // "end" = nachschüssig, "begin" = vorschüssig
    inflationRate?: number;           // Optional: annual inflation in % for real value calculation
}

export interface CompoundInterestResult {
    // Nominal values (not inflation-adjusted)
    finalCapitalNominal: number;      // Final amount in nominal €

    // Real values (inflation-adjusted to today's purchasing power)
    finalCapitalReal: number;         // Final amount in today's €

    // Contribution summary
    totalContributions: number;       // Total amount paid in (initial + all monthly)
    totalInterest: number;            // Total interest earned (nominal)
    totalInterestReal: number;        // Total interest earned (real)

    // Metrics
    interestAsPercentage: number;     // Interest as % of total contributions
    effectiveAnnualReturn: number;    // Realized annual return %
}

export interface YearlyBreakdown {
    year: number;
    totalCapitalNominal: number;      // Capital at end of year (nominal)
    totalCapitalReal: number;         // Capital at end of year (real)
    contributionsToDate: number;      // Total contributions up to this year
    interestEarnedToDate: number;     // Total interest up to this year
    interestEarnedToDateReal: number; // Total interest up to this year (real)
}

/**
 * Core calculation: Future Value with regular contributions
 *
 * Formula breakdown:
 * 1. Periodic rate: r = annualReturnRate / 100 / compoundingFrequency
 * 2. Number of periods: n = years * compoundingFrequency
 * 3. FV of contributions (end-of-period):
 *    FV_contrib = PMT * ((1 + r)^n - 1) / r
 * 4. If "begin" timing: multiply FV_contrib by (1 + r) for additional period
 * 5. FV of initial capital: FV_initial = P * (1 + r)^n
 * 6. Total: FV = FV_initial + FV_contrib
 */
function calculateFutureValue(inputs: CompoundInterestInputs): {
    nominalValue: number;
    periodicRate: number;
    periods: number;
} {
    const frequency = inputs.compoundingFrequency ?? 12;
    const periodicRate = inputs.annualReturnRate / 100 / frequency;
    const periods = inputs.years * frequency;
    const timing = inputs.contributionTiming ?? "end";

    // FV of initial capital
    const fvInitial = inputs.initialCapital * Math.pow(1 + periodicRate, periods);

    // FV of monthly contributions
    let fvContrib = 0;
    if (periodicRate > 0) {
        fvContrib =
            inputs.monthlyContribution *
            ((Math.pow(1 + periodicRate, periods) - 1) / periodicRate);
    } else {
        // If rate is 0, just multiply contributions by number of periods
        fvContrib = inputs.monthlyContribution * periods;
    }

    // Adjust for contribution timing (vorschüssig = begin)
    if (timing === "begin") {
        fvContrib *= 1 + periodicRate;
    }

    const nominalValue = fvInitial + fvContrib;

    return {
        nominalValue,
        periodicRate,
        periods,
    };
}

/**
 * Apply inflation adjustment to convert nominal value to real (today's purchasing power)
 */
function adjustForInflation(
    nominalValue: number,
    inflationRate: number,
    years: number
): number {
    if (inflationRate <= 0 || years === 0) return nominalValue;
    const inflationFactor = Math.pow(1 + inflationRate / 100, years);
    return nominalValue / inflationFactor;
}

/**
 * Calculate total contributions including initial capital
 */
function calculateTotalContributions(
    initialCapital: number,
    monthlyContribution: number,
    years: number
): number {
    const frequency = 12; // Monthly contributions
    const totalMonths = years * frequency;
    return initialCapital + monthlyContribution * totalMonths;
}

/**
 * Main calculation function
 */
export function calculateCompoundInterest(
    inputs: CompoundInterestInputs
): CompoundInterestResult {
    const { nominalValue, periodicRate, periods } = calculateFutureValue(inputs);
    const inflationRate = inputs.inflationRate ?? 0;

    const totalContributions = calculateTotalContributions(
        inputs.initialCapital,
        inputs.monthlyContribution,
        inputs.years
    );

    // Interest calculations
    const totalInterestNominal = nominalValue - totalContributions;
    const totalInterestReal =
        adjustForInflation(nominalValue, inflationRate, inputs.years) -
        totalContributions;

    // Real (inflation-adjusted) value
    const finalCapitalReal = adjustForInflation(
        nominalValue,
        inflationRate,
        inputs.years
    );

    // Effective annual return
    let effectiveAnnualReturn = 0;
    if (inputs.years > 0 && totalContributions > 0) {
        // CAGR-like metric: ((FV / PV)^(1/years)) - 1
        if (nominalValue > 0 && totalContributions > 0) {
            effectiveAnnualReturn =
                (Math.pow(nominalValue / totalContributions, 1 / inputs.years) -
                    1) *
                100;
        }
    }

    return {
        finalCapitalNominal: nominalValue,
        finalCapitalReal,
        totalContributions,
        totalInterest: totalInterestNominal,
        totalInterestReal,
        interestAsPercentage:
            totalContributions > 0
                ? (totalInterestNominal / totalContributions) * 100
                : 0,
        effectiveAnnualReturn,
    };
}

/**
 * Generate year-by-year breakdown for visualization
 */
export function generateYearlyBreakdown(
    inputs: CompoundInterestInputs
): YearlyBreakdown[] {
    const frequency = inputs.compoundingFrequency ?? 12;
    const periodicRate = inputs.annualReturnRate / 100 / frequency;
    const timing = inputs.contributionTiming ?? "end";
    const inflationRate = inputs.inflationRate ?? 0;
    const breakdown: YearlyBreakdown[] = [];

    for (let year = 1; year <= inputs.years; year++) {
        const periods = year * frequency;

        // FV of initial capital
        const fvInitial =
            inputs.initialCapital * Math.pow(1 + periodicRate, periods);

        // FV of contributions for this year
        let fvContrib = 0;
        if (periodicRate > 0) {
            fvContrib =
                inputs.monthlyContribution *
                ((Math.pow(1 + periodicRate, periods) - 1) / periodicRate);
        } else {
            fvContrib = inputs.monthlyContribution * periods;
        }

        // Apply timing adjustment
        if (timing === "begin") {
            fvContrib *= 1 + periodicRate;
        }

        const totalCapitalNominal = fvInitial + fvContrib;
        const totalCapitalReal = adjustForInflation(
            totalCapitalNominal,
            inflationRate,
            year
        );
        const contributionsToDate = calculateTotalContributions(
            inputs.initialCapital,
            inputs.monthlyContribution,
            year
        );
        const interestToDate = totalCapitalNominal - contributionsToDate;
        const interestToDateReal = totalCapitalReal - contributionsToDate;

        breakdown.push({
            year,
            totalCapitalNominal,
            totalCapitalReal,
            contributionsToDate,
            interestEarnedToDate: interestToDate,
            interestEarnedToDateReal: interestToDateReal,
        });
    }

    return breakdown;
}

/**
 * Format helpers
 */
export function formatCurrency(value: number): string {
    return value.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

export function formatNumber(value: number, decimals: number = 2): string {
    return value.toLocaleString("de-DE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function formatPercentage(value: number, decimals: number = 2): string {
    return formatNumber(value, decimals) + "%";
}

