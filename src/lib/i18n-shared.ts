import en from "../../messages/en.json";

export type Messages = typeof en;
export const locales = ["en", "ta"] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = "locale";

type Leaves<T, P extends string = ""> = T extends string
  ? P
  : { [K in keyof T & string]: Leaves<T[K], P extends "" ? K : `${P}.${K}`> }[keyof T & string];

/** Every valid dotted translation key, checked at compile time. */
export type MsgKey = Leaves<Messages>;
export type Vars = Record<string, string | number>;
export type TFn = (key: MsgKey, vars?: Vars) => string;

export function createT(messages: Messages): TFn {
  return (key, vars) => {
    let cur: unknown = messages;
    for (const part of key.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[part];
    let out = typeof cur === "string" ? cur : key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}

/** Shape returned by form server actions. `error` / `ok` hold translation keys. */
export type FormState = { error?: string; ok?: string } | null;
