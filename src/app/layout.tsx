import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Figtree, Fraunces, Noto_Sans_Tamil, Noto_Serif_Tamil } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale, getMessages, getT } from "@/lib/i18n";
import { getBaseUrl } from "@/lib/request";
import "./globals.css";

const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
// Tamil faces load on demand (unicode-range), so English pages don't pay for them.
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil", display: "swap", preload: false });
const tamilSerif = Noto_Serif_Tamil({ subsets: ["tamil"], variable: "--font-tamil-serif", display: "swap", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    metadataBase: new URL(await getBaseUrl()),
    title: { default: t("site.title"), template: `%s · ${t("site.name")}` },
    description: t("site.description"),
    openGraph: {
      type: "website",
      siteName: t("site.name"),
      title: t("site.title"),
      description: t("site.description"),
      locale: locale === "ta" ? "ta_IN" : "en_IN",
      images: ["/images/kolam-hero.jpg"],
    },
  };
}

export const viewport: Viewport = { themeColor: "#fbf5ea", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${body.variable} ${heading.variable} ${tamil.variable} ${tamilSerif.variable}`}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
