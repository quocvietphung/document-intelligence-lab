"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ProcessIcon = ({ number }: { number: string }) => {
  const icons = {
    "1": (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    "2": (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    "3": (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return icons[number as keyof typeof icons] || null;
};

export default function ProcessSection() {
  const t = useTranslations("process");
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const steps: Step[] = [
    {
      number: "1",
      title: t("step1.title"),
      description: t("step1.description"),
      icon: <ProcessIcon number="1" />,
    },
    {
      number: "2",
      title: t("step2.title"),
      description: t("step2.description"),
      icon: <ProcessIcon number="2" />,
    },
    {
      number: "3",
      title: t("step3.title"),
      description: t("step3.description"),
      icon: <ProcessIcon number="3" />,
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-32 overflow-hidden bg-white"
    >
      {/* Premium background effects */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />

        {/* Animated gradient orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200 to-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse duration-7000" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-200 to-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse duration-9000" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-gradient-to-l from-cyan-200 to-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse duration-8000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="mb-20">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="inline-flex items-center justify-center mb-6 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 backdrop-blur-sm">
              <span className="text-xs font-semibold text-blue-700 tracking-widest uppercase">
                {t("subtitle")}
              </span>
            </div>

            {/* Main title */}
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent">
                {t("title")}
              </span>
            </h2>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl leading-relaxed font-light">
              Unser bewährter, transparenter Prozess für Ihren finanziellen Erfolg
            </p>
          </div>
        </div>

        {/* Steps container */}
        <div className="relative">
          {/* Connection line with animation */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent">
            <div
              className={`h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent transition-all duration-1000 ${
                isVisible ? "w-full" : "w-0"
              }`}
            />
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative group transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: isVisible ? `${index * 150}ms` : "0ms",
                }}
              >
                {/* Connection dots for mobile */}
                {index < steps.length - 1 && (
                  <div className="md:hidden absolute -bottom-8 left-1/2 -translate-x-1/2 w-1 h-8 bg-gradient-to-b from-blue-300 to-transparent" />
                )}

                {/* Card container */}
                <div className="relative h-full">
                  {/* Background gradient card */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white to-blue-50/30 rounded-2xl border border-blue-100/50 shadow-lg group-hover:shadow-2xl transition-all duration-500 -z-10" />

                  {/* Hover overlay effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Content */}
                  <div className="relative p-8 md:p-10 h-full flex flex-col">
                    {/* Number and icon container */}
                    <div className="mb-8 flex items-start justify-between">
                      {/* Circle with number */}
                      <div className="relative flex-shrink-0">
                        {/* Animated background circle */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-500" />

                        {/* Main circle */}
                        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-500 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white">
                            {step.number}
                          </span>

                          {/* Pulse effect */}
                          <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-pulse" />
                        </div>
                      </div>

                      {/* Icon indicator */}
                      <div className="text-blue-500/30 group-hover:text-blue-500 transition-colors duration-500 group-hover:scale-125 transform">
                        {step.icon}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors duration-500">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 leading-relaxed flex-grow text-base md:text-lg font-light">
                      {step.description}
                    </p>

                    {/* Bottom accent line */}
                    <div className="mt-6 h-1 bg-gradient-to-r from-blue-400 to-transparent opacity-0 group-hover:opacity-100 rounded-full transition-all duration-500 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
