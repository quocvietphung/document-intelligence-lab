/**
 * Test suite for Compound Interest Calculator
 */

import {
    calculateCompoundInterest,
    generateYearlyBreakdown,
    formatCurrency,
    formatPercentage,
    CompoundInterestInputs,
} from "./compoundInterest";

// Test Case 1: Basic calculation with monthly contributions
console.log("=== Test 1: Basic Sparplan (6% annual, 10 years) ===");
const test1: CompoundInterestInputs = {
    initialCapital: 10000,
    monthlyContribution: 500,
    annualReturnRate: 6,
    years: 10,
};
const result1 = calculateCompoundInterest(test1);
console.log("Final Capital (Nominal):", formatCurrency(result1.finalCapitalNominal));
console.log("Final Capital (Real):", formatCurrency(result1.finalCapitalReal));
console.log("Total Contributions:", formatCurrency(result1.totalContributions));
console.log("Total Interest:", formatCurrency(result1.totalInterest));
console.log("Interest %:", formatPercentage(result1.interestAsPercentage));
console.log("");

// Test Case 2: With inflation adjustment
console.log("=== Test 2: Same Sparplan with 2% inflation ===");
const test2: CompoundInterestInputs = {
    ...test1,
    inflationRate: 2,
};
const result2 = calculateCompoundInterest(test2);
console.log("Final Capital (Nominal):", formatCurrency(result2.finalCapitalNominal));
console.log("Final Capital (Real):", formatCurrency(result2.finalCapitalReal));
console.log("Real Interest:", formatCurrency(result2.totalInterestReal));
console.log("");

// Test Case 3: Beginning of period contributions (vorschüssig)
console.log("=== Test 3: Vorschüssig (begin) contributions ===");
const test3: CompoundInterestInputs = {
    ...test1,
    contributionTiming: "begin",
};
const result3 = calculateCompoundInterest(test3);
console.log("Final Capital (begin):", formatCurrency(result3.finalCapitalNominal));
console.log("Final Capital (end):", formatCurrency(result1.finalCapitalNominal));
console.log("Difference:", formatCurrency(result3.finalCapitalNominal - result1.finalCapitalNominal));
console.log("");

// Test Case 4: Zero return (no interest)
console.log("=== Test 4: Zero interest rate ===");
const test4: CompoundInterestInputs = {
    initialCapital: 10000,
    monthlyContribution: 500,
    annualReturnRate: 0,
    years: 10,
};
const result4 = calculateCompoundInterest(test4);
console.log("Final Capital:", formatCurrency(result4.finalCapitalNominal));
console.log("Total Contributions:", formatCurrency(result4.totalContributions));
console.log("Interest:", formatCurrency(result4.totalInterest));
console.log("");

// Test Case 5: Large investment over 30 years
console.log("=== Test 5: Long-term ETF investment (30 years, 7% return) ===");
const test5: CompoundInterestInputs = {
    initialCapital: 50000,
    monthlyContribution: 1000,
    annualReturnRate: 7,
    years: 30,
    inflationRate: 2,
};
const result5 = calculateCompoundInterest(test5);
console.log("Final Capital (Nominal):", formatCurrency(result5.finalCapitalNominal));
console.log("Final Capital (Real):", formatCurrency(result5.finalCapitalReal));
console.log("Total Contributions:", formatCurrency(result5.totalContributions));
console.log("Total Interest:", formatCurrency(result5.totalInterest));
console.log("Effective Annual Return:", formatPercentage(result5.effectiveAnnualReturn));
console.log("");

// Test Case 6: Yearly breakdown
console.log("=== Test 6: Yearly breakdown (first 5 years) ===");
const test6: CompoundInterestInputs = {
    initialCapital: 20000,
    monthlyContribution: 300,
    annualReturnRate: 5,
    years: 5,
};
const breakdown = generateYearlyBreakdown(test6);
breakdown.forEach((row) => {
    console.log(
        `Year ${row.year}: Capital ${formatCurrency(row.totalCapitalNominal)}, Interest ${formatCurrency(row.interestEarnedToDate)}`
    );
});

