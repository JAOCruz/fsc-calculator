// Lee un monto escrito a mano en formato español (1.666,67) o US (1,666.67).
// Devuelve un número >= 0, o null si no hay ningún número.
// Reglas:
//  - con "." y "," juntos, el último que aparece es el decimal;
//  - un solo separador que se repite (1.234.567) es de miles;
//  - un solo separador aparecido una vez (1666,67 / 1666.67) es decimal.
export function parseAmount(raw) {
  const text = String(raw ?? "");
  const s = text.replace(/[^\d,.]/g, "");
  if (!/\d/.test(s)) return null;
  // Los montos no admiten negativos: un signo menos inicial da 0.
  if (/^[^\d,.]*-/.test(text)) return 0;
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
  return isNaN(n) ? null : n;
}
