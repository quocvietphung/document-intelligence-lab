/**
 * ERGO Rentenrechner - Pure calculation utilities
 * Bám theo logic của Deutsche Rentenversicherung,
 * chỉ dùng toán học, không chứa React/UI.
 */

export type Bundesland = "west" | "east";

export interface PensionSettings {
    anspruchRente: boolean;
    inflation: number;        // % p.a.
    gehaltssteigerung: number; // % p.a.
    bundesland: Bundesland;
    entgeltpunktHeute: number;
}

// Hằng số (có thể update theo từng năm)
export const RENT_CONSTANTS = {
    AVERAGE_INCOME: 45358,      // Durchschnittsentgelt (€/Jahr)
    RENTENWERT_WEST: 37.6,      // Rentenwert West (€/EP)
    RENTENWERT_OST: 37.6,       // Từ 07/2024 gần như đồng nhất
    RETIREMENT_AGE: 67,
    TAX_RATE_PENSION: 0.19,     // Thuế ước lượng
    SOCIAL_SECURITY_RATE: 0.08, // KVdR + PVdR ước lượng
} as const;

export const SETTINGS_DEFAULTS: PensionSettings = {
    anspruchRente: true,
    inflation: 2.0,
    gehaltssteigerung: 2.0,
    bundesland: "west",
    entgeltpunktHeute: 0,
};

/** Tuổi hiện tại */
export function getAge(jahrgang: number): number {
    const currentYear = new Date().getFullYear();
    return currentYear - jahrgang;
}

/** EP mỗi năm: Einkommen / Durchschnittsentgelt */
export function calcEPPerYear(
    incomeYearly: number,
    averageIncome: number = RENT_CONSTANTS.AVERAGE_INCOME
): number {
    if (averageIncome <= 0) return 0;
    return incomeYearly / averageIncome;
}

/** EP tương lai (đơn giản) */
export function calcFutureEP(
    epPerYear: number,
    jahrgang: number,
    retirementAge: number = RENT_CONSTANTS.RETIREMENT_AGE
): number {
    const age = getAge(jahrgang);
    const yearsUntilRetirement = Math.max(0, retirementAge - age);
    return epPerYear * yearsUntilRetirement;
}

/** Lương hưu BRUTTO = EP * Rentenwert */
export function calcGrossRente(
    epTotal: number,
    rentenwert: number = RENT_CONSTANTS.RENTENWERT_WEST
): number {
    return epTotal * rentenwert;
}

/** Lương hưu NETTO (trừ thuế + bảo hiểm, ước lượng) */
export function calcNettoRente(
    grossRente: number,
    taxRate: number = RENT_CONSTANTS.TAX_RATE_PENSION
): number {
    const taxAmount = grossRente * taxRate;
    const socialSecurityAmount = grossRente * RENT_CONSTANTS.SOCIAL_SECURITY_RATE;
    return Math.max(0, grossRente - taxAmount - socialSecurityAmount);
}

/** Vorsorgelücke = Wunsch – (Gesetzlich + Privat), không âm */
export function calcVorsorgeluecke(
    wunsch: number,
    gesetzlich: number,
    privat: number = 0
): number {
    const totalAvailable = gesetzlich + privat;
    return Math.max(0, wunsch - totalAvailable);
}

/** Lấy Rentenwert theo Bundesland */
export function getRentenwert(bundesland: Bundesland): number {
    return bundesland === "west"
        ? RENT_CONSTANTS.RENTENWERT_WEST
        : RENT_CONSTANTS.RENTENWERT_OST;
}

/** Thu nhập cuối cùng trước nghỉ hưu với Gehaltssteigerung (không dùng cho EP loop, chỉ để info) */
export function calcFutureIncome(
    currentIncomeYearly: number,
    yearsToRetirement: number,
    salaryGrowthPercent: number = 2.0
): number {
    return currentIncomeYearly * Math.pow(1 + salaryGrowthPercent / 100, yearsToRetirement);
}

/** Đơn giản hoá: tổng EP = EP_heute + EP_per_year * years */
export function calcTotalEP(
    epPerYear: number,
    yearsToRetirement: number,
    entgeltpunktHeute: number = 0
): number {
    return entgeltpunktHeute + epPerYear * yearsToRetirement;
}

export interface PensionCalculation {
    epPerYear: number;
    totalEP: number;
    grossRente: number;
    nettoRente: number;
    vorsorgeluecke: number;
    futureIncome: number; // thu nhập năm cuối cùng trước nghỉ hưu
}

/**
 * Hàm tính tổng hợp Rente với các setting:
 * - Netto-Einkommen hiện tại
 * - Wunschrente
 * - private Rente
 * - Jahrgang
 * - Inflation, Gehaltssteigerung, Bundesland, Entgeltpunkte heute, AnspruchRente
 */
export function calculatePension(
    nettoeinkommen: number,
    wunschrente: number,
    privatrente: number,
    jahrgang: number,
    partialSettings: Partial<PensionSettings> = {}
): PensionCalculation {
    const settings: PensionSettings = { ...SETTINGS_DEFAULTS, ...partialSettings };

    const age = getAge(jahrgang);
    const yearsToRetirement = Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age);

    // Thu nhập năm đầu (netto, đơn giản hoá – thực tế nên dùng brutto)
    const startAnnualIncome = nettoeinkommen * 12;

    const incomeGrowthFactor = 1 + settings.gehaltssteigerung / 100;
    const inflationFactor = 1 + settings.inflation / 100;

    let annualIncome = startAnnualIncome;
    let averageIncome = RENT_CONSTANTS.AVERAGE_INCOME;
    let totalEPFromNow = 0;

    // Loop từng năm đến khi nghỉ hưu:
    for (let year = 0; year < yearsToRetirement; year++) {
        totalEPFromNow += calcEPPerYear(annualIncome, averageIncome);
        annualIncome *= incomeGrowthFactor;
        averageIncome *= inflationFactor;
    }

    const totalEP = settings.entgeltpunktHeute + totalEPFromNow;
    const rentenwert = getRentenwert(settings.bundesland);

    const grossRente = calcGrossRente(totalEP, rentenwert);

    // Nếu không có AnspruchRente (ví dụ: không đóng GRV đủ), giảm đi 8% (chỉ ước lượng, giống ERGO style)
    let adjustedGrossRente = grossRente;
    if (!settings.anspruchRente) {
        adjustedGrossRente *= 0.92;
    }

    const nettoRente = calcNettoRente(adjustedGrossRente);
    const gap = calcVorsorgeluecke(wunschrente, nettoRente, privatrente);

    return {
        epPerYear: yearsToRetirement > 0 ? totalEPFromNow / yearsToRetirement : 0,
        totalEP,
        grossRente,
        nettoRente,
        vorsorgeluecke: gap,
        futureIncome: annualIncome, // thu nhập năm cuối cùng
    };
}
