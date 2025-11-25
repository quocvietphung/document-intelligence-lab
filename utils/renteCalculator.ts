/**
 * ERGO Rentenrechner - Pure calculation utilities
 * Based on official DRV (Deutsche Rentenversicherung) formulas
 * No React or UI code - only pure math
 */

// Constants based on DRV official values
export const RENT_CONSTANTS = {
  AVERAGE_INCOME: 45358, // Durchschnittsentgelt 2024
  RENTENWERT_WEST: 37.6, // Current pension value (West)
  RENTENWERT_OST: 35.8, // Current pension value (East)
  RETIREMENT_AGE: 67, // Standard retirement age
  TAX_RATE_PENSION: 0.19, // Average tax on pension income (approximate)
  SOCIAL_SECURITY_RATE: 0.08, // Approximate social security contribution
} as const;

// Settings defaults
export const SETTINGS_DEFAULTS = {
  anspruchRente: true,
  inflation: 2.0,
  gehaltssteigerung: 2.0,
  bundesland: "west" as "west" | "east",
  entgeltpunktHeute: 0,
} as const;

/**
 * Calculate current age from year of birth
 * @param jahrgang - Year of birth
 * @returns Current age as a number
 */
export function getAge(jahrgang: number): number {
  const currentYear = new Date().getFullYear();
  return currentYear - jahrgang;
}

/**
 * Calculate Entgeltpunkte (EP) per year based on annual income
 * Formula: EP = income / averageIncome
 * @param incomeYearly - Annual income in EUR
 * @param averageIncome - Average income reference (default: AVERAGE_INCOME)
 * @returns Entgeltpunkte per year
 */
export function calcEPPerYear(
  incomeYearly: number,
  averageIncome: number = RENT_CONSTANTS.AVERAGE_INCOME
): number {
  if (averageIncome === 0) return 0;
  return incomeYearly / averageIncome;
}

/**
 * Calculate total Entgeltpunkte at retirement based on years until retirement
 * Formula: Future EP = EP_per_year * (retirementAge - currentAge)
 * @param epPerYear - Entgeltpunkte earned per year
 * @param jahrgang - Year of birth
 * @param retirementAge - Target retirement age (default: 67)
 * @returns Total Entgeltpunkte by retirement age
 */
export function calcFutureEP(
  epPerYear: number,
  jahrgang: number,
  retirementAge: number = RENT_CONSTANTS.RETIREMENT_AGE
): number {
  const age = getAge(jahrgang);
  const yearsUntilRetirement = Math.max(0, retirementAge - age);
  return epPerYear * yearsUntilRetirement + (age * epPerYear); // Include past contributions
}

/**
 * Calculate gross pension benefit
 * Formula: Rente (gross) = Entgeltpunkte * Rentenwert
 * @param epTotal - Total Entgeltpunkte
 * @param rentenwert - Pension value per EP (default: RENTENWERT_WEST)
 * @returns Monthly gross pension in EUR
 */
export function calcGrossRente(
  epTotal: number,
  rentenwert: number = RENT_CONSTANTS.RENTENWERT_WEST
): number {
  return epTotal * rentenwert;
}

/**
 * Calculate net pension after taxes and social security
 * Approximate formula based on typical tax brackets
 * @param grossRente - Gross pension benefit
 * @param taxRate - Tax rate (default: TAX_RATE_PENSION)
 * @returns Monthly net pension in EUR
 */
export function calcNettoRente(
  grossRente: number,
  taxRate: number = RENT_CONSTANTS.TAX_RATE_PENSION
): number {
  // Simplified: deduct tax and social security
  const taxAmount = grossRente * taxRate;
  const socialSecurityAmount = grossRente * RENT_CONSTANTS.SOCIAL_SECURITY_RATE;
  return Math.max(0, grossRente - taxAmount - socialSecurityAmount);
}

/**
 * Calculate Vorsorgelücke (pension gap)
 * Formula: Gap = WunschRente - (GesetzlicheRente + PrivateRente)
 * @param wunsch - Desired monthly pension
 * @param gesetzlich - Legal/statutory pension (netto)
 * @param privat - Private savings converted to monthly pension
 * @returns Monthly pension gap in EUR (0 if no gap)
 */
export function calcVorsorgeluecke(
  wunsch: number,
  gesetzlich: number,
  privat: number = 0
): number {
  const totalAvailable = gesetzlich + privat;
  return Math.max(0, wunsch - totalAvailable);
}

/**
 * Get rentenwert based on federal state
 */
export function getRentenwert(bundesland: "west" | "east"): number {
  return bundesland === "west" ? RENT_CONSTANTS.RENTENWERT_WEST : RENT_CONSTANTS.RENTENWERT_OST;
}

/**
 * Calculate future income with salary growth
 */
export function calcFutureIncome(
  currentIncome: number,
  yearsToRetirement: number,
  salaryGrowthPercent: number = 2.0
): number {
  return currentIncome * Math.pow(1 + salaryGrowthPercent / 100, yearsToRetirement);
}

/**
 * Calculate total entgeltpunkte including today's points
 */
export function calcTotalEP(
  epPerYear: number,
  yearsToRetirement: number,
  entgeltpunktHeute: number = 0
): number {
  return entgeltpunktHeute + epPerYear * yearsToRetirement;
}

/**
 * Comprehensive pension calculation with all settings
 */
export interface PensionCalculation {
  epPerYear: number;
  totalEP: number;
  grossRente: number;
  nettoRente: number;
  vorsorgeluecke: number;
  futureIncome: number;
}

export function calculatePension(
  nettoeinkommen: number,
  wunschrente: number,
  privatrente: number,
  jahrgang: number,
  settings: {
    inflation?: number;
    gehaltssteigerung?: number;
    bundesland?: "west" | "east";
    entgeltpunktHeute?: number;
    anspruchRente?: boolean;
  } = {}
): PensionCalculation {
  const {
    inflation = 2.0,
    gehaltssteigerung = 2.0,
    bundesland = "west",
    entgeltpunktHeute = 0,
    anspruchRente = true,
  } = settings;

  const age = getAge(jahrgang);
  const yearsToRetirement = Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age);

  // Calculate annual income
  const annualIncome = nettoeinkommen * 12;

  // Calculate future income with salary growth
  const futureIncome = calcFutureIncome(annualIncome, yearsToRetirement, gehaltssteigerung);

  // Calculate EP per year (future average)
  const futureAverageIncome = RENT_CONSTANTS.AVERAGE_INCOME * Math.pow(1 + inflation / 100, yearsToRetirement);
  const epPerYear = futureIncome / futureAverageIncome;

  // Calculate total EP
  const totalEP = calcTotalEP(epPerYear, yearsToRetirement, entgeltpunktHeute);

  // Get rentenwert based on bundesland
  const rentenwert = getRentenwert(bundesland);

  // Calculate gross rente
  const grossRente = totalEP * rentenwert;

  // Calculate net rente (92% of gross for non-anspruch, adjusted for taxes)
  const adjustedGrossRente = anspruchRente ? grossRente : grossRente * 0.92;
  const nettoRente = adjustedGrossRente * (1 - RENT_CONSTANTS.TAX_RATE_PENSION - RENT_CONSTANTS.SOCIAL_SECURITY_RATE);

  // Calculate gap
  const vorsorgeluecke = calcVorsorgeluecke(wunschrente, nettoRente, privatrente);

  return {
    epPerYear,
    totalEP,
    grossRente,
    nettoRente: Math.max(0, nettoRente),
    vorsorgeluecke,
    futureIncome,
  };
}



