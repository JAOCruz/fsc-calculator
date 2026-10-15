import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fmtPct, fmtFactor, DEFAULTS, DEFAULT_AVANCE, DEFAULT_COBROS, makeDefaultCobros, normalizeCobros, iterateFSC, EXAMPLES, mergeParams } from './calc.js';
import { Stat, Def, Step, CurrencyToggle } from './ui.jsx';
import { PrefsProvider, useT, useMoney, usePrefs, localeFor, translate, CURRENCIES } from './prefs.jsx';
import { WaterfallFSC, CashFlowChart, Convergence, FSCGauge } from './viz.jsx';
import {
  StepProyecto, StepCostos, StepTasas, StepFiscal,
  StepCodia, StepCronograma, StepIngresos, StepItbis, StepMercado
} from './sections.jsx';

const STEP_NAV = [
  { id: "proyecto",   num: "01", label: "El proyecto" },
  { id: "costos",     num: "02", label: "Costos indirectos" },
  { id: "tasas",      num: "03", label: "Tasas financieras" },
  { id: "fiscal",     num: "04", label: "Aspectos fiscales" },
  { id: "codia",      num: "05", label: "CODIA · Pensiones" },
  { id: "ingresos",   num: "06", label: "Cronograma ingresos" },
  { id: "cronograma", num: "07", label: "Cronograma egresos" },
  { id: "itbis",      num: "08", label: "ITBIS" },
  { id: "mercado",    num: "09", label: "Análisis de mercado" },
  { id: "resultado",  num: "10", label: "Resultado completo" },
];

const readPref = (key, allowed, fallback) => {
  try {
    const v = localStorage.getItem(key);
    if (allowed.includes(v)) return v;
  } catch (e) {}
  return fallback;
};

