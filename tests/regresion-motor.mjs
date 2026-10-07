// Prueba de regresión del motor de cálculo.
// Calcula los mismos casos con el motor de una versión anterior (commit de git)
// y con el motor actual (src/calc.js), y compara valor por valor las 4
// iteraciones, el resultado final y todas las series del flujo de caja.
//
// Uso: node tests/regresion-motor.mjs <commit-base> [caso.json ...]
//   Sin archivos, usa los ejemplos precargados de la aplicación.
//   Los archivos se leen sin modificarse; se imprime su huella SHA-256.
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [baseRef, ...files] = process.argv.slice(2);
if (!baseRef) {
  console.error('uso: node tests/regresion-motor.mjs <commit-base> [caso.json ...]');
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fsc-reg-'));
const oldFile = path.join(tmp, 'calc_base.mjs');
fs.writeFileSync(oldFile, execFileSync('git', ['show', `${baseRef}:src/calc.js`], { cwd: root }));
const OLD = await import(pathToFileURL(oldFile));
const NEW = await import(pathToFileURL(path.join(root, 'src/calc.js')));

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Mismo camino que la importación de la aplicación: parámetros sobre los
// valores por defecto y cobros normalizados con el anticipo.
function run(M, c) {
  const p = { ...M.DEFAULTS, ...c.params };
  const cobros = M.normalizeCobros(c.cobros || M.DEFAULT_COBROS, p.ANTICIPO);
  return M.iterateFSC(p, c.avance, cobros);
}

function compare(a, b, at, acc) {
  if (typeof a === 'number' || typeof b === 'number') {
    acc.values++;
    if (!Object.is(a, b)) acc.diffs.push(`${at}: ${a} ≠ ${b}`);
  } else if (Array.isArray(a)) {
    a.forEach((v, i) => compare(v, b?.[i], `${at}[${i}]`, acc));
  } else if (a && typeof a === 'object') {
    for (const k of Object.keys(a)) compare(a[k], b?.[k], `${at}.${k}`, acc);
  }
}

const cases = files.length
  ? files.map((f) => {
      const buf = fs.readFileSync(f);
      return { name: path.basename(f), sha: sha(buf), data: JSON.parse(buf) };
    })
  : Object.entries(NEW.EXAMPLES).map(([k, ex]) => ({ name: `ejemplo ${k}`, data: ex }));

let total = 0, failed = 0;
for (const c of cases) {
  const acc = { values: 0, diffs: [] };
  const a = run(OLD, c.data), b = run(NEW, c.data);
  compare(a, b, 'res', acc);
  total += acc.values;
  failed += acc.diffs.length;
  const f = b.finalResult;
  console.log(`${c.name}\n  valores ${acc.values} · diferencias ${acc.diffs.length}` +
    `\n  FSC ${f.FSC} · PTV ${f.PTV} · IMO ${f.IMO} · PIT ${f.PIT}` +
    (c.sha ? `\n  sha256 ${c.sha}` : ''));
  acc.diffs.slice(0, 10).forEach((d) => console.log('    ' + d));
}
console.log(`\nTotal: ${total} valores, ${failed} diferencias (${baseRef} → actual)`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
