import type { Metadata } from "next";
import localFont from "next/font/local";
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
      <body className={`${font.variable} font-[family-name:var(--font-inter)] antialiased`}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
