import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Homeio",
  description:
    "Your home server dashboard - manage all your self-hosted services in one place.",
  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2332",
  userScalable: false,
  // Draw into the notch and gesture areas rather than letterboxing the page,
  // then keep the shell's own chrome clear of them with env(safe-area-inset-*).
  // Without cover, those insets are always 0 and the phone's status bar sits on
  // top of Homeio's own.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body
        className={`${_inter.variable} ${_geistMono.variable} font-sans antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
