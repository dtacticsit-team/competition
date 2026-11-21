"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createT, type Locale, type Messages, type TFn } from "@/lib/i18n-shared";

const Ctx = createContext<{ t: TFn; locale: Locale } | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ t: createT(messages), locale }), [messages, locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("I18nProvider is missing");
  return ctx;
}

export const useT = () => useI18n().t;
export const useLocale = () => useI18n().locale;
