// Prueba de aceptación de la moneda base por caso, en el navegador.
// Importa un caso sin moneda base (p. ej. la R2) en la versión anterior y en la
// corregida, y comprueba los criterios acordados:
//   1. mismos resultados de cálculo;
//   2. importes identificados en la moneda confirmada, sin convertirlos;
//   3. exportar y volver a importar conserva los valores;
//   4. el archivo original no se modifica (huella SHA-256);
//   y además: casos guardados en el navegador sin moneda piden confirmarla, la
//   conversión para visualizar usa la tasa del caso, lo que se escribe en la
//   otra moneda se guarda convertido a la base, y el asistente recibe la moneda.
//
// Uso: node tests/aceptacion-moneda.mjs <url-anterior> <url-corregida> <caso.json> <carpeta-salida> [DOP|USD]
// Requiere Playwright (PLAYWRIGHT_MODULE apunta a su index.mjs si no está instalado aquí).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const [oldUrl, newUrl, caseFile, outDir, base = 'USD'] = process.argv.slice(2);
if (!outDir) {
  console.error('uso: node tests/aceptacion-moneda.mjs <url-anterior> <url-corregida> <caso.json> <carpeta-salida> [DOP|USD]');
  process.exit(1);
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(outDir, { recursive: true });
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const original = JSON.parse(fs.readFileSync(caseFile));
const shaBefore = sha(caseFile);
const sym = base === 'USD' ? 'US$' : 'RD$';
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const open = async (url) => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page };
};
const dock = async (page) => (await page.locator('.results-dock').innerText()).replace(/\s+/g, ' ');
const importFile = async (page, f) => { await page.locator('input[type=file]').first().setInputFiles(f); await page.waitForTimeout(1200); };
const dialog = (page) => page.locator('[role=dialog][aria-modal=true]');
// Solo cifras de resultados: se omite la numeración de pasos, que cambió en b422083.
const numbers = (s) => (s.replace(/(paso|step) \d+/gi, '').match(/[\d][\d,.]*/g) || []).join(' ');

// Versión anterior: referencia de resultados en pantalla.
const A = await open(oldUrl);
await importFile(A.page, caseFile);
const oldDock = await dock(A.page);
await A.page.screenshot({ path: path.join(outDir, '1_anterior.png') });
await A.ctx.close();

// Versión corregida: importar un archivo sin moneda base.
const B = await open(newUrl);
await importFile(B.page, caseFile);
const asked = await dialog(B.page).isVisible();
check('Al importar un caso sin moneda base, se pide confirmarla', asked && !('MONEDA_BASE' in (original.params || {})));
await B.page.screenshot({ path: path.join(outDir, '2_confirmar_moneda.png') });
await B.page.click(`[role=dialog] button:has-text("${sym}")`);
await B.page.waitForTimeout(800);
const newDock = await dock(B.page);
await B.page.screenshot({ path: path.join(outDir, '3_corregida_moneda_base.png') });
const ptv = original.final?.PTV;
const ptvTxt = ptv != null ? ptv.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
check('Mismos resultados de cálculo que la versión anterior', numbers(oldDock) === numbers(newDock));
check(`Importes identificados en ${sym} sin convertir`, ptvTxt && newDock.includes(`${sym} ${ptvTxt}`), ptvTxt ? `PTV ${sym} ${ptvTxt}` : '');
check(`Ningún monto del panel aparece en la otra moneda`, !newDock.includes(base === 'USD' ? 'RD$' : 'US$'));

// Conversión solo para visualizar, con la tasa del caso.
const other = base === 'USD' ? 'RD$' : 'US$';
await B.page.click(`header button:text-is("${other}")`);
await B.page.waitForTimeout(600);
const rate = await B.page.evaluate(() => JSON.parse(localStorage.getItem('fsc-current-params')).TASA_CAMBIO);
const conv = base === 'USD' ? ptv * rate : ptv / rate;
const convTxt = conv.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
check(`Ver en ${other} convierte con la tasa del caso (${rate})`, (await dock(B.page)).includes(`${other} ${convTxt}`), `${other} ${convTxt}`);
await B.page.screenshot({ path: path.join(outDir, '4_vista_otra_moneda.png') });
await B.page.click(`header button:text-is("${sym}")`);
await B.page.waitForTimeout(400);
const stored = await B.page.evaluate(() => JSON.parse(localStorage.getItem('fsc-current-params')));
check('Los importes guardados no cambian al ver en otra moneda', stored.CD === original.params.CD && stored.PCM === original.params.PCM);

