// Lee un monto escrito a mano en formato español (1.666,67) o US (1,666.67).
// Reglas:
//  - con "." y "," juntos, el último que aparece es el decimal;
//  - un solo separador que se repite (1.234.567) es de miles;
//  - un solo separador aparecido una vez (1666,67 / 1666.67) es decimal,
//    salvo que tenga de 1 a 3 cifras delante (sin empezar en 0) y exactamente
//    3 detrás ("1,234", "12.500"): eso puede ser de miles o decimal, y el
//    campo pide confirmarlo en vez de elegir en silencio.

// Devuelve { value, ambiguous, asThousands, asDecimal }.
// value: número >= 0, o null si no hay ningún número. Si ambiguous es true,
// value es null y asThousands / asDecimal son las dos lecturas posibles.
export function readAmount(raw) {
  const text = String(raw ?? "");
  const s = text.replace(/[^\d,.]/g, "");
  const none = { value: null, ambiguous: false, asThousands: null, asDecimal: null };
  if (!/\d/.test(s)) return none;
  // Los montos no admiten negativos: un signo menos inicial da 0.
  if (/^[^\d,.]*-/.test(text)) return { ...none, value: 0 };
  const m = s.match(/^([1-9]\d{0,2})[.,](\d{3})$/);
  if (m) {
    return {
      value: null,
      ambiguous: true,
      asThousands: Number(m[1] + m[2]),
      asDecimal: parseFloat(`${m[1]}.${m[2]}`),
    };
  }
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decPos = -1;
  if (lastDot >= 0 && lastComma >= 0) decPos = Math.max(lastDot, lastComma);
  else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (sep && s.split(sep).length === 2) decPos = s.indexOf(sep);
  }
  const int = (decPos >= 0 ? s.slice(0, decPos) : s).replace(/[.,]/g, "");
  const dec = decPos >= 0 ? s.slice(decPos + 1).replace(/[.,]/g, "") : "";
  const n = parseFloat(`${int || "0"}.${dec || "0"}`);
  return isNaN(n) ? none : { ...none, value: n };
}

// Atajo: el número leído, o null si no hay número o si la entrada es ambigua.
export function parseAmount(raw) {
  return readAmount(raw).value;
}
