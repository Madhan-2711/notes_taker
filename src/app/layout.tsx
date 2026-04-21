import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthButton } from "../components/AuthButton";
import { Logo } from "../components/Logo";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Notes Taker",
  description: "A secure, minimalist, full-stack notes application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <header className="sticky top-0 z-50 glass border-b border-white/10">
          <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
            <Logo />
            <AuthButton />
          </div>
        </header>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
