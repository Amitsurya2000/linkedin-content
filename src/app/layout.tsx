import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo, Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/session-provider";

// Poppins from the bundled TTFs rather than next/font/google: the slide renderer
// draws with these exact files, so the app and the decks it produces stay in the
// same typeface, and the build does not depend on fetching a font at compile time.
const font = localFont({
  src: [
    { path: "../../assets/fonts/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../assets/fonts/Poppins-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../assets/fonts/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../assets/fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

// The design system's three roles (DESIGN-SYSTEM.md §2.1): Archivo carries every
// heading and numeral, Hanken Grotesk carries body and UI, and Instrument Serif
// italic is reserved for the human register — quotes, asides, numerals. Poppins
// stays loaded because the slide renderer draws with those exact files, so the
// decks and the app remain one typeface family where it matters.
const display = Archivo({ subsets: ["latin"], weight: ["500", "600", "700", "800", "900"], variable: "--font-display", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: ["400"], style: ["italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "LinkedIn Post Generator",
  description: "AI-powered LinkedIn content that goes viral",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${font.variable} ${display.variable} ${body.variable} ${serif.variable} antialiased`}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
