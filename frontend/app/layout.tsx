import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/lib/components/QueryProvider";
import { Navigation } from "@/lib/components/Navigation";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SMS Platform",
  description: "SMS Automation Platform - Manage clients, campaigns, and messages",
  icons: {
    icon: '/icon-chat-dots.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        <QueryProvider>
          <AuthProvider>
            <Navigation />
            <main className="min-h-screen">{children}</main>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}