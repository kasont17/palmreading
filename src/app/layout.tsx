import type { Metadata } from "next";
import localFont from "next/font/local";
import { Outfit, Instrument_Sans } from "next/font/google";
import "./globals.css";

const jersey = localFont({
  src: "./fonts/Jersey10-Regular.ttf",
  variable: "--font-jersey",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const geistMono = localFont({
  src: [
    {
      path: "./fonts/GeistMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/GeistMono-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/GeistMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Destiny Machine",
  description: "Discover your destiny through the ancient art of palm reading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jersey.variable} ${outfit.variable} ${geistMono.variable} ${instrumentSans.variable}`}>
      <body className="font-outfit min-h-screen">{children}</body>
    </html>
  );
}

