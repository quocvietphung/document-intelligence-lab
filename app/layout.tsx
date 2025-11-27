import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Consulting - Steuerberatung Deutschland",
  description: "Professional finance consulting services in Germany",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
