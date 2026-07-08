import type { Metadata, Viewport } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { AppShell } from "@/components/app-shell";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { InstallPrompt } from "@/components/install-prompt";
import { SwRegister } from "@/components/sw-register";
import { Toaster } from "@/components/ui/sonner";
import { t } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const kufi = Noto_Kufi_Arabic({
  variable: "--font-kufi",
  subsets: ["arabic"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const brandTitle = `${t("app_name")} — ${t("app_tagline")}`;

// Landing-page screenshot served from /public. Declared here rather than via
// the app/opengraph-image file convention so layout.tsx stays the single
// source of truth; per-route opengraph-image.tsx cards (trips, requests,
// routes) still override it on their own pages — file-based metadata wins.
const ogImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: brandTitle };

export const metadata: Metadata = {
  // Resolves relative OG/twitter URLs to absolute ones — WhatsApp et al.
  // refuse relative unfurl URLs.
  metadataBase: new URL(SITE_URL),
  title: {
    default: brandTitle,
    template: `%s — ${t("app_name")}`,
  },
  description: t("app_description"),
  applicationName: t("app_name"),
  appleWebApp: { capable: true, statusBarStyle: "default", title: t("app_name") },
  icons: { apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: t("app_name"),
    title: brandTitle,
    description: t("app_description"),
    locale: "ar_JO",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: brandTitle,
    description: t("app_description"),
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#211f1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="ar"
        dir="rtl"
        className={`${plexArabic.variable} ${kufi.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full">
          <ConvexClientProvider>
            <AppShell>{children}</AppShell>
            <SwRegister />
            <InstallPrompt />
            {/* top-center: the bottom tab bar owns the bottom edge on mobile */}
            <Toaster
              position="top-center"
              containerAriaLabel={t("tab_notifications")}
            />
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
