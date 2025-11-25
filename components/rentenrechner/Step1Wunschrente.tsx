"use client";

import { useRef, useCallback, useState } from "react";
import {
    calcVorsorgeluecke,
    getAge,
    calculatePension,
    RENT_CONSTANTS,
    SETTINGS_DEFAULTS,
    PensionSettings,
} from "@/utils/renteCalculator";

interface Step1WunschrrenteProps {
    nettoeinkommen: number;
    gesetzlicheRente?: number;
    wunschrente: number;
    jahrgang: number;
    privatrente: number;
    maxIncome: number;
    maxRente: number;
    onNettoeinkommenChange: (value: number) => void;
    onWunschrenterChange: (value: number) => void;
    onJahrgangChange: (value: number) => void;
    onPrivatrenterChange: (value: number) => void;
}

/**
 * ERGO Rentenrechner - Step 1: "Ihre Wunschrente"
 *
 * - 2-Block-Chart: grauer Einkommensblock + grüner Rentenblock
 * - rote Wunschrenten-Linie (draggable)
 * - Vorsorgelücke-Anzeige
 * - Einstellungen-Panel (Inflation, Gehaltssteigerung, Bundesland, Entgeltpunkte)
 * - Timeline & Slider (Jahrgang, private Rente)
 */
export function Step1Wunschrente({
                                     nettoeinkommen,
                                     gesetzlicheRente: _,
                                     wunschrente,
                                     jahrgang,
                                     privatrente,
                                     maxIncome,
                                     maxRente,
                                     onNettoeinkommenChange,
                                     onWunschrenterChange,
                                     onJahrgangChange,
                                     onPrivatrenterChange,
                                 }: Step1WunschrrenteProps) {
    // ===== SETTINGS STATE =====
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<PensionSettings>(SETTINGS_DEFAULTS);

    // ===== REFS =====
    // chartRef = toàn bộ vùng chart để dùng cho drag (đúng kiểu ERGO)
    const chartRef = useRef<HTMLDivElement>(null);
    const incomeBlockRef = useRef<HTMLDivElement>(null);
    const wunschrenterLineRef = useRef<HTMLDivElement>(null);

    // ===== CALCULATION =====
    const age = getAge(jahrgang);
    const yearsUntilRetirement = Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age);

    // Clamp Wunschrente tối thiểu bằng gesetzliche Rente
    const calculation = calculatePension(nettoeinkommen, wunschrente, privatrente, jahrgang, settings);
    const computedGesetzlicheRente = calculation.nettoRente;
    const clampedWunschrente = Math.max(computedGesetzlicheRente, wunschrente);

    // Chart percentages (clamp 0–100)
    const incomePercentage = Math.min(100, (nettoeinkommen / maxIncome) * 100);
    const gesetzlichePercentage = Math.min(100, (computedGesetzlicheRente / maxRente) * 100);
    const wunschePercentage = Math.min(100, (clampedWunschrente / maxRente) * 100);

    // Vorsorgelücke theo Wunschrente đã clamp
    const vorsorgeluecke = calcVorsorgeluecke(clampedWunschrente, computedGesetzlicheRente, privatrente);

    // ===== DRAG CORE =====
    const updateFromClientX = useCallback(
        (clientX: number, maxValue: number, onValueChange: (value: number) => void) => {
            const container = chartRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const percentage = x / rect.width;
            const rawValue = Math.round(percentage * maxValue);
            const value = Math.max(0, Math.min(maxValue, rawValue));
            onValueChange(value);
        },
        []
    );

    const startDrag = useCallback(
        (maxValue: number, onValueChange: (value: number) => void) => {
            const container = chartRef.current;
            if (!container) return;

            const handleMouseMove = (e: MouseEvent) => {
                updateFromClientX(e.clientX, maxValue, onValueChange);
            };

            const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        },
        [updateFromClientX]
    );

    // ===== INCOME BLOCK HANDLERS =====
    const handleIncomeBlockClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientX(e.clientX, maxIncome, onNettoeinkommenChange);
        },
        [updateFromClientX, maxIncome, onNettoeinkommenChange]
    );

    const handleIncomeBlockDragStart = useCallback(() => {
        startDrag(maxIncome, onNettoeinkommenChange);
    }, [startDrag, maxIncome, onNettoeinkommenChange]);

    // ===== WUNSCHRENTE LINE HANDLERS =====
    const handleWunschrenterLineClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientX(e.clientX, maxRente, (val) => {
                const clamped = Math.max(computedGesetzlicheRente, val);
                onWunschrenterChange(clamped);
            });
        },
        [updateFromClientX, maxRente, computedGesetzlicheRente, onWunschrenterChange]
    );

    const handleWunschrenterLineDragStart = useCallback(() => {
        startDrag(maxRente, (val) => {
            const clamped = Math.max(computedGesetzlicheRente, val);
            onWunschrenterChange(clamped);
        });
    }, [startDrag, maxRente, computedGesetzlicheRente, onWunschrenterChange]);

    // ===== SETTINGS HANDLERS =====
    const handleSettingsChange = useCallback(
        <K extends keyof PensionSettings>(key: K, value: PensionSettings[K]) => {
            setSettings((prev) => ({
                ...prev,
                [key]: value,
            }));
        },
        []
    );

    const handleResetSettings = useCallback(() => {
        setSettings(SETTINGS_DEFAULTS);
    }, []);

    // ===== RENDER =====
    return (
        <div className="space-y-8">
            {/* TITLE */}
            <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen
                        </h2>
                        <p className="text-sm text-gray-600 mt-2">
                            Alter: <span className="font-semibold">{age}</span> Jahre · Rentenbeginn in{" "}
                            <span className="font-semibold">{yearsUntilRetirement}</span> Jahren
                        </p>
                    </div>
                    <button
                        onClick={() => setShowSettings((prev) => !prev)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Einstellungen
                    </button>
                </div>
            </div>

            {/* SETTINGS PANEL */}
            {showSettings && (
                <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Einstellungen</h3>

                    {/* Anspruch Rente */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Anspruch auf gesetzliche Rente</span>
                        <button
                            onClick={() => handleSettingsChange("anspruchRente", !settings.anspruchRente)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.anspruchRente ? "bg-green-500" : "bg-gray-300"
                            }`}
                        >
              <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.anspruchRente ? "translate-x-6" : "translate-x-1"
                  }`}
              />
                        </button>
                    </div>

                    {/* Inflation */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">Inflation (%)</span>
                            <span className="text-sm font-semibold text-gray-900">
                {settings.inflation.toFixed(1).replace(".", ",")}%
              </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.1}
                            value={settings.inflation}
                            onChange={(e) => handleSettingsChange("inflation", parseFloat(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                        />
                    </div>

                    {/* Gehaltssteigerung */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">Gehaltssteigerung (%)</span>
                            <span className="text-sm font-semibold text-gray-900">
                {settings.gehaltssteigerung.toFixed(1).replace(".", ",")}%
              </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.1}
                            value={settings.gehaltssteigerung}
                            onChange={(e) => handleSettingsChange("gehaltssteigerung", parseFloat(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                        />
                    </div>

                    {/* Bundesland */}
                    <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">Bundesland</span>
                        <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
                            <button
                                type="button"
                                onClick={() => handleSettingsChange("bundesland", "west")}
                                className={`px-4 py-2 text-sm ${
                                    settings.bundesland === "west"
                                        ? "bg-gray-900 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                West
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSettingsChange("bundesland", "east")}
                                className={`px-4 py-2 text-sm border-l border-gray-200 ${
                                    settings.bundesland === "east"
                                        ? "bg-gray-900 text-white"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                Ost
                            </button>
                        </div>
                    </div>

                    {/* Entgeltpunkte heute */}
                    <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">Entgeltpunkte heute</span>
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={settings.entgeltpunktHeute}
                            onChange={(e) => handleSettingsChange("entgeltpunktHeute", parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={handleResetSettings}
                        className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Eingaben zurücksetzen
                    </button>
                </div>
            )}

            {/* 2-BLOCK-CHART */}
            <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                <div className="space-y-5">
                    {/* Header row */}
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                Monatliches Nettoeinkommen
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                                €{nettoeinkommen.toLocaleString("de-DE")}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                                Gesetzliche Rente (netto)
                            </p>
                            <p className="text-2xl font-bold text-green-700">
                                €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
                            </p>
                        </div>
                    </div>

                    {/* Chart container */}
                    <div
                        ref={chartRef}
                        className="relative h-32 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                    >
                        {/* Income block (left, grey) */}
                        <div
                            ref={incomeBlockRef}
                            className="absolute left-0 top-0 bottom-0 cursor-grab active:cursor-grabbing shadow-sm flex items-center justify-center"
                            style={{
                                width: `${Math.max(incomePercentage, 5)}%`,
                                minWidth: "56px",
                                backgroundColor: "#B8BCC5",
                            }}
                            onClick={handleIncomeBlockClick}
                        >
                            {/* Handle (right edge) */}
                            <div
                                className="absolute right-0 top-0 bottom-0 w-3 bg-black cursor-grab active:cursor-grabbing"
                                onMouseDown={handleIncomeBlockDragStart}
                            />
                            {incomePercentage > 12 && (
                                <span className="text-xs font-bold text-white px-2 truncate">
                  €{nettoeinkommen.toLocaleString("de-DE")}
                </span>
                            )}
                        </div>

                        {/* Gesetzliche Rente block (right, green) */}
                        <div
                            className="absolute right-0 top-0 bottom-0 shadow-sm flex items-center justify-center"
                            style={{
                                width: `${Math.max(gesetzlichePercentage, 5)}%`,
                                minWidth: "56px",
                                backgroundColor: "#4DB783",
                            }}
                        >
                            {/* handle (left edge, just optische) */}
                            <div className="absolute left-0 top-0 bottom-0 w-3 bg-black" />
                            {gesetzlichePercentage > 12 && (
                                <span className="text-xs font-bold text-white px-2 truncate">
                  €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
                </span>
                            )}
                        </div>

                        {/* Wunschrente line (red, draggable) */}
                        <div
                            ref={wunschrenterLineRef}
                            className="absolute top-0 bottom-0 w-[3px] bg-red-600 cursor-grab active:cursor-grabbing hover:w-1.5 transition-all"
                            style={{ left: `${wunschePercentage}%` }}
                            onClick={handleWunschrenterLineClick}
                            onMouseDown={handleWunschrenterLineDragStart}
                        />
                    </div>

                    {/* Wunschrente */}
                    <div className="text-right">
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Wunschrente</p>
                        <p className="text-lg font-bold text-red-600">
                            €{Math.round(clampedWunschrente).toLocaleString("de-DE")}
                        </p>
                    </div>

                    {/* Vorsorgelücke */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Vorsorgelücke</p>
                        <p className={`text-sm font-bold ${vorsorgeluecke > 0 ? "text-red-600" : "text-green-600"}`}>
                            €{Math.round(vorsorgeluecke).toLocaleString("de-DE")}
                        </p>
                    </div>
                </div>
            </div>

            {/* TIMELINE */}
            <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-gray-600">0 € — Heute</span>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex-1 h-px bg-gray-300" />
                        <div className="mx-3 w-3 h-3 rounded-full bg-black" />
                        <div className="flex-1 h-px bg-gray-300" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 text-right">
            Rentenbeginn {RENT_CONSTANTS.RETIREMENT_AGE} Jahre
          </span>
                </div>
            </div>

            {/* SLIDERS */}
            <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-200 space-y-6">
                {/* Jahrgang */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-gray-700">Jahrgang</label>
                        <span className="text-sm font-bold text-gray-900">{jahrgang}</span>
                    </div>
                    <input
                        type="range"
                        min={1940}
                        max={2005}
                        value={jahrgang}
                        onChange={(e) => onJahrgangChange(parseInt(e.target.value, 10))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, #C8102E 0%, #C8102E ${
                                ((jahrgang - 1940) / (2005 - 1940)) * 100
                            }%, #fee2e2 ${((jahrgang - 1940) / (2005 - 1940)) * 100}%, #fee2e2 100%)`,
                        }}
                    />
                </div>

                {/* Private Rente */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-gray-700">Angesparte private Rente</label>
                        <span className="text-sm font-bold text-gray-900">
              €{privatrente.toLocaleString("de-DE")}
            </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={10000}
                        step={100}
                        value={privatrente}
                        onChange={(e) => onPrivatrenterChange(parseInt(e.target.value, 10))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        style={{
                            background: `linear-gradient(to right, #9ca3af 0%, #9ca3af ${
                                (privatrente / 10000) * 100
                            }%, #e5e7eb ${(privatrente / 10000) * 100}%, #e5e7eb 100%)`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default Step1Wunschrente;
