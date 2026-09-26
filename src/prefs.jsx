// Preferencias de visualización: idioma (es/en) y moneda (DOP/USD).
// Todos los montos se guardan y calculan internamente en DOP; la moneda
// elegida solo afecta cómo se muestran y cómo se escriben.
import { createContext, useCallback, useContext, useMemo } from 'react';
import { EN } from './i18n-en.js';

export const CURRENCIES = {
  DOP: { sym: "RD$" },
  USD: { sym: "US$" },
};

const PrefsContext = createContext({ lang: "es", currency: "DOP", rate: 1 });

export function PrefsProvider({ lang, currency, rate, children }) {
  const value = useMemo(() => ({ lang, currency, rate: rate > 0 ? rate : 1 }), [lang, currency, rate]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}

export const localeFor = (lang) => (lang === "en" ? "en-US" : "es-DO");

const missing = new Set();
export function translate(lang, s, vars) {
  let out = s;
  if (lang === "en") {
    if (s in EN) out = EN[s];
    else if (import.meta.env.DEV && !missing.has(s)) {
      missing.add(s);
      console.warn("[i18n] missing EN:", s);
    }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : out;
}

export function useT() {
  const { lang } = usePrefs();
  return useCallback((s, vars) => translate(lang, s, vars), [lang]);
}

export const toCurrency = (dop, currency, rate) => (currency === "USD" ? dop / (rate || 1) : dop);

export function makeMoney(currency, rate, lang) {
  const sym = CURRENCIES[currency].sym;
  const locale = localeFor(lang);
  const fmt = (v) =>
    sym + " " +
    toCurrency(Number(v || 0), currency, rate).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtShort = (v) => {
    const n = toCurrency(Number(v || 0), currency, rate);
    if (Math.abs(n) >= 1e6) return sym + " " + (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return sym + " " + (n / 1e3).toFixed(1) + "K";
    return sym + " " + n.toFixed(0);
  };
  return { fmt, fmtShort, sym, currency, rate, locale };
}

export function useMoney() {
  const { currency, rate, lang } = usePrefs();
  return useMemo(() => makeMoney(currency, rate, lang), [currency, rate, lang]);
}
