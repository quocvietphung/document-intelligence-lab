import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credit Intelligence Lab",
  description:
    "A secure banking AI engineering lab for document intelligence, human review and explainable workflows.",
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
