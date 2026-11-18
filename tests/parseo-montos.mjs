// Prueba del lector de montos (src/parseAmount.js): formatos español y US.
// Uso: node tests/parseo-montos.mjs
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseAmount, readAmount } = await import(pathToFileURL(path.join(root, 'src/parseAmount.js')));

const casos = [
  // [entrada, esperado]
  ['1666,67', 1666.67],        // coma decimal (español)
  ['1666.67', 1666.67],        // punto decimal (el campo se rellena así al enfocar)
  ['1.666,67', 1666.67],       // español con miles
  ['1,666.67', 1666.67],       // US con miles
  ['1.234.567,89', 1234567.89],
  ['1,234,567.89', 1234567.89],
  ['1.234.567', 1234567],      // punto repetido = miles
  ['1,234,567', 1234567],      // coma repetida = miles
  ['0,5', 0.5],
  ['1500', 1500],
  ['RD$ 1.500,50', 1500.5],
  ['-5', 0],                   // sin negativos
  ['', null],
  ['abc', null],
  ['1234,567', 1234.567],      // 4 cifras delante: no puede ser de miles
  ['0,123', 0.123],            // empieza en 0: decimal
  ['1,23', 1.23],
  ['1.2345', 1.2345],
  ['1,234', null],             // ambiguo: no se elige en silencio
  ['1.234', null],
  ['12.500', null],
  ['RD$ 999,999', null],
];

// Entradas ambiguas: se ofrecen las dos lecturas.
const ambiguos = [
  // [entrada, miles, decimal]
  ['1,234', 1234, 1.234],
  ['1.234', 1234, 1.234],
  ['12.500', 12500, 12.5],
  ['999,999', 999999, 999.999],
];
const noAmbiguos = ['1,234,567', '1.234,56', '1,234.56', '1234,567', '0,123', '1666,67', '1,2345', '1234'];

let fallos = 0;
for (const [entrada, esperado] of casos) {
  const obtenido = parseAmount(entrada);
  try {
    if (esperado === null) assert.strictEqual(obtenido, null);
    else assert.ok(obtenido !== null && Math.abs(obtenido - esperado) < 1e-9, `obtenido ${obtenido}`);
    console.log(`ok   "${entrada}" -> ${obtenido}`);
  } catch (e) {
    fallos++;
    console.log(`FAIL "${entrada}" esperado ${esperado}: ${e.message}`);
  }
}
for (const [entrada, miles, dec] of ambiguos) {
  const r = readAmount(entrada);
  const ok = r.ambiguous && r.value === null && r.asThousands === miles && Math.abs(r.asDecimal - dec) < 1e-12;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} "${entrada}" ambiguo -> miles ${r.asThousands} / decimal ${r.asDecimal}`);
}
for (const entrada of noAmbiguos) {
  const r = readAmount(entrada);
  if (r.ambiguous) fallos++;
  console.log(`${r.ambiguous ? 'FAIL' : 'ok  '} "${entrada}" no ambiguo -> ${r.value}`);
}
if (fallos) { console.log(`${fallos} fallo(s)`); process.exit(1); }
console.log('Todos los casos pasan.');
