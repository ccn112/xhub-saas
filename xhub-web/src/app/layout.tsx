import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: "XHub · X.Space",
  description: "Không gian làm việc hợp nhất cho doanh nghiệp",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Locale comes from the NEXT_LOCALE cookie (src/i18n/request.ts) — no URL
  // prefix, so every existing route/link stays exactly where it is.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable} h-full`}>
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
