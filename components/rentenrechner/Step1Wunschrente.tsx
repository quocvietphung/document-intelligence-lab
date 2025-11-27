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
    const incomeTrackRef = useRef<HTMLDivElement>(null); // cột xám
    const wunschTrackRef = useRef<HTMLDivElement>(null); // cột xanh
    const timelineRef = useRef<HTMLDivElement>(null); // trục dưới với nút ↔

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

    // stack phần private / gesetzlich bên trong khối xanh
    const wunschTotal = clampedWunschrente || 1;
    const maxPrivateForStack = Math.max(
        0,
        clampedWunschrente - computedGesetzlicheRente
    );
    const privateForStack = Math.min(Math.max(privatrente, 0), maxPrivateForStack);

    let gesetzInnerPct =
        (computedGesetzlicheRente / wunschTotal) * 100 || 0;
    let privateInnerPct = (privateForStack / wunschTotal) * 100 || 0;

    const MIN_SEGMENT = 12; // tránh segment quá mỏng
    if (gesetzInnerPct > 0 && gesetzInnerPct < MIN_SEGMENT)
        gesetzInnerPct = MIN_SEGMENT;
    if (privateInnerPct > 0 && privateInnerPct < MIN_SEGMENT)
        privateInnerPct = MIN_SEGMENT;
    const segSum = gesetzInnerPct + privateInnerPct;
    if (segSum > 100 && segSum > 0) {
        const scale = 100 / segSum;
        gesetzInnerPct *= scale;
        privateInnerPct *= scale;
    }

    const vorsorgeluecke = calcVorsorgeluecke(
        clampedWunschrente,
        computedGesetzlicheRente,
        privatrente
    );

    // Chung một trục dọc tiền €/tháng cho cả khối xám & xanh
    const axisMax = Math.max(
        maxIncome,
        maxRente,
        nettoeinkommen,
        clampedWunschrente,
        computedGesetzlicheRente + privatrente,
        1000
    );

    const incomeHeightPct = Math.min(100, (nettoeinkommen / axisMax) * 100);
    const wunschHeightPct = Math.min(100, (clampedWunschrente / axisMax) * 100);

    const safeIncomeHeightPct = Math.max(incomeHeightPct, 8);
    const safeWunschHeightPct = Math.max(wunschHeightPct, 8);

    // mapping Jahrgang ↔ vị trí nút tam giác trái–phải
    const jahrgangMin = 1940;
    const jahrgangMax = 2005;
    const jahrgangRange = jahrgangMax - jahrgangMin;
    const jahrgangPct = Math.max(
        0,
        Math.min(
            100,
            ((jahrgang - jahrgangMin) / jahrgangRange) * 100
        )
    );

    // ========= DRAG HELPERS =========
    // dọc (cho 2 mũi ▲)
    const updateFromClientY = useCallback(
        (
            container: HTMLDivElement | null,
            clientY: number,
            maxValue: number,
            onValueChange: (v: number) => void
        ) => {
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
            const percentage = 1 - y / rect.height; // 0 ở đáy, 1 ở đỉnh
            const raw = Math.round(percentage * maxValue);
            const value = Math.max(0, Math.min(maxValue, raw));
            onValueChange(value);
        },
        []
    );

    const startVerticalDrag = useCallback(
        (
            container: HTMLDivElement | null,
            maxValue: number,
            onValueChange: (v: number) => void
        ) => {
            if (!container) return;

            const handleMove = (e: MouseEvent) => {
                e.preventDefault();
                updateFromClientY(container, e.clientY, maxValue, onValueChange);
            };

            const handleUp = () => {
                document.removeEventListener("mousemove", handleMove);
                document.removeEventListener("mouseup", handleUp);
            };

            document.addEventListener("mousemove", handleMove);
            document.addEventListener("mouseup", handleUp);
        },
        [updateFromClientY]
    );

    // ngang (cho mũi ↔ Rentenbeginn)
    const updateFromClientX = useCallback(
        (
            container: HTMLDivElement | null,
            clientX: number,
            minValue: number,
            maxValue: number,
            onValueChange: (v: number) => void
        ) => {
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const percentage = x / rect.width;
            const raw = minValue + percentage * (maxValue - minValue);
            const value = Math.round(
                Math.max(minValue, Math.min(maxValue, raw))
            );
            onValueChange(value);
        },
        []
    );

    const startHorizontalDrag = useCallback(
        (
            container: HTMLDivElement | null,
            minValue: number,
            maxValue: number,
            onValueChange: (v: number) => void
        ) => {
            if (!container) return;

            const handleMove = (e: MouseEvent) => {
                e.preventDefault();
                updateFromClientX(container, e.clientX, minValue, maxValue, onValueChange);
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

    // ========= HANDLERS (3 mũi tam giác) =========
    // ▲ khối xám – thay đổi Nettoeinkommen
    const handleIncomeClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientY(
                incomeTrackRef.current,
                e.clientY,
                axisMax,
                (raw) => {
                    const clamped = Math.min(raw, maxIncome);
                    onNettoeinkommenChange(clamped);
                }
            );
        },
        [updateFromClientY, axisMax, maxIncome, onNettoeinkommenChange]
    );

    const handleIncomeDragStart = useCallback(() => {
        startVerticalDrag(incomeTrackRef.current, axisMax, (raw) => {
            const clamped = Math.min(raw, maxIncome);
            onNettoeinkommenChange(clamped);
        });
    }, [startVerticalDrag, axisMax, maxIncome, onNettoeinkommenChange]);

    // ▲ khối xanh – thay đổi Wunschrente (luôn ≥ gesetzliche)
    const handleWunschClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientY(
                wunschTrackRef.current,
                e.clientY,
                axisMax,
                (raw) => {
                    const capped = Math.min(raw, maxRente);
                    const clamped = Math.max(computedGesetzlicheRente, capped);
                    onWunschrenterChange(clamped);
                }
            );
        },
        [updateFromClientY, axisMax, maxRente, computedGesetzlicheRente, onWunschrenterChange]
    );

    const handleWunschDragStart = useCallback(() => {
        startVerticalDrag(wunschTrackRef.current, axisMax, (raw) => {
            const capped = Math.min(raw, maxRente);
            const clamped = Math.max(computedGesetzlicheRente, capped);
            onWunschrenterChange(clamped);
        });
    }, [startVerticalDrag, axisMax, maxRente, computedGesetzlicheRente, onWunschrenterChange]);

    // ↔ nút giữa – đổi Jahrgang / Rentenbeginn
    const handleTimelineClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            updateFromClientX(
                timelineRef.current,
                e.clientX,
                jahrgangMin,
                jahrgangMax,
                onJahrgangChange
            );
        },
        [updateFromClientX, onJahrgangChange]
    );

    const handleTimelineDragStart = useCallback(() => {
        startHorizontalDrag(
            timelineRef.current,
            jahrgangMin,
            jahrgangMax,
            onJahrgangChange
        );
    }, [startHorizontalDrag, onJahrgangChange]);

    // ========= SETTINGS HANDLERS =========
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
            {/* TIÊU ĐỀ + ICON MŨI TÊN TRÒN (info) */}
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
                            Alter:{" "}
                            <span className="font-semibold text-slate-800">{age}</span> Jahre
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

            {/* BIỂU ĐỒ CHÍNH + TRỤC + SLIDER DƯỚI */}
            <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                {/* LABEL TRÊN – Einkommen & Wunschrente */}
                <div className="flex items-end justify-between text-xs text-slate-700">
                    <div>
                        <p className="font-semibold">Einkommen</p>
                        <p className="mt-1 text-xs text-slate-600">
                            {axisMax.toLocaleString("de-DE")} € (Skala)
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold">Wunschrente</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                            €{Math.round(clampedWunschrente).toLocaleString("de-DE")}
                        </p>
                    </div>
                </div>

                {/* HAI KHỐI XÁM / XANH SÁT NHAU */}
                <div className="mt-2 flex flex-col gap-4 md:flex-row md:gap-0">
                    {/* KHỐI XÁM – Einkommen heute */}
                    <div className="md:w-1/2 md:pr-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Einkommen heute
                        </p>
                        <div
                            ref={incomeTrackRef}
                            className="relative h-40 w-full cursor-pointer rounded-md bg-slate-50"
                            onClick={handleIncomeClick}
                        >
                            {/* hình chữ nhật xám – cao theo Nettoeinkommen */}
                            <div
                                className="absolute bottom-0 left-0 right-0 mx-6 rounded-md bg-slate-400 shadow-inner"
                                style={{ height: `${safeIncomeHeightPct}%` }}
                            >
                                <div className="flex h-full items-center justify-center px-2">
                  <span className="text-xs text-slate-50">
                    Nettoeinkommen{" "}
                      <span className="font-semibold underline decoration-dotted">
                      €{nettoeinkommen.toLocaleString("de-DE")}
                    </span>
                  </span>
                                </div>
                            </div>

                            {/* mũi tam giác ▲ – kéo dọc */}
                            <button
                                type="button"
                                onMouseDown={handleIncomeDragStart}
                                className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow cursor-grab active:cursor-grabbing"
                                style={{
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    bottom: `calc(${safeIncomeHeightPct}% + 6px)`,
                                }}
                                aria-label="Nettoeinkommen verändern"
                            >
                                ▲
                            </button>

                            {/* 0 € & Heute */}
                            <div className="absolute bottom-1 left-0 right-0 flex items-center justify-between px-2 text-[11px] text-slate-600">
                                <span>0 €</span>
                                <span>Heute</span>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI XANH – Rente ab Rentenbeginn */}
                    <div className="md:w-1/2 md:pl-2">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Rente ab Rentenbeginn
                        </p>
                        <div
                            ref={wunschTrackRef}
                            className="relative h-40 w-full cursor-pointer rounded-md bg-slate-50"
                            onClick={handleWunschClick}
                        >
                            {/* khối xanh tổng – Wunschrente (cao theo Wunschrente) */}
                            <div
                                className="absolute bottom-0 left-0 right-0 mx-6 rounded-md bg-emerald-500/90 shadow-inner"
                                style={{ height: `${safeWunschHeightPct}%` }}
                            >
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

                                {/* đường kẻ ngang đứt đoạn */}
                                {privateInnerPct > 0 && gesetzInnerPct > 0 && (
                                    <div
                                        className="absolute left-2 right-2 border-t border-dashed border-white/90"
                                        style={{ bottom: `${gesetzInnerPct}%` }}
                                    />
                                )}
                            </div>

                            {/* mũi ▲ trên khối xanh */}
                            <button
                                type="button"
                                onMouseDown={handleWunschDragStart}
                                className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow cursor-grab active:cursor-grabbing"
                                style={{
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    bottom: `calc(${safeWunschHeightPct}% + 6px)`,
                                }}
                                aria-label="Wunschrente verändern"
                            >
                                ▲
                            </button>
                        </div>
                    </div>
                </div>

                {/* TRỤC NGANG + MŨI ↔ Ở GIỮA */}
                <div
                    ref={timelineRef}
                    className="mt-4 flex items-center text-xs text-slate-600"
                    onClick={handleTimelineClick}
                >
                    <span>0 € — Heute</span>
                    <div className="relative mx-3 flex-1 h-px bg-slate-300">
                        {/* nút tròn đen với mũi ↔ */}
                        <button
                            type="button"
                            onMouseDown={handleTimelineDragStart}
                            className="absolute -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow cursor-grab active:cursor-grabbing"
                            style={{
                                left: `${jahrgangPct}%`,
                                transform: "translateX(-50%)",
                            }}
                            aria-label="Rentenbeginn verschieben"
                        >
                            ↔
                        </button>
                    </div>
                    <span>Rentenbeginn {RENT_CONSTANTS.RETIREMENT_AGE} Jahre</span>
                </div>

                {/* VÙNG NỀN BE: Jahrgang + private + Einstellungen */}
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
                                min={jahrgangMin}
                                max={jahrgangMax}
                                value={jahrgang}
                                onChange={(e) =>
                                    onJahrgangChange(parseInt(e.target.value, 10))
                                }
                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200"
                                style={{
                                    background: `linear-gradient(to right,#0f172a 0%,#0f172a ${
                                        ((jahrgang - jahrgangMin) / jahrgangRange) * 100
                                    }%,#e5e7eb ${
                                        ((jahrgang - jahrgangMin) / jahrgangRange) * 100
                                    }%,#e5e7eb 100%)`,
                                }}
                            />
                            <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                                <span>{jahrgangMin}</span>
                                <span>{jahrgangMax}</span>
                            </div>
                        </div>

                        {/* Slider private Rente */}
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

                        {/* Nút Einstellungen */}
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

                {/* Vorsorgelücke summary */}
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
                <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