// --- Top-level App ---
export default function App() {
  const [lang, setLang] = useState(() => readPref("fsc-lang", ["es", "en"], "es"));
  const [currency, setCurrency] = useState(() => readPref("fsc-currency", ["DOP", "USD"], "DOP"));
  useEffect(() => {
    try { localStorage.setItem("fsc-lang", lang); } catch (e) {}
    document.documentElement.lang = lang;
    document.title = translate(lang, "Factor de Sobrecosto · Calculadora guiada");
  }, [lang]);
  useEffect(() => {
    try { localStorage.setItem("fsc-currency", currency); } catch (e) {}
  }, [currency]);
  const t = useCallback((s, vars) => translate(lang, s, vars), [lang]);

  const [params, setParams] = useState(() => {
    try {
      const saved = localStorage.getItem("fsc-current-params");
      if (saved) return mergeParams(JSON.parse(saved));
    } catch (e) {}
    return DEFAULTS;
  });
  const [avance, setAvance] = useState(() => {
    try {
      const saved = localStorage.getItem("fsc-current-avance");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_AVANCE;
  });
  const [cobros, setCobros] = useState(() => {
    try {
      const saved = localStorage.getItem("fsc-current-cobros");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrar cronogramas del formato viejo (bruto, suma 100% sin anticipo)
        let anticipo = DEFAULTS.ANTICIPO;
        try {
          const p = JSON.parse(localStorage.getItem("fsc-current-params") || "null");
          if (p && typeof p.ANTICIPO === "number") anticipo = p.ANTICIPO;
        } catch (e) {}
        return normalizeCobros(parsed, anticipo);
      }
    } catch (e) {}
    return DEFAULT_COBROS;
  });
  const [projectName, setProjectName] = useState(() => {
    try { return localStorage.getItem("fsc-project-name") || "Residencial Las Praderas"; } catch (e) { return "Residencial Las Praderas"; }
  });
  const [activeStep, setActiveStep] = useState("proyecto");
  const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState(() => {
    try {
      const s = localStorage.getItem("fsc-saved-scenarios");
      return s ? JSON.parse(s) : [];
    } catch (e) { return []; }
  });
  // Autoguardado por nombre de proyecto: cada proyecto pisa su propia copia,
  // así ningún caso se pierde aunque el usuario no presione "Guardar".
  const [autoSaved, setAutoSaved] = useState(() => {
    try {
      const s = localStorage.getItem("fsc-autosaved-projects");
      return s ? JSON.parse(s) : {};
    } catch (e) { return {}; }
  });

  const setParam = useCallback((key, val) => {
    setParams((p) => ({ ...p, [key]: val }));
  }, []);

  const handleImport = useCallback(({ projectName: name, params: importedParams, avance: importedAvance, cobros: importedCobros }) => {
    // Sin MONEDA_BASE en el archivo, mergeParams la deja pendiente y se pide
    // confirmarla; los importes nunca se convierten.
    const mergedParams = mergeParams(importedParams);
    const normCobros = normalizeCobros(importedCobros || DEFAULT_COBROS, mergedParams.ANTICIPO);
    setProjectName(name || t("Proyecto importado"));
    setParams(mergedParams);
    setAvance(importedAvance);
    setCobros(normCobros);
    try {
      localStorage.setItem("fsc-project-name", name || t("Proyecto importado"));
      localStorage.setItem("fsc-current-params", JSON.stringify(mergedParams));
      localStorage.setItem("fsc-current-avance", JSON.stringify(importedAvance));
      localStorage.setItem("fsc-current-cobros", JSON.stringify(normCobros));
    } catch (e) {}
  }, [t]);

  // Los montos se muestran por defecto en la moneda base del caso.
  useEffect(() => {
    if (params.MONEDA_BASE) setCurrency(params.MONEDA_BASE);
  }, [params.MONEDA_BASE]);

  // Persist
  useEffect(() => {
    localStorage.setItem("fsc-current-params", JSON.stringify(params));
  }, [params]);
  useEffect(() => {
    localStorage.setItem("fsc-current-avance", JSON.stringify(avance));
  }, [avance]);
  useEffect(() => {
    localStorage.setItem("fsc-current-cobros", JSON.stringify(cobros));
  }, [cobros]);

  // Resize avance and cobros arrays when DURACION changes
  useEffect(() => {
    const d = params.DURACION;
    setAvance(prev => {
      if (d === prev.length) return prev;
      if (d > prev.length) {
        return [...prev, ...Array(d - prev.length).fill(0)];
      }
      return prev.slice(0, d);
    });
    setCobros(prev => {
      if (d === prev.length) return prev;
      if (d > prev.length) {
        return [...prev, ...Array(d - prev.length).fill(0)];
      }
      return prev.slice(0, d);
    });
  }, [params.DURACION]);

  // Month 1 of ingresos is always the anticipo, not a cubicación
  useEffect(() => {
    setCobros(prev => {
      if (prev.length === 0 || prev[0] === 0) return prev;
      const next = [...prev];
      next[0] = 0;
      return next;
    });
  }, [cobros]);

  // Si cambia el anticipo, reescalar las cubicaciones (M2+) proporcionalmente
  // para que anticipo + cubicaciones sigan sumando 100%.
  const prevAnticipo = useRef(params.ANTICIPO);
  useEffect(() => {
    if (prevAnticipo.current === params.ANTICIPO) return;
    prevAnticipo.current = params.ANTICIPO;
    setCobros(prev => {
      const target = 1 - params.ANTICIPO;
      const sum = prev.reduce((a, b) => a + b, 0);
      if (sum <= 0) {
        if (prev.length <= 1) return prev;
        const each = target / (prev.length - 1);
        return prev.map((_, i) => (i === 0 ? 0 : each));
      }
      const k = target / sum;
      return prev.map((v, i) => (i === 0 ? 0 : v * k));
    });
  }, [params.ANTICIPO]);
  useEffect(() => {
    localStorage.setItem("fsc-project-name", projectName);
  }, [projectName]);
  useEffect(() => {
    localStorage.setItem("fsc-saved-scenarios", JSON.stringify(savedScenarios));
  }, [savedScenarios]);
  useEffect(() => {
    try { localStorage.setItem("fsc-autosaved-projects", JSON.stringify(autoSaved)); } catch (e) {}
  }, [autoSaved]);
  // Autoguardar el estado actual bajo el nombre del proyecto (con pausa de 1s)
  useEffect(() => {
    const name = (projectName || "").trim();
    if (!name) return;
    const t = setTimeout(() => {
      setAutoSaved(prev => {
        const next = { ...prev, [name]: { name, timestamp: Date.now(), params, avance, cobros } };
        const keys = Object.keys(next).sort((a, b) => next[a].timestamp - next[b].timestamp);
        while (keys.length > 20) delete next[keys.shift()];
        return next;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [params, avance, cobros, projectName]);

  const codiaAplicado = useMemo(() => {
    if (params.TIPO_OBRA_CODIA === "Pública") return params.CODIA_PUBLICA;
    if (params.TIPO_OBRA_CODIA === "Privada") return params.CODIA_PRIVADA;
    return params.CODIA_MANUAL;
  }, [params.TIPO_OBRA_CODIA, params.CODIA_PUBLICA, params.CODIA_PRIVADA, params.CODIA_MANUAL]);

  const computeParams = useMemo(() => ({ ...params, CODIA_APLICADO: codiaAplicado }), [params, codiaAplicado]);

  const avanceTotal = useMemo(() => avance.reduce((a, b) => a + b, 0), [avance]);
  const cobrosTotal = useMemo(() => cobros.reduce((a, b) => a + b, 0), [cobros]);

  const { iterations, fscFinal, finalResult } = useMemo(() => {
    // Ingresos válidos: anticipo (M1) + cubicaciones netas (M2+) = 100% del PTV
    if (Math.abs(avanceTotal - 1) > 0.001 || Math.abs(cobrosTotal + params.ANTICIPO - 1) > 0.001) {
      return { iterations: [], fscFinal: null, finalResult: null };
    }
    return iterateFSC(computeParams, avance, cobros);
  }, [computeParams, avance, cobros, avanceTotal, cobrosTotal, params.ANTICIPO]);

  const final = finalResult;

  // Persist final result for the floating assistant widget
  useEffect(() => {
    try {
      if (final) {
        sessionStorage.setItem('fsc-final-result', JSON.stringify(final));
        sessionStorage.setItem('fsc-iterations', JSON.stringify(iterations));
      } else {
        sessionStorage.removeItem('fsc-final-result');
        sessionStorage.removeItem('fsc-iterations');
      }
    } catch (e) {}
  }, [final, iterations]);

  // Scroll-spy for nav
  useEffect(() => {
    const opts = { rootMargin: "-30% 0px -60% 0px" };
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveStep(e.target.id); });
    }, opts);
    document.querySelectorAll("section.step").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const loadExample = (key) => {
    const ex = EXAMPLES[key];
    if (!ex) return;
    setParams(ex.params);
    setAvance(ex.avance);
    setCobros(ex.cobros || makeDefaultCobros(ex.params.DURACION, ex.params.ANTICIPO));
    setProjectName(t(ex.name));
    setScenarioMenuOpen(false);
    document.getElementById("proyecto")?.scrollIntoView({ behavior: "smooth" });
  };

  const saveScenario = () => {
    const name = prompt(t("Nombre del escenario:"), projectName);
    if (!name) return;
    const scenario = {
      name,
      timestamp: Date.now(),
      params,
      avance,
      cobros,
      fsc: final ? final.fscInput : null,
      ptv: final ? final.PTV : null,
    };
    setSavedScenarios((s) => [scenario, ...s].slice(0, 50));
  };
  const loadScenario = (sc) => {
    const merged = mergeParams(sc.params);
    setParams(merged);
    setAvance(sc.avance);
    setCobros(normalizeCobros(sc.cobros || DEFAULT_COBROS, merged.ANTICIPO));
    setProjectName(sc.name);
    setScenarioMenuOpen(false);
  };
  const loadAutoSaved = (entry) => {
    const merged = mergeParams(entry.params);
    setParams(merged);
    setAvance(entry.avance);
    setCobros(normalizeCobros(entry.cobros || DEFAULT_COBROS, merged.ANTICIPO));
    setProjectName(entry.name);
    setScenarioMenuOpen(false);
  };
  const deleteScenario = (idx) => {
    setSavedScenarios((s) => s.filter((_, i) => i !== idx));
  };
  const resetAll = () => {
    if (!confirm(t("¿Restablecer todos los parámetros a los valores por defecto?"))) return;
    setParams(DEFAULTS);
    setAvance(DEFAULT_AVANCE);
    setCobros(DEFAULT_COBROS);
    setProjectName(t("Proyecto Nuevo"));
  };

  return (
    <PrefsProvider lang={lang} currency={currency} rate={params.TASA_CAMBIO} base={params.MONEDA_BASE}>
    <div className="shell">
      {!params.MONEDA_BASE && (
        <BaseCurrencyPrompt projectName={projectName} onConfirm={(m) => setParam("MONEDA_BASE", m)} />
      )}
      <Header
        lang={lang}
        setLang={setLang}
        currency={currency}
        setCurrency={setCurrency}
        projectName={projectName}
        setProjectName={setProjectName}
        final={final}
        scenarioMenuOpen={scenarioMenuOpen}
        setScenarioMenuOpen={setScenarioMenuOpen}
        savedScenarios={savedScenarios}
        autoSaved={autoSaved}
        loadExample={loadExample}
        saveScenario={saveScenario}
        loadScenario={loadScenario}
        loadAutoSaved={loadAutoSaved}
        deleteScenario={deleteScenario}
        resetAll={resetAll}
      />
      {params.MONEDA_BASE && currency !== params.MONEDA_BASE && (
        <ConversionNotice base={params.MONEDA_BASE} view={currency} rate={params.TASA_CAMBIO}
          onBack={() => setCurrency(params.MONEDA_BASE)} />
      )}

      <div className="layout">
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 36, alignItems: "start" }}>
          <NavRail active={activeStep} />
          <div className="doc">
            <StepProyecto params={params} setParam={setParam}
              projectName={projectName} setProjectName={setProjectName} />
            <StepCostos params={params} setParam={setParam} />
            <StepTasas params={params} setParam={setParam} final={final} />
            <StepFiscal params={params} setParam={setParam} />
            <StepCodia params={params} setParam={setParam} codiaAplicado={codiaAplicado} />
            <StepIngresos params={params} setParam={setParam}
              cobros={cobros} setCobros={setCobros} cobrosTotal={cobrosTotal} final={final} />
            <StepCronograma params={params} setParam={setParam}
              avance={avance} setAvance={setAvance} avanceTotal={avanceTotal} />
            <StepItbis params={params} setParam={setParam} final={final} />
            <StepMercado params={params} setParam={setParam} final={final} />
            <ResultadoCompleto final={final} iterations={iterations} params={params}
              avance={avance} avanceTotal={avanceTotal} cobrosTotal={cobrosTotal} projectName={projectName} />
            <Footer />
          </div>
        </div>

        <ResultsDock final={final} iterations={iterations} fscFinal={fscFinal} params={params}
          avance={avance} cobros={cobros} avanceTotal={avanceTotal} cobrosTotal={cobrosTotal} codiaAplicado={codiaAplicado}
          projectName={projectName} onImport={handleImport} />
      </div>
    </div>
    </PrefsProvider>
  );
}

// --- Header bar ---
function Header({ lang, setLang, currency, setCurrency, projectName, setProjectName, final, scenarioMenuOpen, setScenarioMenuOpen,
  savedScenarios, autoSaved, loadExample, saveScenario, loadScenario, loadAutoSaved, deleteScenario, resetAll }) {
  const t = useT();
  const { fmtShort } = useMoney();
  const autoList = Object.values(autoSaved || {}).sort((a, b) => b.timestamp - a.timestamp);
  return (
    <header className="header-bar">
      <div className="brand">
        <div className="brand-mark">
          <span dangerouslySetInnerHTML={{ __html: t("Factor de <em>Sobrecosto</em>") }} />
        </div>
        <div className="brand-sub">{t("RD · calculadora guiada")}</div>
      </div>
      <div className="header-actions" style={{ position: "relative" }}>
        <div role="group" aria-label={t("Idioma")} title={t("Idioma")} style={{
          display: "inline-flex", padding: 2, gap: 2,
          background: "var(--bg-paper)", border: "1px solid var(--rule)", borderRadius: 6,
        }}>
          {["es", "en"].map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
              style={{
                padding: "2px 8px", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase",
                fontWeight: lang === l ? 500 : 400,
                background: lang === l ? "var(--card)" : "transparent",
                border: lang === l ? "1px solid var(--rule-strong)" : "1px solid transparent",
                color: lang === l ? "var(--ink)" : "var(--ink-3)",
                borderRadius: 4, cursor: "pointer",
              }}>{l}</button>
          ))}
        </div>
        <CaseCurrency currency={currency} setCurrency={setCurrency} />
        <a href={lang === "en" ? "docs.html?lang=en" : "docs.html"} className="back-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--rule-strong)", background: "var(--card)", color: "var(--ink)", fontSize: 13, textDecoration: "none" }}>
          <i className="fa-solid fa-book-open"></i> {t("Docs")}
        </a>
        <button className="ghost" onClick={resetAll}><i className="fa-solid fa-rotate-left" style={{marginRight:6}}></i>{t("Restablecer")}</button>
        <button className="ghost" onClick={saveScenario} disabled={!final}><i className="fa-solid fa-bookmark" style={{marginRight:6}}></i>{t("Guardar")}</button>
        <button onClick={() => setScenarioMenuOpen((v) => !v)}>
          <i className="fa-solid fa-layer-group" style={{marginRight:6}}></i>{t("Escenarios")} {scenarioMenuOpen ? "▴" : "▾"}
        </button>
        {scenarioMenuOpen && (
          <div style={{
            position: "absolute", top: "100%", right: 0, marginTop: 6,
            background: "var(--card)", border: "1px solid var(--rule-strong)",
            borderRadius: 10, boxShadow: "var(--shadow)",
            minWidth: 320, zIndex: 100, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", fontSize: 11, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--ink-3)", borderBottom: "1px solid var(--rule)" }}>
              {t("Ejemplos precargados")}
            </div>
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <button key={key}
                onClick={() => loadExample(key)}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 14px",
                  border: "none", borderRadius: 0, background: "transparent",
                  borderBottom: "1px solid var(--rule)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                <span>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t(ex.name)}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                    CD = {fmtShort(ex.params.CD)} · {ex.params.DURACION} {t("meses")} · {t(ex.params.TIPO_OBRA_CODIA)}
                  </div>
                </span>
                <span style={{ color: "var(--ink-3)", fontSize: 12 }}><i className="fa-solid fa-arrow-right"></i></span>
              </button>
            ))}
            {savedScenarios.length > 0 && (
              <>
                <div style={{ padding: "10px 14px", fontSize: 11, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--ink-3)",
                  borderBottom: "1px solid var(--rule)", borderTop: "1px solid var(--rule)",
                  background: "var(--bg-paper)" }}>
                  <i className="fa-solid fa-folder-open" style={{marginRight:6}}></i>{t("Mis escenarios guardados")}
                </div>
                {savedScenarios.map((sc, i) => (
                  <div key={i} style={{
                    display: "flex", padding: "10px 14px",
                    borderBottom: "1px solid var(--rule)",
                    alignItems: "center", gap: 8,
                  }}>
                    <button onClick={() => loadScenario(sc)} style={{
                      flex: 1, textAlign: "left", background: "transparent",
                      border: "none", padding: 0,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{sc.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        FSC {sc.fsc ? fmtFactor(sc.fsc) : "—"} · PTV {sc.ptv ? fmtShort(sc.ptv) : "—"}
                      </div>
                    </button>
                    <button onClick={() => deleteScenario(i)} className="ghost" style={{ fontSize: 11, padding: "4px 8px" }} title={t("Eliminar")}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                ))}
              </>
            )}
            {autoList.length > 0 && (
              <>
                <div style={{ padding: "10px 14px", fontSize: 11, letterSpacing: "0.12em",
                  textTransform: "uppercase", color: "var(--ink-3)",
                  borderBottom: "1px solid var(--rule)", borderTop: "1px solid var(--rule)",
                  background: "var(--bg-paper)" }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{marginRight:6}}></i>{t("Autoguardados")}
                </div>
                {autoList.map((entry) => (
                  <div key={entry.name} style={{
                    display: "flex", padding: "10px 14px",
                    borderBottom: "1px solid var(--rule)",
                    alignItems: "center", gap: 8,
                  }}>
                    <button onClick={() => loadAutoSaved(entry)} style={{
                      flex: 1, textAlign: "left", background: "transparent",
                      border: "none", padding: 0,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        {new Date(entry.timestamp).toLocaleString(localeFor(lang), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

// --- Nav rail ---
function NavRail({ active }) {
  const t = useT();
  return (
    <nav style={{ position: "sticky", top: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 12 }}>
        <i className="fa-solid fa-list-ul" style={{marginRight:6}}></i>{t("Sumario")}
      </div>
      <ul className="rail">
        {STEP_NAV.map((s) => (
          <li key={s.id}>
            <a href={"#" + s.id} className={active === s.id ? "active" : ""}>
              <span className="rail-num">{s.num}</span>
              <span>{t(s.label)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// --- Results dock (right column, sticky) ---
function exportCase({ projectName, params, avance, cobros, final, iterations, fscFinal }) {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    projectName,
    params,
    avance,
    cobros,
    final,
    iterations: iterations.map((it) => ({
      iter: it.iter,
      fscInput: it.fscInput,
      FSC: it.FSC,
      PTV: it.PTV,
      IMO: it.IMO,
      PIT: it.PIT,
      F: it.F,
      TAT: it.TAT,
      RC: it.RC,
      UAE: it.UAE,
      GND: it.GND,
      UAI: it.UAI,
      UC: it.UC,
      FAI: it.FAI,
      FIO: it.FIO,
      FIC: it.FIC,
      FII: it.FII,
      FIF: it.FIF,
      FICOD: it.FICOD,
      FIFON: it.FIFON,
      FIU: it.FIU,
    })),
    fscFinal,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fsc-case-${projectName ? projectName.replace(/\s+/g, "_") : "proyecto"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Moneda del caso y moneda en que se ve. Ver en la otra moneda es una
// conversión explícita, solo para visualizar.
function CaseCurrency({ currency, setCurrency }) {
  const t = useT();
  const { base } = usePrefs();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}
      title={t("Los importes se guardan y calculan en la moneda del caso. Ver en la otra moneda solo convierte para visualizar.")}>
      <span>{t("Caso en")} <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{CURRENCIES[base].sym}</b> · {t("ver en")}</span>
      <CurrencyToggle value={currency} onChange={setCurrency} />
    </span>
  );
}

function ConversionNotice({ base, view, rate, onBack }) {
  const t = useT();
  return (
    <div role="status" style={{
      position: "sticky", top: 0, zIndex: 50, margin: "0 0 12px",
      padding: "8px 14px", borderRadius: 8, fontSize: 13,
      background: "var(--accent-tint)", color: "var(--accent-ink)",
      border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
    }}>
      <span>{t("Viendo equivalencias en {view} a una tasa de {rate} RD$ por US$ 1. Los importes del caso están en {base} y no se modifican.", { view: CURRENCIES[view].sym, base: CURRENCIES[base].sym, rate: Number(rate).toFixed(2) })}</span>
      <button type="button" onClick={onBack} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid currentColor", background: "transparent", color: "inherit", cursor: "pointer" }}>
        {t("Ver en {base}", { base: CURRENCIES[base].sym })}
      </button>
    </div>
  );
}

// Casos guardados o importados sin moneda base: se pide confirmar en qué
// moneda están escritos sus importes. Elegir no convierte ningún valor.
function BaseCurrencyPrompt({ projectName, onConfirm }) {
  const t = useT();
  const btn = {
    flex: 1, padding: "12px 10px", fontSize: 14, borderRadius: 8, cursor: "pointer",
    border: "1px solid var(--rule-strong)", background: "var(--card)", color: "var(--ink)",
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="fsc-base-title" style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        maxWidth: 440, width: "100%", background: "var(--bg)", color: "var(--ink)",
        borderRadius: 12, border: "1px solid var(--rule)", padding: "22px 22px 18px",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        <div id="fsc-base-title" style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          {t("¿En qué moneda están los importes de este caso?")}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 6 }}>
          <b>{projectName}</b>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 16 }}>
          {t("El caso no indica su moneda base. Confírmala para mostrar los montos correctamente. No se convierte ningún valor.")}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={btn} onClick={() => onConfirm("DOP")}>{t("Pesos dominicanos (RD$)")}</button>
          <button type="button" style={btn} onClick={() => onConfirm("USD")}>{t("Dólares (US$)")}</button>
        </div>
      </div>
    </div>
  );
}

function importCase(e, onImport, t) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.params || !data.avance) {
        alert(t("Archivo inválido: no contiene params o avance."));
        return;
      }
      onImport({
        projectName: data.projectName || "",
        params: data.params,
        avance: data.avance,
        cobros: data.cobros,
      });
    } catch (err) {
      alert(t("Error al leer el archivo: ") + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function ResultsDock({ final, iterations, fscFinal, params, avance, cobros, avanceTotal, cobrosTotal, codiaAplicado, projectName, onImport }) {
  const t = useT();
  const { fmt, fmtShort } = useMoney();
  const ingresosPct = cobrosTotal + params.ANTICIPO; // anticipo (M1) + cubicaciones netas
  const totalOk = Math.abs(avanceTotal - 1) < 0.001 && Math.abs(ingresosPct - 1) < 0.001;
  const [view, setView] = useState("mercado");
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("fsc-dock-collapsed") === "1"; } catch (e) { return false; }
  });

  const PTV = final ? final.PTV : 0;
  const PCM = params.PCM || 0;
  const DM = PCM - PTV;
  const umbral = Math.max(PTV * 0.02, 5000);
  let mercadoVerdict = null;
  if (PCM > 0 && PTV > 0) {
    if (Math.abs(DM) <= umbral) mercadoVerdict = "cerca";
    else if (DM > 0) mercadoVerdict = "encima";
    else mercadoVerdict = "debajo";
  }

  useEffect(() => {
    try { localStorage.setItem("fsc-dock-collapsed", collapsed ? "1" : "0"); } catch (e) {}
  }, [collapsed]);

  return (
    <aside className="results-dock" style={collapsed ? { maxHeight: 52, overflow: "hidden" } : { maxHeight: "calc(100vh - 40px)", overflow: "auto" }}>
      <div className="dock-status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={"dot " + (totalOk ? "" : "bad")} />
          {totalOk ? <><i className="fa-solid fa-calculator" style={{marginRight:6}}></i>{t("4 iteraciones + final")}</> : <><i className="fa-solid fa-triangle-exclamation" style={{marginRight:6}}></i>{t("Egresos {a}% · Ingresos {b}%", { a: Math.abs(avanceTotal * 100).toFixed(0), b: Math.abs(ingresosPct * 100).toFixed(0) })}</>}
        </div>
        <button
          className="ghost"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? t("Expandir") : t("Minimizar")}
          style={{ padding: "2px 6px", fontSize: 14 }}
        >
          <i className={collapsed ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up"}></i>
        </button>
      </div>

      {!collapsed && (
        <>
      {/* FSC gauge */}
      <div style={{ padding: "18px 16px 8px" }}>
        {final ? (
          <FSCGauge value={final.fscInput} />
        ) : (
          <div style={{ padding: "32px 8px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, marginBottom: 6, color: "var(--ink-2)" }}>—</div>
            {t("Egresos {a}% · Ingresos {b}%", { a: Math.abs(avanceTotal * 100).toFixed(0), b: Math.abs(ingresosPct * 100).toFixed(0) })}<br/>
            <span style={{ fontSize: 11 }}>{t("egresos deben sumar 100% · ingresos (anticipo + cubicaciones) deben sumar 100%")}</span>
          </div>
        )}
      </div>

      {/* Headline metrics */}
      {final && (
        <div style={{ padding: "0 16px" }}>
          <div style={{
            padding: "14px 16px",
            background: "var(--accent-tint)",
            borderRadius: 10,
            border: "1px solid color-mix(in oklab, var(--accent) 20%, transparent)",
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent-ink)", marginBottom: 4 }}>
              {t("Precio Técnico de Venta")}
            </div>
            <div className="num" style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--accent-ink)", lineHeight: 1.1 }}>
              {fmt(final.PTV)}
            </div>
            <div style={{ fontSize: 11, color: "var(--accent-ink)", opacity: 0.75, marginTop: 4 }}>
              CD × {fmtFactor(final.fscInput)} · {t("FSC aplicado")}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <Stat label={t("Utilidad UC")} value={fmtPct(final.UC, 2)} mono />
            <Stat label={t("Financiam. F")} value={fmtPct(final.F, 3)} mono />
            <Stat label={t("Revolvencia")} value={final.RC.toFixed(2) + "×"} mono />
            <Stat label="IMO" value={fmtShort(final.IMO)} mono />
          </div>
        </div>
      )}

      {/* Case export/import */}
      {final && (
        <div style={{
          display: "flex", gap: 8, padding: "10px 12px",
          borderTop: "1px solid var(--rule)",
          background: "var(--bg-paper)",
        }}>
          <button onClick={() => exportCase({ projectName, params, avance, cobros, final, iterations, fscFinal })}
            style={{
              flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 6,
              border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink-2)", cursor: "pointer",
            }}>
            <i className="fa-solid fa-download" style={{ marginRight: 4 }}></i>{t("Exportar caso")}
          </button>
          <button onClick={() => document.getElementById('fsc-import-file').click()}
            style={{
              flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 6,
              border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink-2)", cursor: "pointer",
            }}>
            <i className="fa-solid fa-upload" style={{ marginRight: 4 }}></i>{t("Importar caso")}
          </button>
          <input
            id="fsc-import-file"
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => importCase(e, onImport, t)}
          />
        </div>
      )}

      {/* Tabs */}
      {final && (
        <>
          <div style={{
            display: "flex", padding: "0 12px",
            borderTop: "1px solid var(--rule)",
            background: "var(--bg-paper)",
          }}>
            {[
              { id: "mercado", label: t("Mercado"), icon: "fa-scale-balanced" },
              { id: "resumen", label: t("Resumen"), icon: "fa-chart-pie" },
              { id: "waterfall", label: t("Cascada"), icon: "fa-chart-simple" },
              { id: "flujo", label: t("Flujo"), icon: "fa-money-bill-transfer" },
              { id: "iter", label: t("Iter."), icon: "fa-arrows-rotate" },
            ].map((t) => (
              <button key={t.id} onClick={() => setView(t.id)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  fontSize: 12,
                  background: "transparent",
                  border: "none",
                  borderRadius: 0,
                  borderBottom: "2px solid " + (view === t.id ? "var(--accent)" : "transparent"),
                  color: view === t.id ? "var(--ink)" : "var(--ink-3)",
                  fontWeight: view === t.id ? 500 : 400,
                  cursor: "pointer",
                }}>
                <i className={"fa-solid " + t.icon} style={{marginRight:4}}></i>{t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px", borderTop: "1px solid var(--rule)" }}>
            {view === "mercado" && <DockMercado PTV={PTV} PCM={PCM} DM={DM} verdict={mercadoVerdict} />}
            {view === "resumen" && <DockResumen final={final} params={params} codiaAplicado={codiaAplicado} />}
            {view === "waterfall" && <WaterfallFSC final={final} />}
            {view === "flujo" && <CashFlowChart iteration={final} height={160} showLegend />}
            {view === "iter" && <DockIterations iterations={iterations} fscFinal={fscFinal} />}
          </div>
        </>
      )}
        </>
      )}
    </aside>
  );
}

function DockMercado({ PTV, PCM, DM, verdict }) {
  const t = useT();
  const { fmt } = useMoney();
  const verdictStyle = {
    cerca: { bg: "var(--good-tint)", color: "oklch(0.35 0.11 155)", icon: "fa-check", text: t("PCM alineado con PTV") },
    encima: { bg: "var(--warn-tint)", color: "oklch(0.40 0.15 60)", icon: "fa-arrow-trend-up", text: t("PCM por encima del PTV") },
    debajo: { bg: "var(--bad-tint)", color: "oklch(0.35 0.18 25)", icon: "fa-arrow-trend-down", text: t("PCM por debajo del PTV") },
  };
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>
        {t("Comparación de precios")}
      </div>
      <Def k={t("PTV (técnico)")} v={fmt(PTV)} />
      <Def k={t("PCM (mercado)")} v={fmt(PCM)} />
      <Def k="DM = PCM − PTV" v={(DM >= 0 ? "+" : "") + fmt(DM)} accent={DM !== 0} />
      {verdict && (
        <div style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 8,
          background: verdictStyle[verdict].bg, color: verdictStyle[verdict].color,
          fontSize: 12, display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className={"fa-solid " + verdictStyle[verdict].icon}></i>
          <span><strong>{t("Análisis:")}</strong> {verdictStyle[verdict].text}</span>
        </div>
      )}
      {!verdict && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {t("Ingresa el PCM en el paso 09 para ver el análisis de razonabilidad.")}
        </div>
      )}
    </div>
  );
}

function DockResumen({ final, params, codiaAplicado }) {
  const t = useT();
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
        {t("Composición del FSC")}
      </div>
      <Def k={t("Base CD")} v="1.000000" />
      <Def k={"+ " + t("Operación") + " CO (" + fmtPct(params.CO) + ")"} v={"+" + (final.FIO - 1).toFixed(4)} />
      <Def k={"+ " + t("Campo") + " CC (" + fmtPct(params.CC) + ")"} v={"+" + (final.FIC - final.FIO).toFixed(4)} />
      <Def k={"+ " + t("Imprevistos") + " CI (" + fmtPct(params.CI) + ")"} v={"+" + (final.FII - final.FIC).toFixed(4)} />
      <Def k={"+ " + t("Financiam. F") + " (" + fmtPct(final.F, 3) + ")"} v={"+" + (final.FIF - final.FII).toFixed(4)} />
      <Def k={"+ CODIA (" + fmtPct(codiaAplicado, 3) + ")"} v={"+" + (final.FICOD - final.FIF).toFixed(4)} />
      <Def k={"+ " + t("Pensiones") + " FON (" + fmtPct(params.FON) + ")"} v={"+" + (final.FIFON - final.FICOD).toFixed(4)} />
      <Def k={"× (1 + UC=" + fmtPct(final.UC) + ")"} v={"+" + (final.FIU - final.FIFON).toFixed(4)} />
      <Def k={"= " + t("FSC del recálculo final")} v={fmtFactor(final.FSC)} />
      <Def k={t("FSC aplicado al PTV (promedio iter. 3 y 4)")} v={fmtFactor(final.fscInput)} accent />
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.5 }}>
        {t("El PTV usa el FSC aplicado. Los componentes de arriba corresponden al recálculo con el flujo final; la diferencia muestra cuánto falta para converger.")}
      </div>
    </div>
  );
}

function DockIterations({ iterations, fscFinal }) {
  const t = useT();
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>
        {t("Convergencia")}
      </div>
      <Convergence iterations={iterations} />
      <div style={{ marginTop: 14 }}>
        {iterations.map((it) => (
          <div key={it.iter} style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 12, padding: "5px 0",
            borderBottom: "1px dotted var(--rule)",
          }}>
            <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
              {t("iter.")} {it.iter} · input {fmtFactor(it.fscInput)}
            </span>
            <span className="num" style={{ color: "var(--ink)" }}>
              {fmtFactor(it.FSC)}
            </span>
          </div>
        ))}
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 12, padding: "8px 0", marginTop: 6,
          borderTop: "2px solid var(--rule)",
        }}>
          <span style={{ color: "var(--accent-ink)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
            {t("FSC aplicado = (iter. 3 + iter. 4) / 2")}
          </span>
          <span className="num" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {fmtFactor(fscFinal)}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Monthly cash flow table ---
function CashFlowTable({ final, params }) {
  const t = useT();
  const { fmt } = useMoney();
  const cf = final.cashFlow;
  const meses = Array.from({ length: cf.SING.length }, (_, i) => `${t("M")}${i + 1}`);
  // Ingresos cobrados del cliente = anticipo + cubicaciones − amortización del anticipo.
  // Su total es exactamente el PTV; los descuentos se muestran como línea separada.
  const ING = cf.ANT.map((a, i) => a + cf.COB[i] + (cf.AMO ? cf.AMO[i] : 0));
  const DES = cf.DES || cf.SING.map(() => 0);
  const rows = [
    { key: "ing", label: t("Ingresos (anticipo + cubicaciones)"), data: ING, fmt: (v) => fmt(v), good: true },
    { key: "des", label: t("Descuentos sobre cubicaciones"), data: DES, fmt: (v) => fmt(v), sign: true, dim: true },
    { key: "egr", label: t("Egresos (CD + CO + CC + CI)"), data: cf.SEGRfix, fmt: (v) => fmt(v), bad: true },
    { key: "dif", label: t("Diferencia"), data: cf.DIFP, fmt: (v) => fmt(v), sign: true },
    { key: "dfa", label: t("Dif. acumulada"), data: cf.DIFA, fmt: (v) => fmt(v), sign: true, bold: true, totalIsLast: true },
    { key: "pas", label: t("Interés pasivo (ganancia)"), data: cf.FPAS, fmt: (v) => fmt(v), good: true, dim: true },
    { key: "act", label: t("Interés activo (pago)"), data: cf.FACT, fmt: (v) => fmt(v), bad: true, dim: true },
    { key: "fin", label: t("Financiamiento"), data: cf.FPAR, fmt: (v) => fmt(v), sign: true, dim: true },
  ];

  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 720 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--ink-2)" }}>
          <th style={{ textAlign: "left", padding: "8px 10px 8px 0", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{t("Concepto")}</th>
          {meses.map((m, i) => (
            <th key={i} className="num" style={{ textAlign: "right", padding: "8px 6px", fontWeight: 500, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", whiteSpace: "nowrap" }}>
              {m}
            </th>
          ))}
          <th className="num" style={{ textAlign: "right", padding: "8px 6px", fontWeight: 500, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", whiteSpace: "nowrap" }}>
            {t("Total")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const total = row.totalIsLast ? row.data[row.data.length - 1] : row.data.reduce((a, b) => a + b, 0);
          return (
            <tr key={row.key} style={{ borderBottom: "1px solid var(--rule)", background: row.bold ? "var(--bg-paper)" : undefined }}>
              <td style={{ padding: "6px 10px 6px 0", color: row.bold ? "var(--ink)" : "var(--ink-2)", fontWeight: row.bold ? 500 : 400, whiteSpace: "nowrap" }}>
                {row.label}
              </td>
              {row.data.map((v, i) => (
                <td key={i} className="num" style={{
                  padding: "6px 6px", textAlign: "right",
                  color: row.sign ? (v > 0 ? "var(--good)" : v < 0 ? "var(--bad)" : "var(--ink-3)") : (row.good ? "var(--good)" : row.bad ? "var(--bad)" : "var(--ink)"),
                  opacity: row.dim ? 0.85 : 1,
                  fontWeight: row.bold ? 500 : 400,
                }}>
                  {row.fmt(v)}
                </td>
              ))}
              <td className="num" style={{
                padding: "6px 6px", textAlign: "right",
                color: row.sign ? (total > 0 ? "var(--good)" : total < 0 ? "var(--bad)" : "var(--ink-3)") : (row.good ? "var(--good)" : row.bad ? "var(--bad)" : "var(--ink)"),
                opacity: row.dim ? 0.85 : 1,
                fontWeight: row.bold ? 600 : 500,
                borderLeft: "1px solid var(--rule)",
              }}>
                {row.fmt(total)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- The final big "Resultado completo" step ---
function ResultadoCompleto({ final, iterations, params, avance, avanceTotal, cobrosTotal, projectName }) {
  const t = useT();
  const { fmt } = useMoney();
  if (!final) {
    const ingresosPct = cobrosTotal + params.ANTICIPO;
    return (
      <Step id="resultado" num="10" eyebrow={t("Resultado")} title={t("Aún <em>incompleto</em>")}
        lede={t("Egresos {a}% · Ingresos (anticipo + cubicaciones) {b}%. Ambos deben sumar 100% para ver el desglose completo.", { a: Math.abs(avanceTotal * 100).toFixed(0), b: Math.abs(ingresosPct * 100).toFixed(0) })} />
    );
  }
  return (
    <Step
      id="resultado"
      num="10"
      eyebrow={t("Resultado")}
      title={t("Lectura <em>completa</em>")}
      lede={t("Todos los componentes del FSC en su forma extensa, el flujo de caja mensual del proyecto y la convergencia iterativa del algoritmo.")}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        <Stat big accent label={t("FSC aplicado")} value={fmtFactor(final.fscInput)} sub={t("promedio iter. 3 y 4 · PTV = CD × FSC aplicado")} />
        <Stat big accent label="PTV" value={fmt(final.PTV)} sub={t("sobre CD = ") + fmt(params.CD)} />
        <Stat big label={t("FSC del recálculo final")} value={fmtFactor(final.FSC)} sub={t("con el flujo final; no se usa para el PTV")} />
      </div>

      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, margin: "0 0 12px" }}>
        {t("Construcción del FSC")}
      </h3>
      <div style={{
        background: "var(--bg-paper)", borderRadius: 10, padding: 20,
        border: "1px solid var(--rule)", marginBottom: 28,
      }}>
        <WaterfallFSC final={final} />
      </div>

      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, margin: "0 0 6px" }}>
        {t("Flujo de caja mensual")}
      </h3>
      <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 0, marginBottom: 16 }}>
        {t("Saldo acumulado (línea) y delta mensual (barras). El punto más bajo de la curva define la inversión máxima de obra (IMO).")}
      </p>
      <div style={{
        background: "var(--bg-paper)", borderRadius: 10, padding: 20,
        border: "1px solid var(--rule)", marginBottom: 16,
      }}>
        <CashFlowChart iteration={final} height={220} showLegend />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
        <Stat label={t("IMO · Inversión máxima")} value={fmt(final.IMO)} sub={t("máximo déficit acumulado")} />
        <Stat label={t("PIT · Intereses pagados")} value={fmt(final.PIT)} sub={t("al {pct} anual", { pct: fmtPct(params.TASA_ACTIVA) })} />
        <Stat label={t("F · Factor financiam.")} value={fmtPct(final.F, 4)} sub="PIT / CD" />
      </div>

      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, margin: "0 0 6px" }}>
        {t("Flujo de caja detallado mes a mes")}
      </h3>
      <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 0, marginBottom: 16 }}>
        {t("Ingresos vs egresos, diferencia acumulada y costo de financiamiento por mes. En meses con déficit se paga interés activo; en meses con superávit se gana interés pasivo.")}
      </p>
      <div style={{ overflowX: "auto", marginBottom: 28 }}>
        <CashFlowTable final={final} params={params} />
      </div>

      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, margin: "0 0 6px" }}>
        {t("Iteraciones del FSC")}
      </h3>
      <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 0, marginBottom: 16 }}>
        {t("El modelo corre 4 iteraciones de convergencia. El FSC aplicado es el promedio de las iteraciones 3 y 4; con él se calcula el PTV y se recalcula el flujo de caja final, del que resulta el FSC del recálculo final.")}
      </p>
      <div style={{ overflowX: "auto", marginBottom: 28 }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ink-2)" }}>
              <th style={{ textAlign: "left", padding: "8px 10px 8px 0", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>{t("Componente")}</th>
              {iterations.map((it) => (
                <th key={it.iter} className="num" style={{ textAlign: "right", padding: "8px 10px", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                  {t("Iter.")} {it.iter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { k: "FIO · 1 + CO", get: (it) => fmtFactor(it.FIO) },
              { k: "FIC · + CC", get: (it) => fmtFactor(it.FIC) },
              { k: "FII · + CI", get: (it) => fmtFactor(it.FII) },
              { k: "FIF · + F", get: (it) => fmtFactor(it.FIF) },
              { k: "FICOD · + CODIA", get: (it) => fmtFactor(it.FICOD) },
              { k: "FIFON · + FON", get: (it) => fmtFactor(it.FIFON) },
              { k: "FIU · × (1+UC)", get: (it) => fmtFactor(it.FIU) },
              { k: "FSC", get: (it) => fmtFactor(it.FSC), accent: true },
              { k: "PTV", get: (it) => fmt(it.PTV) },
              { k: "IMO", get: (it) => fmt(it.IMO) },
              { k: "F", get: (it) => fmtPct(it.F, 4) },
              { k: "UC", get: (it) => fmtPct(it.UC, 2) },
            ].map((row) => (
              <tr key={row.k} style={{
                borderBottom: "1px solid var(--rule)",
                background: row.accent ? "var(--accent-tint)" : undefined,
              }}>
                <td style={{ padding: "6px 10px 6px 0", color: row.accent ? "var(--accent-ink)" : "var(--ink-2)", fontWeight: row.accent ? 500 : 400 }}>
                  {row.k}
                </td>
                {iterations.map((it) => (
                  <td key={it.iter} className="num" style={{
                    padding: "6px 10px", textAlign: "right",
                    color: row.accent ? "var(--accent-ink)" : "var(--ink)",
                    fontWeight: row.accent ? 500 : 400,
                  }}>
                    {row.get(it)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, margin: "0 0 12px" }}>
        {t("Utilidad técnica")}
      </h3>
      <div style={{
        background: "var(--bg-paper)", borderRadius: 10, padding: "18px 20px",
        border: "1px solid var(--rule)",
        fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 2,
        color: "var(--ink-2)",
      }}>
        TAT = TPA + REA + TEA = <strong style={{ color: "var(--ink)" }}>{fmtPct(final.TAT)}</strong><br/>
        RC = PTV / IMO = {fmt(final.PTV)} / {fmt(final.IMO)} = <strong style={{ color: "var(--ink)" }}>{final.RC.toFixed(4)}×</strong><br/>
        UAE = TAT / RC = <strong style={{ color: "var(--ink)" }}>{fmtPct(final.UAE)}</strong><br/>
        GND = SGND / CD = {fmt(params.SGND)} / {fmt(params.CD)} = <strong style={{ color: "var(--ink)" }}>{fmtPct(final.GND, 4)}</strong><br/>
        UAI = UAE + GND = <strong style={{ color: "var(--ink)" }}>{fmtPct(final.UAI)}</strong><br/>
        FAI = 1 − ISR = <strong style={{ color: "var(--ink)" }}>{fmtFactor(final.FAI)}</strong><br/>
        UC = UAI / FAI = <strong style={{ color: "var(--accent)" }}>{fmtPct(final.UC)}</strong>
      </div>
    </Step>
  );
}

// --- Footer ---
function Footer() {
  const t = useT();
  return (
    <div style={{
      marginTop: 40, paddingTop: 18,
      borderTop: "1px solid var(--rule)",
      fontSize: 11, color: "var(--ink-3)",
      display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
    }}>
      <span>{t("Metodología: Suárez Salazar (2005) · Adaptación a República Dominicana")}</span>
      <span>{t("Validar parámetros fiscales con asesor actualizado a la fecha del contrato.")}</span>
    </div>
  );
}
