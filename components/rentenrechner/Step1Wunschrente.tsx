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
    const [settings, setSettings] = useState<PensionSettings>(SETTINGS_DEFAULTS);

    // ===== REFS =====
    const chartRef = useRef<HTMLDivElement>(null);

    // ===== CALCULATION =====
    const age = getAge(jahrgang);
    const yearsUntilRetirement = Math.max(0, RENT_CONSTANTS.RETIREMENT_AGE - age);

    const calculation = calculatePension(nettoeinkommen, wunschrente, privatrente, jahrgang, settings);
    const computedGesetzlicheRente = calculation.nettoRente;
    const clampedWunschrente = Math.max(computedGesetzlicheRente, wunschrente);

    const incomePercentage = Math.min(100, (nettoeinkommen / maxIncome) * 100);
    const gesetzlichePercentage = Math.min(100, (computedGesetzlicheRente / maxRente) * 100);
    const wunschePercentage = Math.min(100, (clampedWunschrente / maxRente) * 100);

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

    // ===== HANDLERS =====
    const handleIncomeBlockClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientX(e.clientX, maxIncome, onNettoeinkommenChange);
        },
        [updateFromClientX, maxIncome, onNettoeinkommenChange]
    );

    const handleIncomeBlockDragStart = useCallback(() => {
        startDrag(maxIncome, onNettoeinkommenChange);
    }, [startDrag, maxIncome, onNettoeinkommenChange]);

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
        <div className="space-y-6">
            {/* HEADER SECTION */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 shadow-xl border border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                            Ihre Wunschrente
                        </h2>
                        <p className="text-slate-300 text-sm">
                            Berechnen und visualisieren Sie Ihre ideale Altersversorgung
                        </p>
                        <div className="flex gap-6 mt-4">
                            <div className="bg-slate-700/50 rounded-lg px-4 py-2 border border-slate-600">
                                <p className="text-xs text-slate-400 font-semibold">ALTER</p>
                                <p className="text-xl font-bold text-white mt-1">{age}</p>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg px-4 py-2 border border-slate-600">
                                <p className="text-xs text-slate-400 font-semibold">RENTENBEGINN IN</p>
                                <p className="text-xl font-bold text-white mt-1">{yearsUntilRetirement}J</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SETTINGS PANEL - Always Visible */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 shadow-lg border border-blue-200">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Einstellungen & Parameter</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Anspruch Rente */}
                    <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-700">Gesetzliche Rente</span>
                            <button
                                onClick={() => handleSettingsChange("anspruchRente", !settings.anspruchRente)}
                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all ${
                                    settings.anspruchRente
                                        ? "bg-gradient-to-r from-green-400 to-green-500"
                                        : "bg-gray-300"
                                }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                        settings.anspruchRente ? "translate-x-7" : "translate-x-1"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Bundesland */}
                    <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                        <span className="text-sm font-semibold text-slate-700 block mb-3">Bundesland</span>
                        <div className="inline-flex rounded-lg overflow-hidden border border-blue-300 bg-blue-50">
                            <button
                                type="button"
                                onClick={() => handleSettingsChange("bundesland", "west")}
                                className={`px-5 py-2 text-sm font-semibold transition-all ${
                                    settings.bundesland === "west"
                                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                                        : "bg-white text-blue-600 hover:bg-blue-50"
                                }`}
                            >
                                West
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSettingsChange("bundesland", "east")}
                                className={`px-5 py-2 text-sm font-semibold transition-all border-l ${
                                    settings.bundesland === "east"
                                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                                        : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                                }`}
                            >
                                Ost
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Inflation */}
                    <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-semibold text-slate-700">Inflation</span>
                            <span className="text-lg font-bold text-blue-600">
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
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-blue-200 to-blue-300"
                            style={{
                                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${settings.inflation * 10}%, #dbeafe ${settings.inflation * 10}%, #dbeafe 100%)`,
                            }}
                        />
                    </div>

                    {/* Gehaltssteigerung */}
                    <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-semibold text-slate-700">Gehaltssteigerung</span>
                            <span className="text-lg font-bold text-green-600">
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
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, #10b981 0%, #10b981 ${settings.gehaltssteigerung * 10}%, #d1fae5 ${settings.gehaltssteigerung * 10}%, #d1fae5 100%)`,
                            }}
                        />
                    </div>
                </div>

                {/* Entgeltpunkte */}
                <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm mb-6">
                    <span className="text-sm font-semibold text-slate-700 block mb-3">Entgeltpunkte heute</span>
                    <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={settings.entgeltpunktHeute}
                        onChange={(e) => handleSettingsChange("entgeltpunktHeute", parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gradient-to-r from-blue-50 to-indigo-50"
                    />
                </div>

                <button
                    onClick={handleResetSettings}
                    className="w-full px-4 py-3 text-sm font-semibold text-blue-600 bg-white border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-all"
                >
                    ↻ Einstellungen zurücksetzen
                </button>
            </div>

            {/* 2-BLOCK-CHART - Premium Design */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                {/* Header Info Row */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    {/* Income */}
                    <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-6 border border-slate-300">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">
                            💼 Monatliches Nettoeinkommen
                        </p>
                        <p className="text-3xl font-bold text-slate-900">
                            €{nettoeinkommen.toLocaleString("de-DE")}
                        </p>
                    </div>

                    {/* Statutory */}
                    <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl p-6 border border-emerald-300">
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-widest mb-2">
                            ✓ Gesetzliche Rente
                        </p>
                        <p className="text-3xl font-bold text-emerald-900">
                            €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
                        </p>
                    </div>

                    {/* Desired */}
                    <div className="bg-gradient-to-br from-rose-100 to-rose-200 rounded-xl p-6 border border-rose-300">
                        <p className="text-xs font-semibold text-rose-700 uppercase tracking-widest mb-2">
                            🎯 Wunschrente
                        </p>
                        <p className="text-3xl font-bold text-rose-900">
                            €{Math.round(clampedWunschrente).toLocaleString("de-DE")}
                        </p>
                    </div>
                </div>

                {/* Chart Container */}
                <div
                    ref={chartRef}
                    className="relative h-48 bg-gradient-to-b from-slate-100 to-slate-50 rounded-2xl border-2 border-slate-300 overflow-hidden shadow-inner mb-8"
                >
                    {/* Income block */}
                    <div
                        className="absolute left-0 top-0 bottom-0 cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center rounded-r-2xl transition-all duration-200 hover:shadow-xl chart-block"
                        style={{
                            width: `${Math.max(incomePercentage, 5)}%`,
                            minWidth: "80px",
                            background: `linear-gradient(135deg, #64748b 0%, #475569 100%)`,
                        }}
                        onClick={handleIncomeBlockClick}
                    >
                        <div
                            className="absolute right-0 top-0 bottom-0 w-2 bg-slate-900 cursor-grab active:cursor-grabbing rounded-r-2xl hover:w-3 transition-all"
                            onMouseDown={handleIncomeBlockDragStart}
                        />
                        {incomePercentage > 10 && (
                            <span className="text-sm font-bold text-white px-3 truncate">
                                €{nettoeinkommen.toLocaleString("de-DE")}
                            </span>
                        )}
                    </div>

                    {/* Gesetzliche Rente block */}
                    <div
                        className="absolute right-0 top-0 bottom-0 shadow-lg flex items-center justify-center rounded-l-2xl transition-all duration-200 hover:shadow-xl chart-block"
                        style={{
                            width: `${Math.max(gesetzlichePercentage, 5)}%`,
                            minWidth: "80px",
                            background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
                        }}
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-900 rounded-l-2xl" />
                        {gesetzlichePercentage > 10 && (
                            <span className="text-sm font-bold text-white px-3 truncate">
                                €{Math.round(computedGesetzlicheRente).toLocaleString("de-DE")}
                            </span>
                        )}
                    </div>

                    {/* Wunschrente line */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 cursor-grab active:cursor-grabbing shadow-lg transition-all duration-200 hover:w-2 wunschrente-line"
                        style={{
                            left: `${wunschePercentage}%`,
                            boxShadow: "0 0 20px rgba(244, 63, 94, 0.8)",
                        }}
                        onClick={handleWunschrenterLineClick}
                        onMouseDown={handleWunschrenterLineDragStart}
                    />

                    {/* Grid lines */}
                    <div className="absolute inset-0 pointer-events-none opacity-10">
                        {[25, 50, 75].map((percent) => (
                            <div
                                key={percent}
                                className="absolute top-0 bottom-0 w-px bg-slate-400"
                                style={{ left: `${percent}%` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Gap Analysis */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 border-2 border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">
                                📊 Ihre Vorsorgelücke
                            </p>
                            <p className="text-sm text-slate-700">
                                Differenz zwischen Wunsch- und gesetzlicher Rente
                            </p>
                        </div>
                        <div className={`text-right`}>
                            <p
                                className={`text-4xl font-bold ${
                                    vorsorgeluecke > 0 ? "text-rose-600" : "text-emerald-600"
                                }`}
                            >
                                €{Math.round(Math.abs(vorsorgeluecke)).toLocaleString("de-DE")}
                            </p>
                            <p
                                className={`text-xs font-semibold mt-2 ${
                                    vorsorgeluecke > 0
                                        ? "text-rose-600"
                                        : "text-emerald-600"
                                }`}
                            >
                                {vorsorgeluecke > 0 ? "⚠️ Zu decken" : "✓ Überversichert"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TIMELINE */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4">⏱️ Ihr Rentenverlauf</p>
                <div className="relative flex items-center gap-6">
                    {/* Start point */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg flex items-center justify-center">
                            <span className="text-xl">📅</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 text-center">Heute</p>
                        <p className="text-sm font-bold text-slate-900">{new Date().getFullYear()}</p>
                    </div>

                    {/* Timeline line */}
                    <div className="flex-1 relative h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-rose-500 rounded-full shadow-md">
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg border-4 border-white"
                            style={{
                                left: `${(yearsUntilRetirement / (67 - new Date().getFullYear() + jahrgang + 1)) * 100}%`,
                            }}
                        />
                    </div>

                    {/* End point */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg flex items-center justify-center">
                            <span className="text-xl">🎯</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 text-center">Rentenbeginn</p>
                        <p className="text-sm font-bold text-slate-900">{RENT_CONSTANTS.RETIREMENT_AGE} Jahre</p>
                    </div>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-900">{yearsUntilRetirement}</span> Jahre verbleibend bis zur Rente
                    </p>
                </div>
            </div>

            {/* SLIDERS - Premium Design */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Jahrgang */}
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1">📅 Jahrgang</label>
                            <p className="text-lg text-slate-600">Geburtsjahrgang</p>
                        </div>
                        <span className="text-4xl font-bold bg-gradient-to-br from-blue-600 to-blue-700 bg-clip-text text-transparent">{jahrgang}</span>
                    </div>
                    <input
                        type="range"
                        min={1940}
                        max={2005}
                        value={jahrgang}
                        onChange={(e) => onJahrgangChange(parseInt(e.target.value, 10))}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer transition-all"
                        style={{
                            background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${
                                ((jahrgang - 1940) / (2005 - 1940)) * 100
                            }%, #e0f2fe ${((jahrgang - 1940) / (2005 - 1940)) * 100}%, #e0f2fe 100%)`,
                        }}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-3 font-semibold">
                        <span>1940</span>
                        <span>2005</span>
                    </div>
                </div>

                {/* Private Rente */}
                <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-8 shadow-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1">💰 Angesparte private Rente</label>
                            <p className="text-lg text-slate-600">Verfügbare Ersparnisse</p>
                        </div>
                        <span className="text-3xl font-bold bg-gradient-to-br from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
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
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer transition-all"
                        style={{
                            background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                                (privatrente / 10000) * 100
                            }%, #d1fae5 ${(privatrente / 10000) * 100}%, #d1fae5 100%)`,
                        }}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-3 font-semibold">
                        <span>€0</span>
                        <span>€10.000</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Step1Wunschrente;

