import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071426",
};

export const metadata: Metadata = {
  title: {
    default: "NavalSmart",
    template: "%s · NavalSmart",
  },
  description: "De l'appel d'offres à l'estimation, avec l'IA. L'estimateur reste décideur.",
  applicationName: "NavalSmart",
  appleWebApp: {
    capable: true,
    title: "NavalSmart",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: { apple: "/brand/mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
