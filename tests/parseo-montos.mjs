// Prueba del lector de montos (src/parseAmount.js): formatos español y US.
// Uso: node tests/parseo-montos.mjs
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseAmount } = await import(pathToFileURL(path.join(root, 'src/parseAmount.js')));

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
];

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
if (fallos) { console.log(`${fallos} fallo(s)`); process.exit(1); }
console.log('Todos los casos pasan.');
