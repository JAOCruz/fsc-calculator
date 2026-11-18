// Prueba de aceptación de la corrección de la coma decimal, en el navegador.
// Comprueba lo acordado con el titular el 3 de noviembre de 2026:
//   1. enfocar un campo y salir sin editarlo no cambia ningún valor;
//   2. los montos se leen igual en formato español y US, con la lectura visible;
//   3. las entradas ambiguas ("1,234", "1.234") no se aplican en silencio: se pide
//      confirmar si es de miles o decimal, y hasta entonces el valor no cambia;
//   4. exportar y volver a importar conserva los importes;
//   5. el archivo del caso no se modifica (huella SHA-256).
//
// Uso: node tests/aceptacion-coma-decimal.mjs <url> <caso.json> <carpeta-salida> [DOP|USD]
// Requiere Playwright (PLAYWRIGHT_MODULE apunta a su index.mjs si no está instalado aquí).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const [url, caseFile, outDir, base = 'USD'] = process.argv.slice(2);
if (!outDir) {
  console.error('uso: node tests/aceptacion-coma-decimal.mjs <url> <caso.json> <carpeta-salida> [DOP|USD]');
  process.exit(1);
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(outDir, { recursive: true });
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const shaBefore = sha(caseFile);
const sym = base === 'USD' ? 'US$' : 'RD$';
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`); };
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const open = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
};
const importFile = async (page, f) => { await page.locator('input[type=file]').first().setInputFiles(f); await page.waitForTimeout(1200); };
const dialog = (page) => page.locator('[role=dialog][aria-modal=true]');
const state = (page) => page.evaluate(() => ({
  params: JSON.parse(localStorage.getItem('fsc-current-params')),
  avance: JSON.parse(localStorage.getItem('fsc-current-avance')),
  cobros: JSON.parse(localStorage.getItem('fsc-current-cobros')),
}));
const dock = async (page) => (await page.locator('.results-dock').innerText()).replace(/\s+/g, ' ');

const A = await open();
const page = A.page;
await importFile(page, caseFile);
if (await dialog(page).isVisible()) { await page.click(`[role=dialog] button:has-text("${sym}")`); await page.waitForTimeout(800); }
const s0 = await state(page);
const dock0 = await dock(page);

// 1. Foco sin edición en todos los campos escribibles.
const fields = page.locator('.shell input[type=text], .shell input[type=number]');
const nFields = await fields.count();
const shownBefore = await fields.evaluateAll((els) => els.map((e) => e.value));
for (let i = 0; i < nFields; i++) {
  const f = fields.nth(i);
  if (!(await f.isVisible()) || !(await f.isEditable())) continue;
  await f.click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);
}
await page.waitForTimeout(400);
const s1 = await state(page);
const shownAfter = await fields.evaluateAll((els) => els.map((e) => e.value));
const changedKeys = Object.keys(s0.params).filter((k) => !Object.is(s0.params[k], s1.params[k]));
check(`Enfocar y salir sin editar no cambia ningún valor (${nFields} campos)`,
  !changedKeys.length && same(s0.avance, s1.avance) && same(s0.cobros, s1.cobros),
  changedKeys.length ? `cambiaron: ${changedKeys.join(', ')}` : 'parámetros, avance y cobros idénticos');
check('Los campos muestran lo mismo antes y después', same(shownBefore, shownAfter));
check('Los resultados no cambian', (await dock(page)) === dock0);

// 2. Formatos español y US en el Costo Directo, con la lectura visible.
const cd = page.locator('#proyecto [data-money-input]').first();
const typeIn = async (box, txt, finish = 'Enter') => {
  await box.click(); await page.waitForTimeout(250);
  await page.keyboard.press('Meta+A');
  await page.keyboard.type(txt, { delay: 30 });
  await page.waitForTimeout(250);
  if (finish) { await page.keyboard.press(finish); await page.waitForTimeout(300); }
};
const cdStored = async () => (await state(page)).params.CD;
const formatos = [
  ['1666,67', 1666.67], ['1666.67', 1666.67], ['1.666,67', 1666.67], ['1,666.67', 1666.67],
  ['1.234.567,89', 1234567.89], ['1,234,567.89', 1234567.89], ['1.234.567', 1234567], ['0,5', 0.5],
];
for (const [txt, want] of formatos) {
  await typeIn(cd, txt, null);
  const reading = await page.locator('[data-money-reading]').first().innerText().catch(() => '');
  if (txt === '1.666,67') await page.screenshot({ path: path.join(outDir, '1_lectura_visible.png'), clip: await page.locator('#proyecto').boundingBox() });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const got = await cdStored();
  check(`"${txt}" se guarda como ${want}`, Math.abs(got - want) < 1e-9, `${got} · ${reading.replace(/\s+/g, ' ')}`);
}

// 3. Entradas ambiguas.
const alert = page.locator('[data-money-ambiguous]');
const before = await cdStored();
await typeIn(cd, '1,234', null);
check('"1,234" pide confirmar si es de miles o decimal', await alert.isVisible(), (await alert.innerText().catch(() => '')).replace(/\s+/g, ' '));
check('Mientras no se confirma, el valor guardado no cambia', (await cdStored()) === before, `CD ${await cdStored()}`);
await page.screenshot({ path: path.join(outDir, '2_confirmacion_ambigua.png'), clip: await page.locator('#proyecto').boundingBox() });
await page.keyboard.press('Tab'); await page.waitForTimeout(300);
check('Al salir del campo la pregunta sigue visible y el valor no cambia', (await alert.isVisible()) && (await cdStored()) === before);
await alert.locator('[data-choice=miles]').click(); await page.waitForTimeout(300);
check('Elegir "miles" guarda 1234', (await cdStored()) === 1234 && !(await alert.isVisible()), `CD ${await cdStored()}`);
await typeIn(cd, '1.234', null);
await alert.locator('[data-choice=decimal]').click(); await page.waitForTimeout(300);
check('"1.234" y elegir "decimal" guarda 1.234', (await cdStored()) === 1.234, `CD ${await cdStored()}`);
await typeIn(cd, '12.500', null);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check('Esc descarta una entrada ambigua sin cambiar el valor', (await cdStored()) === 1.234 && !(await alert.isVisible()), `CD ${await cdStored()}`);

// 4. Exportar y volver a importar con importes escritos con coma decimal.
await typeIn(cd, '62.445.312,95');
const pcm = page.locator('#mercado [data-money-input]').first();
await typeIn(pcm, '98765432,1');
const sg = page.locator('[data-money-input]').nth(1);
await typeIn(sg, '2.500,55');
const sx = await state(page);
const dockX = await dock(page);
check('Los importes escritos con coma decimal se guardan exactos', sx.params.CD === 62445312.95 && sx.params.PCM === 98765432.1 && sx.params.SGND === 2500.55,
  `CD ${sx.params.CD} · PCM ${sx.params.PCM} · SGND ${sx.params.SGND}`);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exportar caso")')]);
const exported = path.join(outDir, 'caso_exportado.json');
await dl.saveAs(exported);
await A.ctx.close();
const e = JSON.parse(fs.readFileSync(exported));
check('El archivo exportado conserva todos los importes y calendarios', same(e.params, sx.params) && same(e.avance, sx.avance) && same(e.cobros, sx.cobros),
  `CD ${e.params.CD} · PCM ${e.params.PCM} · SGND ${e.params.SGND}`);
const B = await open();
await importFile(B.page, exported);
const sb = await state(B.page);
check('Al reimportar, los importes son idénticos', same(sb.params, sx.params) && same(sb.avance, sx.avance) && same(sb.cobros, sx.cobros));
check('Al reimportar, los resultados son idénticos', (await dock(B.page)) === dockX);
const cdShown = await B.page.locator('#proyecto [data-money-input]').first().inputValue();
check('El CD reimportado se muestra con sus decimales', cdShown === (62445312.95).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), cdShown);
await B.ctx.close();
await browser.close();

const shaAfter = sha(caseFile);
check('El archivo del caso no se modificó (huella SHA-256)', shaBefore === shaAfter, shaAfter);
const ok = checks.every((c) => c.ok);
fs.writeFileSync(path.join(outDir, 'resultado.json'), JSON.stringify({ fecha: new Date().toISOString(), url, caso: path.basename(caseFile), sha256: shaAfter, base, checks, ok }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} comprobaciones correctas`);
process.exit(ok ? 0 : 1);
