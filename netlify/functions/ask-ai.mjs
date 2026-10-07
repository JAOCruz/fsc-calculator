// Asistente FSC: responde preguntas sobre el Factor de Sobrecosto usando el
// estado actual de la calculadora como contexto.
// Proveedor principal: Gemini (GEMINI_API_KEY, GEMINI_MODEL).
// Respaldo: Azure OpenAI (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
// AZURE_OPENAI_DEPLOYMENT_NAME, AZURE_OPENAI_API_VERSION).

const MAX_QUESTION = 2000;
const MAX_HISTORY = 12;
const MAX_TURN = 4000;
// Las funciones síncronas de Netlify cortan a los ~10 s: todos los intentos
// comparten este presupuesto de tiempo.
const BUDGET_MS = 9000;
// Si el modelo configurado está saturado (503/429) se prueba el siguiente
const GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

const SYSTEM_ES = `Eres un asesor técnico senior en costos y precios de construcción en República Dominicana, experto en la metodología del Factor de Sobrecosto (FSC) de Suárez Salazar (2005) adaptada al mercado dominicano (CODIA, Fondo de Pensiones, ITBIS, ISR, tasas financieras locales).

Conceptos del modelo:
- CD: Costo Directo de Obra. PTV = CD × FSC: Precio Técnico de Venta.
- CO: indirecto de operación (oficina central). CC: indirecto de campo. CI: imprevistos.
- F: factor de financiamiento = PIT / CD, donde PIT son los intereses pagados por el déficit del flujo de caja (tasa activa) e IMO es la inversión máxima de obra (máximo déficit acumulado).
- TAT = TPA + REA + TEA. RC = PTV / IMO (revolvencia). UAE = TAT / RC. GND = SGND / CD. UAI = UAE + GND. UC = UAI / (1 − ISR).
- FSC = (1 + CO + CC + CI + F + CODIA + FON) × (1 + UC). Se itera 4 veces y el FSC final es el promedio de las iteraciones 3 y 4.
- PCM: Precio Comercial de Mercado; DM = PCM − PTV.
- El ITBIS no forma parte del FSC; se analiza por escenarios fiscales.

Reglas:
- Responde de forma clara, concreta y breve (máximo ~250 palabras salvo que pidan detalle). Usa **negritas** para cifras clave.
- Cuando haya datos del proyecto, úsalos y cita las cifras. No inventes datos que no estén en el contexto.
- Los montos del contexto están en la moneda base del caso (MONEDA_BASE: DOP o USD), sin convertir. Si hace falta la otra moneda, convierte con la tasa de cambio indicada (RD$ por US$ 1).
- Tus recomendaciones son apoyo analítico: recuerda validar parámetros fiscales y financieros con Contabilidad/Finanzas o un asesor cuando corresponda.`;

const LANG_RULE = {
  es: "Responde siempre en español.",
  en: "Always answer in English. Keep the model's acronyms (FSC, PTV, CD, IMO, etc.) as they are.",
};

function describeContext(ctx) {
  if (!ctx || typeof ctx !== "object") return "No hay datos del proyecto disponibles (la calculadora aún no tiene un resultado válido).";
  const { avance, cobros, iterations, cashFlow, ...rest } = ctx;
  const base = rest.MONEDA_BASE === "USD" ? "USD" : "DOP";
  const lines = [`Datos actuales de la calculadora (montos en ${base}, tasas como fracción):`, JSON.stringify(rest)];
  if (Array.isArray(avance) && avance.length) lines.push("Avance mensual de egresos: " + JSON.stringify(avance));
  if (Array.isArray(cobros) && cobros.length) lines.push("Cobros mensuales netos (M1 = anticipo): " + JSON.stringify(cobros));
  if (cashFlow && Array.isArray(cashFlow.DIFA)) lines.push("Saldo acumulado mensual (DIFA): " + JSON.stringify(cashFlow.DIFA.map((v) => Math.round(v))));
  if (Array.isArray(iterations) && iterations.length) lines.push("FSC por iteración: " + JSON.stringify(iterations.map((it) => it.FSC)));
  return lines.join("\n").slice(0, 12000);
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TURN) }));
}

async function askGemini(system, history, question, deadline) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const models = [...new Set([process.env.GEMINI_MODEL, ...GEMINI_FALLBACKS].filter(Boolean))];
  const contents = [
    ...history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: question }] },
  ];
  // Gemini exige que la conversación empiece con un turno del usuario
  while (contents.length && contents[0].role !== "user") contents.shift();
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });

  const errors = [];
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 1000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(left),
      });
      if (!res.ok) {
        errors.push(`${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        if (res.status === 503 || res.status === 429 || res.status === 404) continue;
        break; // 400/401/403: otro modelo no lo va a arreglar
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
      if (text) return text;
      errors.push(`${model}: empty answer`);
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error("Gemini: " + errors.join(" | "));
}

async function askAzure(system, history, question, deadline) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const version = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
  if (!endpoint || !key || !deployment) throw new Error("Azure OpenAI not configured");
  const left = deadline - Date.now();
  if (left < 1000) throw new Error("Azure: no time left");
  const base = endpoint.replace(/\/+$/, "");
  // Soporta endpoints v1 (".../openai/v1") y el formato clásico por deployment
  const isV1 = /\/openai\/v1$/.test(base);
  const url = isV1
    ? `${base}/chat/completions`
    : `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(version)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    signal: AbortSignal.timeout(left),
    body: JSON.stringify({
      ...(isV1 ? { model: deployment } : {}),
      messages: [{ role: "system", content: system }, ...history, { role: "user", content: question }],
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Azure returned an empty answer");
  return text;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
  if (!question) return json(400, { error: "Missing question" });

  const ctx = body.context || null;
  const lang = ctx?.lang === "en" ? "en" : "es";
  const extra = [];
  if (ctx?.TASA_CAMBIO) extra.push(`Tasa de cambio: RD$ ${ctx.TASA_CAMBIO} por US$ 1.`);
  const base = ctx?.MONEDA_BASE === "USD" ? "USD" : "DOP";
  extra.push(base === "USD"
    ? "Moneda base del caso: dólares (USD). Los importes ya están en US$: no los conviertas de nuevo."
    : "Moneda base del caso: pesos dominicanos (DOP).");
  if (ctx?.currency && ctx.currency !== base) {
    extra.push(ctx.currency === "USD"
      ? "El usuario está viendo los montos en dólares (USD): presenta las cifras en US$ (y en RD$ si ayuda)."
      : "El usuario está viendo los montos en pesos (DOP): presenta las cifras en RD$ (y en US$ si ayuda).");
  }
  const system = [SYSTEM_ES, LANG_RULE[lang], ...extra, describeContext(ctx)].join("\n\n");
  const history = cleanHistory(body.history);

  const deadline = Date.now() + BUDGET_MS;
  const errors = [];
  for (const ask of [askGemini, askAzure]) {
    try {
      const answer = await ask(system, history, question, deadline);
      return json(200, { answer });
    } catch (e) {
      errors.push(e.message);
    }
  }
  console.error("ask-ai failed:", errors.join(" | "));
  return json(502, { error: lang === "en" ? "The assistant is not available right now." : "El asistente no está disponible en este momento." });
};
