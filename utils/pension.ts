// utils/pension.ts
// Vereinfachte, aber DRV-nahe Berechnung der gesetzlichen Rente
// Alle Ergebnisse werden in heutiger Kaufkraft (inflationsbereinigt) zurückgegeben.

export type Bundesland = "west" | "east";

export interface PensionSettings {
    anspruchRente: boolean;            // Anspruch auf gesetzliche Rente?
    bundesland: Bundesland;           // West/Ost – wichtig für Rentenwert
    inflation: number;                // jährliche Inflation in %
    gehaltssteigerung: number;        // jährliche Gehaltssteigerung in % (real/nominal – vereinfacht)
    entgeltpunkteHeute: number;       // bereits erworbene Entgeltpunkte
    rentenbeginnAlter: number;        // gewünschtes Rentenalter (z. B. 67)
    rentenartFaktor: number;          // i. d. R. 1,0 für Regelaltersrente
    zugangsfaktor: number;            // 1,0 wenn keine Zu- oder Abschläge
}

// Aktueller Rentenwert (vereinfachter Stand, West≈Ost seit 2024)
// Quelle u. a. DRV / Wikipedia „Gesetzliche Rentenversicherung“  [oai_citation:0‡Wikipedia](https://de.wikipedia.org/wiki/Aktueller_Rentenwert?utm_source=chatgpt.com)
export const AKTUELLER_RENTENWERT_WEST = 39.32; // € pro Entgeltpunkt
export const AKTUELLER_RENTENWERT_OST = 39.32;  // Vereinfachung: gleicher Wert

// Beitragsbemessungsgrenze (Jahreswert, vereinfachte 2024-Größe)
export const BEITRAGSBEMESSUNGSGRENZE_WEST = 97_200;
export const BEITRAGSBEMESSUNGSGRENZE_OST = 97_200;

// Durchschnittsentgelt der Rentenversicherung (2024 ca. 45.358 € / Jahr)  [oai_citation:1‡ihre-vorsorge.de](https://www.ihre-vorsorge.de/rente/nachrichten/1500-euro-rente-nach-45-jahren-durchschnittsverdienst?utm_source=chatgpt.com)
export const DURCHSCHNITTSENTGELT = 45_358;

// Default-Einstellungen
export const DEFAULT_SETTINGS: PensionSettings = {
    anspruchRente: true,
    bundesland: "west",
    inflation: 2.0,
    gehaltssteigerung: 1.5,
    entgeltpunkteHeute: 25,          // typischer Wert mit ca. 50 Jahren
    rentenbeginnAlter: 67,
    rentenartFaktor: 1.0,
    zugangsfaktor: 1.0,
};

// Alter aus Geburtsjahr
export function getAge(birthYear: number, now: Date = new Date()): number {
    return now.getFullYear() - birthYear;
}

/**
 * Projektion zukünftiger Entgeltpunkte
 *
 * Vereinfachtes Modell:
 *  - Nettoeinkommen -> Brutto (Multiplikator)
 *  - beitragspflichtiges Einkommen = min(Brutto, Beitragsbemessungsgrenze)
 *  - Entgeltpunkte/Jahr = beitragspflichtiges Einkommen / Durchschnittsentgelt
 *  - Einkommen wächst jedes Jahr mit gehaltssteigerung %
 */
export function projectEntgeltpunkte(
    currentNetIncome: number,
    yearsUntilRetirement: number,
    gehaltssteigerung: number,
    bundesland: Bundesland,
    entgeltpunkteHeute: number,
    grossIncomeMultiplier: number = 1.3 // grobe Netto->Brutto-Umrechnung
): number {
    const bbg =
        bundesland === "west"
            ? BEITRAGSBEMESSUNGSGRENZE_WEST
            : BEITRAGSBEMESSUNGSGRENZE_OST;

    let currentAnnualGross = currentNetIncome * grossIncomeMultiplier * 12;
    let totalFutureEP = 0;

    for (let i = 0; i < yearsUntilRetirement; i++) {
        const beitragspflichtigesEinkommen = Math.min(currentAnnualGross, bbg);
        const annualEP = beitragspflichtigesEinkommen / DURCHSCHNITTSENTGELT;
        totalFutureEP += annualEP;

        // Einkommen für das nächste Jahr erhöhen
        currentAnnualGross *= 1 + gehaltssteigerung / 100;
    }

    return entgeltpunkteHeute + totalFutureEP;
}

