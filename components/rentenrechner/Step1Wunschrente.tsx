"use client";

import { useCallback, useRef, useState } from "react";
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
    // ===== SETTINGS =====
    const [settings, setSettings] = useState<PensionSettings>(SETTINGS_DEFAULTS);
    const [showSettings, setShowSettings] = useState(false);

    // ===== REFS (riêng cho mỗi “biểu đồ”) =====
    const incomeTrackRef = useRef<HTMLDivElement>(null);
    const wunschTrackRef = useRef<HTMLDivElement>(null);

    // ===== CALCULATION =====
    const age = getAge(jahrgang);
    const yearsUntilRetirement = Math.max(
        0,
        RENT_CONSTANTS.RETIREMENT_AGE - age
    );

    const calc = calculatePension(
        nettoeinkommen,
        wunschrente,
        privatrente,
        jahrgang,
        settings
    );
    const computedGesetzlicheRente = calc.nettoRente;
    const clampedWunschrente = Math.max(computedGesetzlicheRente, wunschrente);

    const incomePercentage = Math.min(100, (nettoeinkommen / maxIncome) * 100);
    const gesetzlichePercentage = Math.min(
        100,
        (computedGesetzlicheRente / maxRente) * 100
    );
    const wunschePercentage = Math.min(
        100,
        (clampedWunschrente / maxRente) * 100
    );

    const vorsorgeluecke = calcVorsorgeluecke(
        clampedWunschrente,
        computedGesetzlicheRente,
        privatrente
    );

    // phần trăm bên trong khối Wunschrente (Gesetzliche + private)
    const wunschScale = clampedWunschrente || 1;
    const gesetzInnerPct = Math.min(
        100,
        (computedGesetzlicheRente / wunschScale) * 100
    );
    const privateInnerPct = Math.min(
        100 - gesetzInnerPct,
        (privatrente / wunschScale) * 100
    );

    // ===== DRAG CORE (truyền container riêng) =====
    const updateFromClientX = useCallback(
        (
            container: HTMLDivElement | null,
            clientX: number,
            maxValue: number,
            onValueChange: (v: number) => void
        ) => {
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const percentage = x / rect.width;
            const raw = Math.round(percentage * maxValue);
            const value = Math.max(0, Math.min(maxValue, raw));
            onValueChange(value);
        },
        []
    );

    const startDrag = useCallback(
        (
            container: HTMLDivElement | null,
            maxValue: number,
            onValueChange: (v: number) => void
        ) => {
            if (!container) return;

            const handleMove = (e: MouseEvent) => {
                updateFromClientX(container, e.clientX, maxValue, onValueChange);
            };
            const handleUp = () => {
                document.removeEventListener("mousemove", handleMove);
                document.removeEventListener("mouseup", handleUp);
            };

            document.addEventListener("mousemove", handleMove);
            document.addEventListener("mouseup", handleUp);
        },
        [updateFromClientX]
    );

    // ===== HANDLERS =====
    const handleIncomeClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientX(
                incomeTrackRef.current,
                e.clientX,
                maxIncome,
                onNettoeinkommenChange
            );
        },
        [updateFromClientX, maxIncome, onNettoeinkommenChange]
    );

    const handleIncomeDragStart = useCallback(() => {
        startDrag(incomeTrackRef.current, maxIncome, onNettoeinkommenChange);
    }, [startDrag, maxIncome, onNettoeinkommenChange]);

    const handleWunschClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientX(wunschTrackRef.current, e.clientX, maxRente, (val) => {
                const clamped = Math.max(computedGesetzlicheRente, val);
                onWunschrenterChange(clamped);
            });
        },
        [updateFromClientX, maxRente, computedGesetzlicheRente, onWunschrenterChange]
    );

    const handleWunschDragStart = useCallback(() => {
        startDrag(wunschTrackRef.current, maxRente, (val) => {
            const clamped = Math.max(computedGesetzlicheRente, val);
            onWunschrenterChange(clamped);
        });
    }, [startDrag, maxRente, computedGesetzlicheRente, onWunschrenterChange]);

    const handleSettingsChange = useCallback(
        <K extends keyof PensionSettings>(key: K, value: PensionSettings[K]) => {
            setSettings((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    const handleResetSettings = () => setSettings(SETTINGS_DEFAULTS);

    // ===== UI =====
    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Alter: <span className="font-semibold">{age}</span> Jahre ·
                        Rentenbeginn in{" "}
                        <span className="font-semibold">{yearsUntilRetirement}</span> Jahren
                    </p>
                </div>
                <button
                    onClick={() => setShowSettings((s) => !s)}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                    Einstellungen
                </button>
            </div>

            {/* SETTINGS PANEL */}
            {showSettings && (
                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">Einstellungen</h3>

                    {/* Anspruch Rente */}
                    <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Anspruch auf gesetzliche Rente
            </span>
                        <button
                            onClick={() =>
                                handleSettingsChange("anspruchRente", !settings.anspruchRente)
                            }
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
                        <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-700">Inflation</span>
                            <span className="text-sm font-semibold">
                {settings.inflation.toFixed(1).replace(".", ",")} %
              </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.1}
                            value={settings.inflation}
                            onChange={(e) =>
                                handleSettingsChange("inflation", parseFloat(e.target.value))
                            }
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                            style={{
                                background: `linear-gradient(to right, #111827 0%, #111827 ${
                                    settings.inflation * 10
                                }%, #e5e7eb ${settings.inflation * 10}%, #e5e7eb 100%)`,
                            }}
                        />
                    </div>

                    {/* Gehaltssteigerung */}
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-700">Gehaltssteigerung</span>
                            <span className="text-sm font-semibold">
                {settings.gehaltssteigerung.toFixed(1).replace(".", ",")} %
              </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={10}
                            step={0.1}
                            value={settings.gehaltssteigerung}
                            onChange={(e) =>
                                handleSettingsChange(
                                    "gehaltssteigerung",
                                    parseFloat(e.target.value)
                                )
                            }
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                            style={{
                                background: `linear-gradient(to right, #111827 0%, #111827 ${
                                    settings.gehaltssteigerung * 10
                                }%, #e5e7eb ${settings.gehaltssteigerung * 10}%, #e5e7eb 100%)`,
                            }}
                        />
                    </div>

                    {/* Bundesland */}
                    <div>
                        <span className="text-sm text-gray-700 block mb-1">Bundesland</span>
                        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => handleSettingsChange("bundesland", "west")}
                                className={`px-4 py-1 text-sm ${
                                    settings.bundesland === "west"
                                        ? "bg-gray-900 text-white"
                                        : "bg-white text-gray-700"
                                }`}
                            >
                                West
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSettingsChange("bundesland", "east")}
                                className={`px-4 py-1 text-sm border-l border-gray-300 ${
                                    settings.bundesland === "east"
                                        ? "bg-gray-900 text-white"
                                        : "bg-white text-gray-700"
                                }`}
                            >
                                Ost
                            </button>
                        </div>
                    </div>

                    {/* Entgeltpunkte heute */}
                    <div>
            <span className="text-sm text-gray-700 block mb-1">
              Entgeltpunkte heute
            </span>
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={settings.entgeltpunktHeute}
                            onChange={(e) =>
                                handleSettingsChange(
                                    "entgeltpunktHeute",
                                    parseFloat(e.target.value) || 0
                                )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleResetSettings}
                        className="text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
                    >
                        Eingaben zurücksetzen
                    </button>
                </div>
            )}

            {/* MAIN CHART – 2 KHỐI TÁCH RÕ RÀNG */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-6">
                {/* Hàng nhãn tổng quát bên phải */}
                <div className="grid grid-cols-4 gap-4 text-xs text-gray-600 mb-4">
                    <div>
                        <p className="font-semibold text-gray-700">Wunschrente</p>
                        <p className="text-sm text-red-600 font-semibold">
                            €{Math.round(clampedWunschrente).toLocaleString("de-DE")}
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-700">Gesetzliche Rente (netto)</p>
                        <p className="text-sm text-emerald-700 font-semibold">
                            €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
                        </p>
                    </div>
                    <div>
                        <p className="font-semibold text-gray-700">
                            Angesparte private Rente
                        </p>
                        <p className="text-sm text-sky-700 font-semibold">
                            €{privatrente.toLocaleString("de-DE")}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-700">Vorsorgelücke</p>
                        <p
                            className={`text-sm font-semibold ${
                                vorsorgeluecke > 0 ? "text-red-600" : "text-emerald-600"
                            }`}
                        >
                            €{Math.round(Math.abs(vorsorgeluecke)).toLocaleString("de-DE")}
                        </p>
                    </div>
                </div>

                {/* Hai biểu đồ có ngăn cách */}
                <div className="flex gap-8">
                    {/* LEFT: Nettoeinkommen */}
                    <div className="w-1/2 pr-4 border-r border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">
                            Einkommen heute
                        </p>
                        <div
                            ref={incomeTrackRef}
                            className="relative h-20 bg-gray-100 border border-gray-200 rounded-md overflow-hidden cursor-pointer"
                            onClick={handleIncomeClick}
                        >
                            {/* block xám bên trong */}
                            <div
                                className="absolute inset-y-3 left-0 bg-gray-400 rounded-r-md flex items-center justify-end pr-3"
                                style={{
                                    width: `${Math.max(incomePercentage, 8)}%`,
                                    minWidth: "40px",
                                }}
                            >
                                {incomePercentage > 12 && (
                                    <span className="text-xs font-semibold text-white truncate">
                    €{nettoeinkommen.toLocaleString("de-DE")}
                  </span>
                                )}
                            </div>
                            {/* handle kéo */}
                            <div
                                className="absolute inset-y-2"
                                style={{
                                    left: `calc(${Math.max(
                                        incomePercentage,
                                        8
                                    )}% - 6px)`,
                                }}
                            >
                                <div
                                    className="w-3 h-12 bg-gray-800 rounded-full cursor-grab active:cursor-grabbing"
                                    onMouseDown={handleIncomeDragStart}
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Wunschrente + Gesetzliche + private */}
                    <div className="w-1/2 pl-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2">
                            Rente ab Rentenbeginn
                        </p>
                        <div
                            ref={wunschTrackRef}
                            className="relative h-20 bg-gray-100 border border-gray-200 rounded-md overflow-hidden cursor-pointer"
                            onClick={handleWunschClick}
                        >
                            {/* Gesetzliche Rente (xanh lá) */}
                            {gesetzInnerPct > 0 && (
                                <div
                                    className="absolute inset-y-6 left-0 bg-emerald-500 rounded-l-md"
                                    style={{ width: `${gesetzInnerPct}%` }}
                                />
                            )}

                            {/* Private Rente (xanh dương) */}
                            {privateInnerPct > 0 && (
                                <div
                                    className="absolute inset-y-6 bg-sky-500"
                                    style={{
                                        left: `${gesetzInnerPct}%`,
                                        width: `${privateInnerPct}%`,
                                    }}
                                />
                            )}

                            {/* viền tổng Wunschrente */}
                            <div className="absolute inset-y-4 left-0 right-0 border border-dashed border-red-300 rounded-md" />

                            {/* Line Wunschrente (drag) */}
                            <div
                                className="absolute top-2 bottom-2 w-[2px] bg-red-600 cursor-grab active:cursor-grabbing"
                                style={{ left: `${wunschePercentage}%` }}
                                onMouseDown={handleWunschDragStart}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* TIMELINE */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>0 € — Heute</span>
                    <div className="flex-1 mx-4 flex items-center">
                        <div className="flex-1 h-px bg-gray-300" />
                        <div className="w-3 h-3 rounded-full bg-gray-500 mx-2" />
                        <div className="flex-1 h-px bg-gray-300" />
                    </div>
                    <span>Rentenbeginn {RENT_CONSTANTS.RETIREMENT_AGE} Jahre</span>
                </div>
            </div>

            {/* SLIDERS (Jahrgang + private Rente) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Jahrgang */}
                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">Jahrgang</span>
                        <span className="text-sm font-semibold text-gray-900">
              {jahrgang}
            </span>
                    </div>
                    <input
                        type="range"
                        min={1940}
                        max={2005}
                        value={jahrgang}
                        onChange={(e) =>
                            onJahrgangChange(parseInt(e.target.value, 10))
                        }
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                        style={{
                            background: `linear-gradient(to right, #111827 0%, #111827 ${
                                ((jahrgang - 1940) / (2005 - 1940)) * 100
                            }%, #e5e7eb ${
                                ((jahrgang - 1940) / (2005 - 1940)) * 100
                            }%, #e5e7eb 100%)`,
                        }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1940</span>
                        <span>2005</span>
                    </div>
                </div>

                {/* Private Rente */}
                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              Angesparte private Rente (monatlich)
            </span>
                        <span className="text-sm font-semibold text-gray-900">
              €{privatrente.toLocaleString("de-DE")}
            </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={10000}
                        step={100}
                        value={privatrente}
                        onChange={(e) =>
                            onPrivatrenterChange(parseInt(e.target.value, 10))
                        }
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                        style={{
                            background: `linear-gradient(to right, #4b5563 0%, #4b5563 ${
                                (privatrente / 10000) * 100
                            }%, #e5e7eb ${(privatrente / 10000) * 100}%, #e5e7eb 100%)`,
                        }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0 €</span>
                        <span>10.000 €</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Step1Wunschrente;
