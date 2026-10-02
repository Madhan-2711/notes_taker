import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader, MobileTabBar } from "../components/NavBar";
import { CommandPalette } from "../components/CommandPalette";
import { AuthProvider } from "../contexts/AuthContext";
import { UserKeysProvider } from "../contexts/UserKeysContext";
import { NoteDraftProvider } from "../contexts/NoteDraftContext";
import { NoteMetaProvider } from "../contexts/NoteMetaContext";
import { ReminderNotifier } from "../components/ReminderNotifier";
import { InstallProvider } from "../components/AppInstall";
import { InboxProvider } from "../contexts/InboxContext";
import { ToastProvider } from "../contexts/ToastContext";
import { UsernamePrompt } from "../components/UsernamePrompt";
import { isIndexableDeployment, productionSiteUrl } from "../lib/seo";
import { THEME_BOOT_SCRIPT } from "../lib/theme";

const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: productionSiteUrl() ?? undefined,
  title: "Notes Taker | Private Notes & Real-Time Collaboration",
  description: "Capture ideas, organize personal notes, and collaborate in real time. Choose normal notes, encrypted private notes, or secure shared notes in Notes Taker.",
  applicationName: "Notes Taker",
  appleWebApp: { capable: true, title: "Notes", statusBarStyle: "default" },
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1626" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} font-sans`} suppressHydrationWarning>
      <head>
        {/* Applies a saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[var(--z-prompt)] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-[var(--neubrutalism-shadow)]">
          Skip to content
        </a>
        <AuthProvider>
          <UserKeysProvider>
            <NoteMetaProvider>
            <NoteDraftProvider>
            <InstallProvider>
            <InboxProvider>
            <ToastProvider>
            <AppHeader />
            <main id="main" className="pb-tabbar flex flex-1 flex-col">
              {children}
            </main>
            <MobileTabBar />
            <CommandPalette />
            <ReminderNotifier />
            <UsernamePrompt />
            </ToastProvider>
            </InboxProvider>
            </InstallProvider>
            </NoteDraftProvider>
            </NoteMetaProvider>
          </UserKeysProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