/**
 * Gesetzliche Bruttorente nach Rentenformel:
 * Rente_brutto = EP_gesamt * Zugangsfaktor * Rentenartfaktor * aktueller Rentenwert
 * Danach Näherung auf Nettorente (~70 % der Bruttorente).
 */
export function calculateGesetzlicheRente(
    gesamtEntgeltpunkte: number,
    settings: PensionSettings
): number {
    if (!settings.anspruchRente) return 0;

    const rentenwert =
        settings.bundesland === "west"
            ? AKTUELLER_RENTENWERT_WEST
            : AKTUELLER_RENTENWERT_OST;

    const grossRente =
        gesamtEntgeltpunkte *
        settings.zugangsfaktor *
        settings.rentenartFaktor *
        rentenwert;

    // sehr grobe Annahme: ca. 70 % der Bruttorente bleiben netto
    return grossRente * 0.7;
}

export interface PensionCalculationResult {
    gesetzlicheRenteNetto: number; // bereits inflationsbereinigt (heutige Kaufkraft)
    privateRente: number;
    gesamtRente: number;           // Summe aus gesetzlich + privat (heutige Kaufkraft)
    wunschrente: number;           // Zielrente (heutige Kaufkraft)
    vorsorgeluecke: number;        // Lücke in heutiger Kaufkraft
}

/**
 * Gesamtberechnung:
 * 1. Alter + Jahre bis Rente
 * 2. Projektion Entgeltpunkte
 * 3. Gesetzliche Netto-Rente (nominal)
 * 4. Inflationsbereinigung -> heutige Kaufkraft
 * 5. Lücke zur Wunschrente
 */
export function calculateTotalPension(
    netIncomeNow: number,
    birthYear: number,
    privateRenteMonatlich: number,
    settings: PensionSettings,
    wunschrente: number = 3000
): PensionCalculationResult {
    const now = new Date();
    const currentAge = getAge(birthYear, now);
    const yearsUntilRetirement = Math.max(
        0,
        settings.rentenbeginnAlter - currentAge
    );

    // 1+2: Entgeltpunkte projizieren
    const gesamtEntgeltpunkte = projectEntgeltpunkte(
        netIncomeNow,
        yearsUntilRetirement,
        settings.gehaltssteigerung,
        settings.bundesland,
        settings.entgeltpunkteHeute
    );

    // 3: Gesetzliche Rente nominal
    const gesetzlicheRenteNominal = calculateGesetzlicheRente(
        gesamtEntgeltpunkte,
        settings
    );

    // 4: Inflation einrechnen – alles in heutige Kaufkraft umrechnen
    const inflationFactor =
        yearsUntilRetirement > 0
            ? Math.pow(1 + settings.inflation / 100, yearsUntilRetirement)
            : 1;

    const gesetzlicheRenteNetto = gesetzlicheRenteNominal / inflationFactor;

    // Private Rente und Wunschrente interpretieren wir als Werte in heutiger Kaufkraft,
    // deshalb werden sie hier NICHT erneut inflationsbereinigt.
    const gesamtRente = gesetzlicheRenteNetto + privateRenteMonatlich;
    const vorsorgeluecke = Math.max(0, wunschrente - gesamtRente);

    return {
        gesetzlicheRenteNetto,
        privateRente: privateRenteMonatlich,
        gesamtRente,
        wunschrente,
        vorsorgeluecke,
    };
}

// Format-Helper
export function formatCurrency(value: number): string {
    return value.toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

export function formatNumber(value: number, decimals: number = 1): string {
    return value.toLocaleString("de-DE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
