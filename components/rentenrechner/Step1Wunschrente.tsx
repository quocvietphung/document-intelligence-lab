"use client";

import React, { useCallback, useRef, useState } from "react";
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
    // ========= SETTINGS =========
    const [settings, setSettings] = useState<PensionSettings>(SETTINGS_DEFAULTS);
    const [showSettings, setShowSettings] = useState(false);
    const [showInfo, setShowInfo] = useState(true);

    // ========= REFS =========
    const incomeTrackRef = useRef<HTMLDivElement>(null);
    const wunschTrackRef = useRef<HTMLDivElement>(null);

    // ========= CALCULATION =========
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

    // width theo % so với maxIncome / maxRente (cho block xám)
    const incomePercentage = Math.min(100, (nettoeinkommen / maxIncome) * 100);

    // tỉ lệ *dọc* bên trong khối Wunschrente (stacked top/bottom)
    const wunschTotal = clampedWunschrente || 1;

    const maxPrivateForStack = Math.max(
        0,
        clampedWunschrente - computedGesetzlicheRente
    );
    const privateForStack = Math.min(Math.max(privatrente, 0), maxPrivateForStack);

    let gesetzInnerPct =
        (computedGesetzlicheRente / wunschTotal) * 100 || 0;
    let privateInnerPct = (privateForStack / wunschTotal) * 100 || 0;

    // giữ tổng <= 100% và tránh block quá mỏng
    const MIN_SEGMENT = 12;
    if (gesetzInnerPct > 0 && gesetzInnerPct < MIN_SEGMENT)
        gesetzInnerPct = MIN_SEGMENT;
    if (privateInnerPct > 0 && privateInnerPct < MIN_SEGMENT)
        privateInnerPct = MIN_SEGMENT;
    const sumSeg = gesetzInnerPct + privateInnerPct;
    if (sumSeg > 100 && sumSeg > 0) {
        const scale = 100 / sumSeg;
        gesetzInnerPct *= scale;
        privateInnerPct *= scale;
    }

    const vorsorgeluecke = calcVorsorgeluecke(
        clampedWunschrente,
        computedGesetzlicheRente,
        privatrente
    );

    // ========= DRAG CORE =========
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
                e.preventDefault();
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

    // ========= HANDLERS =========
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

    // ========= UI =========
    return (
        <div className="space-y-8">
            {/* TIÊU ĐỀ + ICON MŨI TÊN TRÒN */}
            <div className="rounded-xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Schritt 1: Berechnen Sie Ihre monatliche Rente mit den Pfeilen
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowInfo((s) => !s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow"
                            aria-label="Info ein-/ausblenden"
                        >
              <span
                  className={`transition-transform ${
                      showInfo ? "rotate-90" : ""
                  }`}
              >
                ❯
              </span>
                        </button>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                        <p>
                            Alter: <span className="font-semibold text-slate-800">{age}</span>{" "}
                            Jahre
                        </p>
                        <p>
                            Rentenbeginn in{" "}
                            <span className="font-semibold text-slate-800">
                {yearsUntilRetirement}
              </span>{" "}
                            Jahren
                        </p>
                    </div>
                </div>

                {showInfo && (
                    <p className="mt-3 max-w-3xl text-sm text-slate-600">
                        Nutzen Sie die schwarzen Pfeile, um Ihr aktuelles Einkommen, Ihre
                        gewünschte Rente und die private Vorsorge zu verändern. Die graue
                        Fläche zeigt Ihr heutiges Nettoeinkommen, die grüne Fläche Ihre
                        Rente ab Rentenbeginn.
                    </p>
                )}
            </div>

            {/* BIỂU ĐỒ CHÍNH + TRỤC + SLIDER DƯỚI (Jahrgang, private, Einstellungen) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                {/* HÀNG LABEL TRÊN BIỂU ĐỒ: EINKOMMEN & WUNSCHRENTE */}
                <div className="flex items-end justify-between text-xs text-slate-700">
                    <div>
                        <p className="font-semibold">Einkommen</p>
                        <p className="mt-1 text-xs text-slate-600">
                            {maxIncome.toLocaleString("de-DE")} €
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold">Wunschrente</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                            €{Math.round(clampedWunschrente).toLocaleString("de-DE")}
                        </p>
                    </div>
                </div>

                {/* HAI KHỐI XÁM / XANH SONG SONG */}
                <div className="flex flex-col gap-6 md:flex-row md:gap-8">
                    {/* KHỐI XÁM – EINKOMMEN HEUTE */}
                    <div className="md:w-1/2 md:pr-4 md:border-r md:border-slate-200">
                        <div
                            ref={incomeTrackRef}
                            className="relative h-32 w-full cursor-pointer rounded-md border border-slate-200 bg-slate-50"
                            onClick={handleIncomeClick}
                        >
                            {/* nút tròn đen (mũi tên) ở mép trên bên trái */}
                            <button
                                type="button"
                                onMouseDown={handleIncomeDragStart}
                                className="absolute -top-4 left-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow cursor-grab active:cursor-grabbing"
                                aria-label="Nettoeinkommen verändern"
                            >
                                ‹
                            </button>

                            {/* block xám bên trong */}
                            <div
                                className="absolute inset-y-6 left-8 flex items-center justify-center rounded-md bg-slate-400 shadow-inner"
                                style={{
                                    width: `${Math.max(incomePercentage, 10)}%`,
                                    minWidth: "80px",
                                }}
                            >
                <span className="text-xs text-slate-50">
                  Nettoeinkommen{" "}
                    <span className="font-semibold underline decoration-dotted">
                    €{nettoeinkommen.toLocaleString("de-DE")}
                  </span>
                </span>
                            </div>

                            {/* nhãn 0 € & Heute dưới chân */}
                            <div className="absolute bottom-1 left-0 right-0 flex items-center justify-between px-1 text-[11px] text-slate-600">
                                <span>0 €</span>
                                <span>Heute</span>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI XANH – RENTE AB RENTENBEGINN (STACKED) */}
                    <div className="md:w-1/2 md:pl-4">
                        <div
                            ref={wunschTrackRef}
                            className="relative h-32 w-full cursor-pointer rounded-md border border-slate-200 bg-slate-50"
                            onClick={handleWunschClick}
                        >
                            {/* nút tròn đen (mũi tên) ở mép trên bên phải */}
                            <button
                                type="button"
                                onMouseDown={handleWunschDragStart}
                                className="absolute -top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow cursor-grab active:cursor-grabbing"
                                aria-label="Wunschrente verändern"
                            >
                                ›
                            </button>

                            {/* KHỐI XANH TỔNG (WUNSCHRENTE) */}
                            <div className="absolute inset-x-8 bottom-4 top-6 rounded-md bg-emerald-500/90 shadow-inner">
                                {/* phần trên – private */}
                                {privateInnerPct > 0 && (
                                    <div
                                        className="absolute left-0 right-0 rounded-t-md bg-emerald-400"
                                        style={{ top: 0, height: `${privateInnerPct}%` }}
                                    >
                                        {privateInnerPct > 15 && (
                                            <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-semibold text-white">
                                                Angesparte private Rente{" "}
                                                {privatrente.toLocaleString("de-DE")} €
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* phần dưới – gesetzliche */}
                                {gesetzInnerPct > 0 && (
                                    <div
                                        className="absolute left-0 right-0 rounded-b-md bg-emerald-600"
                                        style={{ bottom: 0, height: `${gesetzInnerPct}%` }}
                                    >
                                        {gesetzInnerPct > 15 && (
                                            <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-semibold text-white">
                                                Gesetzliche Rente (netto){" "}
                                                {Math.round(
                                                    computedGesetzlicheRente
                                                ).toLocaleString("de-DE")}{" "}
                                                €
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* đường kẻ ngang đứt đoạn giữa 2 phần */}
                                {privateInnerPct > 0 && gesetzInnerPct > 0 && (
                                    <div
                                        className="absolute left-2 right-2 border-t border-dashed border-white/90"
                                        style={{ bottom: `${gesetzInnerPct}%` }}
                                    />
                                )}
                            </div>

                            {/* nhãn dưới: Rentenbeginn */}
                            <div className="absolute bottom-1 left-0 right-0 flex items-center justify-center text-[11px] text-slate-600">
                <span>
                  Rentenbeginn {RENT_CONSTANTS.RETIREMENT_AGE} Jahre
                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TRỤC NGANG 0 € — Heute —— Linie —— Rentenbeginn */}
                <div className="mt-2 flex items-center text-xs text-slate-600">
                    <span>0 € — Heute</span>
                    <div className="mx-3 h-px flex-1 bg-slate-300" />
                    <span>Rentenbeginn {RENT_CONSTANTS.RETIREMENT_AGE} Jahre</span>
                </div>

                {/* VÙNG NỀN BE: SLIDER + EINSTELLUNGEN */}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                    <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_auto]">
                        {/* Slider Jahrgang */}
                        <div>
                            <p className="mb-2 text-sm font-semibold text-slate-700">
                                Jahrgang
                            </p>
                            <p className="mb-1 text-sm font-semibold text-slate-900">
                                {jahrgang}
                            </p>
                            <input
                                type="range"
                                min={1940}
                                max={2005}
                                value={jahrgang}
                                onChange={(e) => onJahrgangChange(parseInt(e.target.value, 10))}
                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200"
                                style={{
                                    background: `linear-gradient(to right,#0f172a 0%,#0f172a ${
                                        ((jahrgang - 1940) / (2005 - 1940)) * 100
                                    }%,#e5e7eb ${
                                        ((jahrgang - 1940) / (2005 - 1940)) * 100
                                    }%,#e5e7eb 100%)`,
                                }}
                            />
                            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                                <span>1940</span>
                                <span>2005</span>
                            </div>
                        </div>

                        {/* Slider Angesparte private Rente */}
                        <div>
                            <p className="mb-2 text-sm font-semibold text-slate-700">
                                Angesparte private Rente
                            </p>
                            <p className="mb-1 text-sm font-semibold text-slate-900">
                                €{privatrente.toLocaleString("de-DE")}
                            </p>
                            <input
                                type="range"
                                min={0}
                                max={10000}
                                step={100}
                                value={privatrente}
                                onChange={(e) =>
                                    onPrivatrenterChange(parseInt(e.target.value, 10))
                                }
                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200"
                                style={{
                                    background: `linear-gradient(to right,#334155 0%,#334155 ${
                                        (privatrente / 10000) * 100
                                    }%,#e5e7eb ${(privatrente / 10000) * 100}%,#e5e7eb 100%)`,
                                }}
                            />
                            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                                <span>0 €</span>
                                <span>10.000 €</span>
                            </div>
                        </div>

                        {/* NÚT EINSTELLUNGEN */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowSettings((s) => !s)}
                                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-black"
                            >
                                <span className="text-xs">⚙️</span>
                                Einstellungen
                            </button>
                        </div>
                    </div>
                </div>

                {/* HÀNG TÓM TẮT VORSORGELÜCKE */}
                <div className="mt-3 flex items-center justify-between text-sm text-slate-700">
                    <span className="font-semibold">Vorsorgelücke</span>
                    <span
                        className={`text-base font-semibold ${
                            vorsorgeluecke > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                    >
            €{Math.round(Math.abs(vorsorgeluecke)).toLocaleString("de-DE")}
          </span>
                </div>
            </div>

            {/* PANEL EINSTELLUNGEN CHI TIẾT */}
            {showSettings && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                    <h3 className="text-sm font-semibold text-slate-900">
                        Annahmen & Einstellungen
                    </h3>

                    {/* Anspruch + Bundesland */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-700">
                Anspruch auf gesetzliche Rente
              </span>
                            <button
                                type="button"
                                onClick={() =>
                                    handleSettingsChange("anspruchRente", !settings.anspruchRente)
                                }
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    settings.anspruchRente ? "bg-emerald-500" : "bg-slate-300"
                                }`}
                            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        settings.anspruchRente ? "translate-x-6" : "translate-x-1"
                    }`}
                />
                            </button>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mb-2 block text-sm text-slate-700">
                Bundesland
              </span>
                            <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
                                <button
                                    type="button"
                                    onClick={() => handleSettingsChange("bundesland", "west")}
                                    className={`px-4 py-1 ${
                                        settings.bundesland === "west"
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    West
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSettingsChange("bundesland", "east")}
                                    className={`border-l border-slate-300 px-4 py-1 ${
                                        settings.bundesland === "east"
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    Ost
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Inflation + Gehaltssteigerung */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <div className="mb-1 flex justify-between text-sm">
                                <span className="text-slate-700">Inflation</span>
                                <span className="font-semibold">
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
                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200"
                                style={{
                                    background: `linear-gradient(to right,#0f172a 0%,#0f172a ${
                                        settings.inflation * 10
                                    }%,#e5e7eb ${settings.inflation * 10}%,#e5e7eb 100%)`,
                                }}
                            />
                        </div>

                        <div>
                            <div className="mb-1 flex justify-between text-sm">
                                <span className="text-slate-700">Gehaltssteigerung</span>
                                <span className="font-semibold">
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
                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200"
                                style={{
                                    background: `linear-gradient(to right,#0f172a 0%,#0f172a ${
                                        settings.gehaltssteigerung * 10
                                    }%,#e5e7eb ${settings.gehaltssteigerung * 10}%,#e5e7eb 100%)`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Entgeltpunkte */}
                    <div>
            <span className="mb-1 block text-sm text-slate-700">
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
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleResetSettings}
                        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        ↺ Eingaben zurücksetzen
                    </button>
                </div>
            )}
        </div>
    );
}

export default Step1Wunschrente;
