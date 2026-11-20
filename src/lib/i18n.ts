import { cache } from "react";
import { cookies } from "next/headers";
import en from "../../messages/en.json";
import ta from "../../messages/ta.json";
import { createT, LOCALE_COOKIE, type Locale, type Messages } from "./i18n-shared";

// Typing `ta` as Messages makes a missing Tamil key a compile error.
const all: Record<Locale, Messages> = { en, ta };

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "ta" ? "ta" : "en";
});

export const getMessages = (locale: Locale): Messages => all[locale];

export async function getT() {
  const locale = await getLocale();
  return { t: createT(all[locale]), locale };
}
