// Lee un monto escrito a mano en formato español (1.666,67) o US (1,666.67).
// Solo se aceptan estas formas (opcionalmente con el símbolo de moneda delante
// o detrás: US$, RD$, $, USD, DOP):
//  - cifras solas: 1500
//  - un separador, una vez, como decimal: 1666,67 · 1666.67 · 0,5 · ,5
//  - grupos de miles de 3 cifras separados por ".", "," o espacio, siempre el
//    mismo, con un decimal opcional que use el otro signo:
//    1.234.567 · 1,234,567.89 · 1.666,67 · 1 666,67
// Cualquier otra cosa ("1,2,3", "1.23.45", "12abc34", "1,234.5.6") es una
// entrada mal formada: no se convierte en ningún importe y el campo la rechaza
// conservando el valor anterior.
// Caso ambiguo: de 1 a 3 cifras delante (sin empezar en 0), un separador y
// exactamente 3 detrás ("1,234", "12.500"). Puede ser de miles o decimal, y el
// campo pide confirmarlo en vez de elegir en silencio.
// Los montos no admiten negativos: un signo menos delante de un monto válido da 0.

// Devuelve { value, ambiguous, invalid, asThousands, asDecimal }.
//  - value: número >= 0, o null si está vacío, es ambiguo o es inválido;
//  - ambiguous: true con las dos lecturas en asThousands / asDecimal;
//  - invalid: true si la entrada está mal formada.
const CUR = "(?:US\\$|RD\\$|USD|DOP|\\$)";
const PREFIX = new RegExp(`^${CUR}\\s*`, "i");
const SUFFIX = new RegExp(`\\s*${CUR}$`, "i");

export function readAmount(raw) {
  const none = { value: null, ambiguous: false, invalid: false, asThousands: null, asDecimal: null };
  const bad = { ...none, invalid: true };
  let s = String(raw ?? "").replace(/\u00a0|\u202f/g, " ").trim();
  if (s === "") return none;
  s = s.replace(PREFIX, "").replace(SUFFIX, "").trim();
  let negative = false;
  if (s.startsWith("-")) { negative = true; s = s.slice(1).trim(); }
  if (s === "") return bad;

  const amb = s.match(/^([1-9]\d{0,2})[.,](\d{3})$/);
  let n = null;
  if (/^\d+$/.test(s)) n = Number(s);
  else if (/^\d*[.,]\d+$/.test(s)) n = parseFloat(s.replace(",", ".").replace(/^\./, "0."));
  else {
    // Miles agrupados de 3 en 3 con el mismo separador, y decimal opcional con otro.
    const g = s.match(/^\d{1,3}(?:([., ])\d{3})(?:\1\d{3})*(?:([.,])(\d+))?$/);
    if (g && g[1] !== g[2]) {
      const int = s.slice(0, g[2] ? s.length - g[3].length - 1 : s.length).replace(/[., ]/g, "");
      n = parseFloat(`${int}.${g[3] || "0"}`);
    }
  }
  if (n === null || !Number.isFinite(n)) return bad;
  if (negative) return { ...none, value: 0 };
  if (amb) {
    return { ...none, ambiguous: true, asThousands: Number(amb[1] + amb[2]), asDecimal: parseFloat(`${amb[1]}.${amb[2]}`) };
  }
  return { ...none, value: n };
}

// Atajo: el número leído, o null si está vacío, es ambiguo o está mal formado.
export function parseAmount(raw) {
  return readAmount(raw).value;
}

// Lectura estricta para los campos numéricos de porcentajes y factores (NumField):
// la misma gramática que readAmount, admite un signo menos y, como esos valores
// son pequeños, lee "1,234" como decimal (1.234), igual que antes.
// Devuelve el número, null si está vacío o NaN si está mal formado.
export function readNumber(raw) {
  let s = String(raw ?? "").replace(/\u00a0|\u202f/g, " ").trim();
  if (s === "") return null;
  let sign = 1;
  if (s.startsWith("-")) { sign = -1; s = s.slice(1).trim(); }
  s = s.replace(/\s*%$/, "");
  if (s.startsWith("-")) return NaN;
  const r = readAmount(s);
  if (r.invalid || s === "") return NaN;
  const n = r.ambiguous ? r.asDecimal : r.value;
  return n === null ? NaN : sign * n;
}