// El asistente recibe la moneda base.
let aiCtx = null;
await B.page.route('**/ask-ai', async (route) => {
  aiCtx = route.request().postDataJSON()?.context;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'ok' }) });
});
const hasAssistant = await B.page.locator('#fsc-assistant-btn').count();
if (hasAssistant) {
  await B.page.click('#fsc-assistant-btn');
  await B.page.fill('#fsc-assistant-input', 'prueba');
  await B.page.click('#fsc-assistant-send');
  await B.page.waitForTimeout(1500);
}
check('El asistente de IA recibe la moneda base y la tasa', aiCtx?.MONEDA_BASE === base && aiCtx?.TASA_CAMBIO === rate, aiCtx ? `MONEDA_BASE ${aiCtx.MONEDA_BASE}, tasa ${aiCtx.TASA_CAMBIO}` : 'sin solicitud');

// Exportar y volver a importar.
const [dl] = await Promise.all([B.page.waitForEvent('download'), B.page.click('button:has-text("Exportar caso")')]);
const exported = path.join(outDir, 'caso_exportado.json');
await dl.saveAs(exported);
await B.ctx.close();
const e = JSON.parse(fs.readFileSync(exported));
const changed = Object.keys(original.params).filter((k) => !Object.is(original.params[k], e.params[k]));
const added = Object.keys(e.params).filter((k) => !(k in original.params));
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
check('El archivo exportado guarda la moneda base', e.params.MONEDA_BASE === base);
check('Exportar conserva parámetros, calendarios y resultados', !changed.length && same(original.avance, e.avance) && same(original.cobros, e.cobros) && (!original.final || same(original.final, e.final)),
  `campos agregados: ${added.join(', ') || 'ninguno'}`);
const C = await open(newUrl);
await importFile(C.page, exported);
check('Al reimportar no se vuelve a pedir la moneda', !(await dialog(C.page).isVisible()));
check('Reimportar muestra los mismos valores', (await dock(C.page)) === newDock);
await C.page.reload({ waitUntil: 'networkidle' });
check('Al recargar la página se conserva la moneda base', !(await dialog(C.page).isVisible()) && (await dock(C.page)) === newDock);
await C.ctx.close();

// Casos guardados en el navegador antes de la corrección (sin moneda base).
const D = await open(newUrl);
await D.page.evaluate((c) => {
  localStorage.setItem('fsc-current-params', JSON.stringify(c.params));
  localStorage.setItem('fsc-current-avance', JSON.stringify(c.avance));
  localStorage.setItem('fsc-current-cobros', JSON.stringify(c.cobros));
  localStorage.setItem('fsc-project-name', c.projectName || 'caso');
}, original);
await D.page.reload({ waitUntil: 'networkidle' });
check('Un caso guardado en el navegador sin moneda base también pide confirmarla', await dialog(D.page).isVisible());
await D.page.click(`[role=dialog] button:has-text("${sym}")`);
await D.page.waitForTimeout(500);
// Escribir un monto en la otra moneda lo guarda convertido a la moneda base.
const cdBox = D.page.locator('#proyecto input[inputmode=decimal]').first();
const cdField = cdBox.locator('xpath=ancestor::div[2]');
await cdField.locator(`button:text-is("${other}")`).first().click();
// Como un usuario: clic, esperar a que el campo se prepare y escribir.
await cdBox.click();
await D.page.waitForTimeout(300);
await D.page.keyboard.press('Meta+A');
await D.page.keyboard.type(String(rate), { delay: 60 });
await D.page.keyboard.press('Enter');
await D.page.waitForTimeout(500);
const cdStored = await D.page.evaluate(() => JSON.parse(localStorage.getItem('fsc-current-params')).CD);
const expectCD = base === 'USD' ? 1 : rate * rate;
check(`Escribir en ${other} guarda el valor en la moneda base`, Math.abs(cdStored - expectCD) < 1e-9, `${other} ${rate} → ${cdStored} ${base}`);
await D.ctx.close();
await browser.close();

const shaAfter = sha(caseFile);
check('El archivo original no se modificó (huella SHA-256)', shaBefore === shaAfter, shaAfter);
const ok = checks.every((c) => c.ok);
fs.writeFileSync(path.join(outDir, 'resultado.json'), JSON.stringify({ fecha: new Date().toISOString(), oldUrl, newUrl, caso: path.basename(caseFile), sha256: shaAfter, base, checks, ok }, null, 1));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} comprobaciones correctas`);
process.exit(ok ? 0 : 1);
