import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthButton } from "../components/AuthButton";
import { Logo } from "../components/Logo";
import { NavBar } from "../components/NavBar";
import { AuthProvider } from "../contexts/AuthContext";
import { UserKeysProvider } from "../contexts/UserKeysContext";
import { NoteDraftProvider } from "../contexts/NoteDraftContext";
import { isIndexableDeployment, productionSiteUrl } from "../lib/seo";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: productionSiteUrl() ?? undefined,
  title: "Notes Taker | Private Notes & Real-Time Collaboration",
  description: "Capture ideas, organize personal notes, and collaborate in real time. Choose normal notes, encrypted private notes, or secure shared notes in Notes Taker.",
  applicationName: "Notes Taker",
  robots: { index: isIndexableDeployment(), follow: isIndexableDeployment() },
  openGraph: {
    type: "website",
    title: "Notes Taker | Private Notes & Real-Time Collaboration",
    description: "A clean workspace for personal notes, encrypted writing, and real-time collaboration.",
    siteName: "Notes Taker",
    url: productionSiteUrl()?.href,
  },
  twitter: {
    card: "summary",
    title: "Notes Taker",
    description: "Capture ideas, protect private notes, and collaborate in real time.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <UserKeysProvider>
            <NoteDraftProvider>
            <header className="sticky top-0 z-50 glass border-b border-white/10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
                <Logo />
                <AuthButton />
              </div>
            </header>
            <NavBar />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            </NoteDraftProvider>
          </UserKeysProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
