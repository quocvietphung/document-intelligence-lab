import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tax Consulting - Steuerberatung Deutschland",
  description: "Professional tax consulting services in Germany",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
