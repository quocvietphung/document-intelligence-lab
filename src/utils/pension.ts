// German statutory pension calculation utilities
// Based on simplified Rentenformel (German pension formula)

export type Bundesland = "west" | "east";

export interface PensionSettings {
  anspruchRente: boolean; // has statutory pension entitlement
  bundesland: Bundesland; // West/East for contribution ceiling + rent value
  inflation: number; // % per year, e.g. 2.0
  gehaltssteigerung: number; // % salary growth per year, e.g. 1.5
  entgeltpunkteHeute: number; // current Entgeltpunkte
  rentenbeginnAlter: number; // retirement age, e.g. 67
  rentenartFaktor: number; // usually 1.0 for standard old-age pension
  zugangsfaktor: number; // usually 1.0 if no early/late retirement
}

// Current gross rent values per Entgeltpunkt (updated 2024-2025 estimate)
// These represent the monthly pension amount per Entgeltpunkt
export const AKTUELLER_RENTENWERT_WEST = 36.02; // € per Entgeltpunkt, West Germany
export const AKTUELLER_RENTENWERT_OST = 35.52; // € per Entgeltpunkt, East Germany (gradual equalization)

// Contribution ceiling (Beitragsbemessungsgrenze) - annual income cap for pension calculations
export const BEITRAGSBEMESSUNGSGRENZE_WEST = 97_200; // 2024 estimate, €/year
export const BEITRAGSBEMESSUNGSGRENZE_OST = 97_200; // 2024 estimate, €/year (same since 2024)

// Default settings
export const DEFAULT_SETTINGS: PensionSettings = {
  anspruchRente: true,
  bundesland: "west",
  inflation: 2.0,
  gehaltssteigerung: 1.5,
  entgeltpunkteHeute: 25, // roughly corresponds to average German career at age 50
  rentenbeginnAlter: 67,
  rentenartFaktor: 1.0,
  zugangsfaktor: 1.0,
};

/**
 * Calculate current age based on birth year
 */
export function getAge(birthYear: number, now: Date = new Date()): number {
  const currentYear = now.getFullYear();
  return currentYear - birthYear;
}

/**
 * Project future Entgeltpunkte (contribution points) based on income growth
 *
 * Simplified model:
 * - Each year, income grows by gehaltssteigerung %
 * - Annual Entgeltpunkte = (annual gross income) / BEITRAGSBEMESSUNGSGRENZE
 * - Capped at 1.0 EP per year (no double earnings can exceed 1.0 EP)
 * - Sum all future EPs and add to current entgeltpunkteHeute
 *
 * Note: This is a simplified model. The actual Rentenversicherung tracks more complex
 * factors like child-raising periods, unemployment, etc.
 */
export function projectEntgeltpunkte(
  currentNetIncome: number,
  yearsUntilRetirement: number,
  gehaltssteigerung: number,
  bundesland: Bundesland,
  entgeltpunkteHeute: number,
  grossIncomeMultiplier: number = 1.3 // rough net-to-gross conversion (includes taxes + social security)
): number {
  const bbg = bundesland === "west" ? BEITRAGSBEMESSUNGSGRENZE_WEST : BEITRAGSBEMESSUNGSGRENZE_OST;

  // Estimate annual gross income from monthly net income
  const annualGrossIncome = currentNetIncome * grossIncomeMultiplier * 12;

  let totalFutureEP = 0;
  let currentAnnualGross = annualGrossIncome;

  for (let i = 0; i < yearsUntilRetirement; i++) {
    // Generate Entgeltpunkte for this year (capped at 1.0)
    const annualEP = Math.min(currentAnnualGross / bbg, 1.0);
    totalFutureEP += annualEP;

    // Grow income for next year
    currentAnnualGross *= 1 + gehaltssteigerung / 100;
  }

  return entgeltpunkteHeute + totalFutureEP;
}

/**
 * Calculate the monthly net statutory pension (Gesetzliche Rente)
 *
 * German Rentenformel (simplified):
 * monatlicheRente = gesamtEntgeltpunkte * zugangsfaktor * rentenartFaktor * aktuellerRentenwert
 *
 * We approximate net by assuming ~70% of gross pension remains after taxes/contributions
 * (this varies with personal circumstances; a real calculation requires income tax assessment)
 */
export function calculateGesetzlicheRente(gesamtEntgeltpunkte: number, settings: PensionSettings): number {
  const rentenwert = settings.bundesland === "west" ? AKTUELLER_RENTENWERT_WEST : AKTUELLER_RENTENWERT_OST;

  if (!settings.anspruchRente) {
    return 0;
  }

  const grossRente = gesamtEntgeltpunkte * settings.zugangsfaktor * settings.rentenartFaktor * rentenwert;

  // Rough approximation: net pension is ~70% of gross (includes basic tax-free allowance + social security contributions)
  const netRente = grossRente * 0.7;

  return netRente;
}

export interface PensionCalculationResult {
  gesetzlicheRenteNetto: number;
  privateRente: number;
  gesamtRente: number;
  wunschrente: number;
  vorsorgeluecke: number;
}

/**
 * Calculate total pension including statutory and private pensions
 *
 * Steps:
 * 1. Compute age and years until retirement
 * 2. Project future Entgeltpunkte
 * 3. Calculate statutory net pension
 * 4. Add private pension
 * 5. Compare to desired pension (wunschrente) to find pension gap
 */
export function calculateTotalPension(
  netIncomeNow: number,
  birthYear: number,
  privateRenteMonatlich: number,
  settings: PensionSettings,
  wunschrente: number = 3000 // default desired pension
): PensionCalculationResult {
  const now = new Date();
  const currentAge = getAge(birthYear, now);
  const yearsUntilRetirement = Math.max(0, settings.rentenbeginnAlter - currentAge);

  // Project future Entgeltpunkte based on income growth
  const gesamtEntgeltpunkte = projectEntgeltpunkte(
    netIncomeNow,
    yearsUntilRetirement,
    settings.gehaltssteigerung,
    settings.bundesland,
    settings.entgeltpunkteHeute
  );

  // Calculate statutory net pension
  const gesetzlicheRenteNetto = calculateGesetzlicheRente(gesamtEntgeltpunkte, settings);

  // Total pension
  const gesamtRente = gesetzlicheRenteNetto + privateRenteMonatlich;

  // Pension gap
  const vorsorgeluecke = Math.max(0, wunschrente - gesamtRente);

  return {
    gesetzlicheRenteNetto,
    privateRente: privateRenteMonatlich,
    gesamtRente,
    wunschrente,
    vorsorgeluecke,
  };
}

/**
 * Format currency to German locale
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Format number with German locale (for percentages, etc.)
 */
export function formatNumber(value: number, decimals: number = 1): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

