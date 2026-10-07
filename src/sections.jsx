import { fmtPct, makeDefaultAvance, makeDefaultCobros } from './calc.js';
import { useT, useMoney } from './prefs.jsx';
import { Step, Slider, MoneyInput, SegmentedControl, rangeBg, NumField, CurrencyToggle } from './ui.jsx';
import { SCurve } from './viz.jsx';

export function StepProyecto({ params, setParam, projectName, setProjectName }) {
  const t = useT();
  return (
    <Step
      id="proyecto"
      num="01"
      eyebrow={t("El proyecto")}
      title={t('¿Qué obra <em>estamos costeando</em>?')}
      lede={t("Empezamos con lo esencial: el nombre del proyecto, el tipo de obra y el costo directo total. El Costo Directo (CD) es la materia prima de todo el cálculo — todo lo demás se construye sobre él como factores.")}
    >
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: "var(--ink-2)", display: "block", marginBottom: 6 }}>
          {t("Nombre del proyecto")}
        </label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder={t("Ej. Residencial Las Praderas")}
          style={{ width: "100%", fontSize: 15, padding: "10px 12px" }}
        />
      </div>

      <SegmentedControl
        label={t("Tipo de obra (define la cuota CODIA)")}
        value={params.TIPO_OBRA_CODIA}
        options={["Privada", "Pública", "Manual"].map((v) => ({ value: v, label: t(v) }))}
        onChange={(v) => setParam("TIPO_OBRA_CODIA", v)}
      />

      <MoneyInput
        label={t("Costo Directo de Obra (CD)")}
        value={params.CD}
        onChange={(v) => setParam("CD", v)}
        hint={t("Suma de materiales, mano de obra y equipo del presupuesto detallado, sin sobrecostos.")}
        big
      />

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
        padding: "14px 16px", background: "var(--bg-paper)",
        borderRadius: 8, border: "1px solid var(--rule)",
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 4 }}>
            {t("Duración estimada")}
          </div>
          <input
            type="number" min={1}
            value={params.DURACION}
            onChange={(e) => setParam("DURACION", parseInt(e.target.value) || 1)}
            className="num"
            style={{ width: "100%", fontSize: 18, padding: "6px 10px", fontFamily: "var(--font-mono)" }}
          />
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{t("meses de obra")}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 4 }}>
            {t("FSC supuesto inicial")}
          </div>
          <input
            type="number" min={1.0} max={2.0} step={0.01}
            value={params.FSC_INICIAL}
            onChange={(e) => setParam("FSC_INICIAL", parseFloat(e.target.value) || 1.3)}
            className="num"
            style={{ width: "100%", fontSize: 18, padding: "6px 10px", fontFamily: "var(--font-mono)" }}
          />
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{t("punto de partida para iterar")}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 4 }}>
            {t("Tasa de cambio")}
          </div>
          <input
            type="number" min={1} step={0.01}
            value={params.TASA_CAMBIO}
            onChange={(e) => setParam("TASA_CAMBIO", Math.max(0.01, parseFloat(e.target.value) || 0.01))}
            className="num"
            style={{ width: "100%", fontSize: 18, padding: "6px 10px", fontFamily: "var(--font-mono)" }}
          />
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{t("RD$ por cada US$ 1")}</div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        marginTop: 12, padding: "12px 16px", background: "var(--bg-paper)",
        borderRadius: 8, border: "1px solid var(--rule)",
      }}>
        <BaseToggle params={params} setParam={setParam} t={t} />
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 2 }}>
            {t("Moneda base del caso")}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
            {t("Moneda en que están escritos los importes. Cambiarla no convierte valores.")}
          </div>
        </div>
      </div>
    </Step>
  );
}

// Selector de la moneda base del caso: cambiarla solo reidentifica los importes.
function BaseToggle({ params, setParam, t }) {
  return (
    <CurrencyToggle
      value={params.MONEDA_BASE || "DOP"}
      onChange={(m) => {
        if (m === params.MONEDA_BASE) return;
        if (!confirm(t("Los importes no se convertirán: solo cambia la moneda en que se identifican. ¿Continuar?"))) return;
        setParam("MONEDA_BASE", m);
      }}
    />
  );
}

export function StepCostos({ params, setParam }) {
  const t = useT();
  return (
    <Step
      id="costos"
      num="02"
      eyebrow={t("Estructura de costos")}
      title={t('Lo que el costo directo <em>no incluye</em>')}
      lede={t("Sobre el CD se suman tres porcentajes: la operación de oficina central (CO), los costos de campo del proyecto (CC), y los imprevistos (CI). Son los primeros tres factores del FSC.")}
    >
      <Slider label={t("Costo indirecto de operación · CO")} value={params.CO}
        min={0} max={0.15} step={0.001}
        onChange={(v) => setParam("CO", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Gastos de la oficina central distribuidos al proyecto: gerencia, contabilidad, alquiler, equipos. Rango típico 3 %–8 %.")} />
      <Slider label={t("Costo indirecto de campo · CC")} value={params.CC}
        min={0} max={0.15} step={0.001}
        onChange={(v) => setParam("CC", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Costos del sitio específico no atribuibles a una partida: residente, almacén, vigilancia, instalaciones temporales. Rango típico 3 %–8 %.")} />
      <Slider label={t("Imprevistos · CI")} value={params.CI}
        min={0} max={0.05} step={0.001}
        onChange={(v) => setParam("CI", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Reserva para contingencias menores. Rango típico 1 %–3 %.")} />

      <div style={{
        marginTop: 8, padding: "12px 16px",
        background: "var(--bg-paper)", borderRadius: 8,
        border: "1px solid var(--rule)",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("Suma de indirectos sobre CD")}</span>
        <span className="num" style={{ fontSize: 16, fontWeight: 500 }}>
          {fmtPct(params.CO + params.CC + params.CI, 2)}
        </span>
      </div>
    </Step>
  );
}

export function StepTasas({ params, setParam, final }) {
  const t = useT();
  const { fmt } = useMoney();
  return (
    <Step
      id="tasas"
      num="03"
      eyebrow={t("Tasas financieras")}
      title={t("El dinero <em>también cuesta</em>")}
      lede={t("La utilidad esperada (TAT) se compone de tasa pasiva, riesgo y tecnología. Aparte, el flujo de caja del proyecto requiere financiamiento cuando hay déficit — eso se calcula con la tasa activa.")}
    >
      <div style={{
        padding: "14px 16px", background: "var(--accent-tint)",
        borderRadius: 8, marginBottom: 18,
        border: "1px solid color-mix(in oklab, var(--accent) 20%, transparent)",
      }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-ink)", marginBottom: 6 }}>
          {t("Tasa anual total · TAT")}
        </div>
        <div className="num" style={{ fontSize: 24, fontWeight: 500, color: "var(--accent-ink)" }}>
          {fmtPct(params.TPA + params.REA + params.TEA, 2)}
        </div>
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 4, opacity: 0.8 }}>
          {t("TPA + REA + TEA — rentabilidad mínima esperada")}
        </div>
      </div>

      <Slider label={t("Tasa pasiva anual · TPA")} value={params.TPA}
        min={0} max={0.25} step={0.005}
        onChange={(v) => setParam("TPA", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Rendimiento de instrumentos de bajo riesgo (certificados, bonos). Es el piso de rentabilidad — invertir en el proyecto debe rendir más que dejar el dinero en el banco.")} />
      <Slider label={t("Riesgo empresarial · REA")} value={params.REA}
        min={0} max={0.30} step={0.005}
        onChange={(v) => setParam("REA", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Prima por asumir el riesgo de ejecutar la obra.")} />
      <Slider label={t("Tecnología e investigación · TEA")} value={params.TEA}
        min={0} max={0.20} step={0.005}
        onChange={(v) => setParam("TEA", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Reserva para innovación, capacitación y herramientas.")} />

      <div className="hairline" style={{ margin: "20px 0 18px" }} />

      <Slider label={t("Tasa activa (costo de financiar déficit)")} value={params.TASA_ACTIVA}
        min={0} max={0.45} step={0.005}
        onChange={(v) => setParam("TASA_ACTIVA", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Tasa anual a la que la empresa toma prestado para cubrir el déficit mensual del proyecto. En RD suele estar entre 15 %–25 %.")} />
      <Slider label={t("Tasa pasiva para saldos positivos")} value={params.TASA_PASIVA}
        min={0} max={0.20} step={0.005}
        onChange={(v) => setParam("TASA_PASIVA", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Cuando el flujo es positivo, el saldo gana intereses. Esta tasa raramente compensa el déficit.")} />

      {final && (
        <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--bg-paper)",
          borderRadius: 8, fontSize: 12, color: "var(--ink-2)" }}>
          {t("Factor F calculado del flujo:")} <strong className="num">{fmtPct(final.F, 4)}</strong> {t("(= {pit} de intereses / {cd} CD)", { pit: fmt(final.PIT), cd: fmt(params.CD) })}
        </div>
      )}
    </Step>
  );
}

export function StepFiscal({ params, setParam }) {
  const t = useT();
  return (
    <Step
      id="fiscal"
      num="04"
      eyebrow={t("Aspectos fiscales y contractuales")}
      title={t("ISR, anticipo, <em>descuentos</em>")}
      lede={t("El ISR se aplica al final para que la utilidad neta deseada se conserve. El anticipo y los descuentos afectan directamente el flujo de caja mensual.")}
    >
      <Slider label={t("Impuesto sobre la renta · ISR")} value={params.ISR}
        min={0} max={0.35} step={0.005}
        onChange={(v) => setParam("ISR", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Tasa del ISR para personas jurídicas según DGII. Actualizar según normativa vigente.")} />

      <MoneyInput
        label={t("Gastos no deducibles · SGND")}
        value={params.SGND}
        onChange={(v) => setParam("SGND", v)}
        hint={t("Multas, donaciones no deducibles y otros desembolsos que no reducen base imponible.")}
      />

      <Slider label={t("Anticipo (% del PTV)")} value={params.ANTICIPO}
        min={0} max={0.50} step={0.01}
        onChange={(v) => setParam("ANTICIPO", v)} format={(v) => fmtPct(v, 0)}
        hint={t("Adelanto que paga el cliente al inicio. Reduce la inversión máxima de obra (IMO) y por tanto el factor de financiamiento.")} />
      <Slider label={t("Descuentos varios sobre cubicaciones")} value={params.DESCUENTO}
        min={0} max={0.02} step={0.001}
        onChange={(v) => setParam("DESCUENTO", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Retenciones o descuentos contractuales aplicados sobre cada cubicación cobrada.")} />
    </Step>
  );
}

export function StepCodia({ params, setParam, codiaAplicado }) {
  const t = useT();
  return (
    <Step
      id="codia"
      num="05"
      eyebrow={t("CODIA y Fondo de Pensiones")}
      title={t("Aportes <em>gremiales</em>")}
      lede={t("Dos cargos pequeños pero obligatorios: la cuota del Colegio Dominicano de Ingenieros, Arquitectos y Agrimensores (CODIA) y el aporte al Fondo de Pensiones (FON).")}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 6 }}>
            {t("CODIA obra pública (‰)")}
          </label>
          <input type="number" min={0} max={5} step={0.1}
            value={(params.CODIA_PUBLICA * 1000).toFixed(1)}
            onChange={(e) => setParam("CODIA_PUBLICA", parseFloat(e.target.value) / 1000 || 0)}
            className="num"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 6 }}>
            {t("CODIA obra privada (‰)")}
          </label>
          <input type="number" min={0} max={5} step={0.1}
            value={(params.CODIA_PRIVADA * 1000).toFixed(1)}
            onChange={(e) => setParam("CODIA_PRIVADA", parseFloat(e.target.value) / 1000 || 0)}
            className="num"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }} />
        </div>
      </div>

      {params.TIPO_OBRA_CODIA === "Manual" && (
        <Slider label={t("CODIA manual")} value={params.CODIA_MANUAL}
          min={0} max={0.01} step={0.0001}
          onChange={(v) => setParam("CODIA_MANUAL", v)} format={(v) => fmtPct(v, 3)} />
      )}

      <div style={{
        padding: "12px 16px", background: "var(--bg-paper)",
        borderRadius: 8, border: "1px solid var(--rule)",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 18,
      }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {t("CODIA aplicado para obra")} <strong>{t(params.TIPO_OBRA_CODIA)}</strong>
        </span>
        <span className="num" style={{ fontSize: 16, fontWeight: 500, color: "var(--accent)" }}>
          {fmtPct(codiaAplicado, 3)}
        </span>
      </div>

      <Slider label={t("Fondo de Pensiones · FON")} value={params.FON}
        min={0} max={0.03} step={0.001}
        onChange={(v) => setParam("FON", v)} format={(v) => fmtPct(v, 2)}
        hint={t("Aporte al fondo de pensiones del CODIA. Suele ser 1 % del PTV; aquí se aplica como porcentaje sobre CD por convención de la metodología.")} />
    </Step>
  );
}

export function StepCronograma({ params, setParam, avance, setAvance, avanceTotal }) {
  const t = useT();
  const { fmt, fmtShort } = useMoney();
  const totalOk = Math.abs(avanceTotal - 1) < 0.001;

  const setMes = (i, v) => {
    const next = [...avance];
    next[i] = v;
    setAvance(next);
  };
  const reset = () => setAvance(makeDefaultAvance(params.DURACION));
  const equalize = () => {
    const n = params.DURACION;
    const next = Array(n).fill(0);
    for (let i = 0; i < n; i++) next[i] = 1 / n;
    setAvance(next);
  };
  const bellShape = () => {
    const n = params.DURACION;
    const next = Array(n).fill(0);
    // approximate bell
    let total = 0;
    const raw = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) / Math.max(1, n / 3);
      const v = Math.exp(-x * x);
      raw.push(v);
      total += v;
    }
    for (let i = 0; i < n; i++) next[i] = raw[i] / total;
    setAvance(next);
  };

  // Monthly indirect costs distributed over the project duration
  const goc = params.CD * params.CO / Math.max(params.DURACION, 1);
  const gob = params.CD * params.CC / Math.max(params.DURACION, 1);
  const egressForMonth = (a, i) => {
    const direct = a * params.CD;
    const imprevistos = direct * params.CI;
    const overhead = i < params.DURACION ? goc + gob : 0;
    return direct + imprevistos + overhead;
  };
  const totalEgresos = avance.reduce((sum, a, i) => sum + egressForMonth(a, i), 0);

  return (
    <Step
      id="cronograma"
      num="07"
      eyebrow={t("Cronograma de egresos")}
      title={t("¿Cuándo se <em>ejecuta</em> el costo?")}
      lede={t("La distribución mensual del avance físico — y por tanto del egreso — determina el flujo de caja. Una obra con costos concentrados temprano necesita más financiamiento.")}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={equalize}><i className="fa-solid fa-grip-lines" style={{marginRight:6}}></i>{t("Distribución uniforme")}</button>
        <button type="button" onClick={bellShape}><i className="fa-solid fa-bell" style={{marginRight:6}}></i>{t("Forma de campana")}</button>
        <button type="button" onClick={reset} className="ghost"><i className="fa-solid fa-rotate-left" style={{marginRight:6}}></i>{t("Restablecer")}</button>
      </div>

      <div style={{
        background: "var(--bg-paper)", borderRadius: 10, padding: 14,
        border: "1px solid var(--rule)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>
          {t("Curva S (avance acumulado)")}
        </div>
        <SCurve avance={avance} duracion={params.DURACION} height={120} />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 56px 110px",
        gap: "6px 12px",
        alignItems: "center",
        fontSize: 13,
      }}>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("Mes")}</div>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("Avance")}</div>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>%</div>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>{t("Egreso mensual")}</div>
        {avance.map((a, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div style={{ color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {t("M")}{i + 1}
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={a}
              onChange={(e) => setMes(i, parseFloat(e.target.value))}
              style={rangeBg(a, 0, 1)}
            />
            <NumField value={a} min={0} max={1} scale={100}
              onCommit={(v) => setMes(i, v)}
              format={(v) => (v * 100).toFixed(0) + "%"}
              color={a > 0 ? "var(--ink)" : "var(--ink-4)"}
              width={60} fontSize={13} />
            <div className="num" style={{ textAlign: "right", fontSize: 12, color: a > 0 ? "var(--ink-2)" : "var(--ink-4)" }}
              title={a > 0 ? t("Costo directo + imprevistos + gastos indirectos (CO + CC)") : t("Sin avance: solo gastos indirectos fijos del mes (CO + CC)")}>
              {fmtShort(egressForMonth(a, i))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {t("Cada mes incluye su costo directo + imprevistos + la cuota fija de gastos indirectos (CO + CC). Los meses sin avance muestran solo esa cuota fija, por eso no quedan en cero.")}
      </div>

      <div style={{
        marginTop: 16, padding: "10px 14px", borderRadius: 8,
        background: totalOk ? "var(--good-tint)" : "var(--bad-tint)",
        color: totalOk ? "oklch(0.35 0.11 155)" : "oklch(0.35 0.18 25)",
        fontSize: 13, fontWeight: 500,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>{t("Total avance:")} <span className="num">{(avanceTotal * 100).toFixed(1)}%</span>
          {' · '}{t("Total egresos:")} <span className="num">{fmt(totalEgresos)}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 400 }}>
          {totalOk ? <><i className="fa-solid fa-check" style={{marginRight:4}}></i>{t("incluye CD + CO + CC + CI")}</> : <><i className="fa-solid fa-triangle-exclamation" style={{marginRight:4}}></i>{t("ajustar hasta sumar 100%")}</>}
        </span>
      </div>
    </Step>
  );
}

export function StepIngresos({ params, setParam, cobros, setCobros, cobrosTotal, final }) {
  const t = useT();
  const { fmt, fmtShort } = useMoney();
  // Regla: anticipo (M1) + cubicaciones netas (M2+) = 100% del PTV.
  const totalOk = Math.abs(cobrosTotal + params.ANTICIPO - 1) < 0.001;
  const ptv = final ? final.PTV : params.CD * params.FSC_INICIAL;
  // Lo que realmente entra a caja: el anticipo en M1 más lo cobrado cada mes
  // (cada barra ya es neta de la amortización del anticipo). Cuando las barras
  // junto con el anticipo suman 100%, el total cobrado es exactamente el PTV.
  const totalCobrar = (params.ANTICIPO + cobrosTotal) * ptv;

  const setMes = (i, v) => {
    const next = [...cobros];
    next[i] = v;
    setCobros(next);
  };
  const reset = () => setCobros(makeDefaultCobros(params.DURACION, params.ANTICIPO));
  const equalize = () => {
    const n = params.DURACION;
    const next = Array(n).fill(0);
    const each = n > 1 ? (1 - params.ANTICIPO) / (n - 1) : 0;
    for (let i = 1; i < n; i++) next[i] = each;
    setCobros(next);
  };
  const bellShape = () => {
    const n = params.DURACION;
    const next = Array(n).fill(0);
    let total = 0;
    const raw = [];
    for (let i = 1; i < n; i++) {
      const x = (i - n / 2) / Math.max(1, n / 3);
      const v = Math.exp(-x * x);
      raw.push([i, v]);
      total += v;
    }
    if (total > 0) raw.forEach(([i, v]) => { next[i] = (v / total) * (1 - params.ANTICIPO); });
    setCobros(next);
  };

  return (
    <Step
      id="ingresos"
      num="06"
      eyebrow={t("Cronograma de ingresos")}
      title={t("¿Cuándo <em>entra</em> el dinero?")}
      lede={t("Controla directamente cuándo se cobra cada cubicación. El anticipo entra siempre en el mes 1; las cubicaciones se cobran según este cronograma, independientemente del avance físico. El anticipo y todas las barras juntas deben sumar el 100% del PTV.")}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={equalize}><i className="fa-solid fa-grip-lines" style={{marginRight:6}}></i>{t("Distribución uniforme")}</button>
        <button type="button" onClick={bellShape}><i className="fa-solid fa-bell" style={{marginRight:6}}></i>{t("Forma de campana")}</button>
        <button type="button" onClick={reset} className="ghost"><i className="fa-solid fa-rotate-left" style={{marginRight:6}}></i>{t("Restablecer")}</button>
      </div>

      <div style={{
        background: "var(--bg-paper)", borderRadius: 10, padding: 14,
        border: "1px solid var(--rule)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>
          {t("Curva S (cobros acumulados)")}
        </div>
        <SCurve avance={[params.ANTICIPO, ...cobros.slice(1)]} duracion={params.DURACION} height={120} />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 56px 110px",
        gap: "6px 12px",
        alignItems: "center",
        fontSize: 13,
      }}>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("Mes")}</div>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("Cobro")}</div>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>%</div>
        <div style={{ color: "var(--ink-3)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>{t("Ingreso mensual")}</div>

        {/* Anticipo: always in month 1, linked to ANTICIPO param */}
        <div style={{ display: "contents" }}>
          <div style={{ color: "var(--accent-ink)", fontFamily: "var(--font-mono)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            {t("M")}1
            <i className="fa-solid fa-lock" style={{ fontSize: 10, opacity: 0.7 }} title={t("Igual al anticipo (se cambia en 04 · Aspectos fiscales)")}></i>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              height: 8, borderRadius: 4,
              background: "var(--accent)",
              width: `${params.ANTICIPO * 100}%`,
              minWidth: 4,
            }} />
          </div>
          <div className="num" style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--accent-ink)" }}>
            {(params.ANTICIPO * 100).toFixed(0)}%
          </div>
          <div className="num" style={{ textAlign: "right", fontSize: 12, color: "var(--ink-2)" }}>
            {fmtShort(params.ANTICIPO * ptv)}
          </div>
        </div>

        {/* Cobros: months 2..n (index 1..n-1) */}
        {cobros.slice(1).map((a, idx) => {
          const i = idx + 1;
          return (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {t("M")}{i + 1}
              </div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={a}
                onChange={(e) => setMes(i, parseFloat(e.target.value))}
                style={rangeBg(a, 0, 1)}
              />
              <NumField value={a} min={0} max={1} scale={100}
                onCommit={(v) => setMes(i, v)}
                format={(v) => (v * 100).toFixed(0) + "%"}
                color={a > 0 ? "var(--ink)" : "var(--ink-4)"}
                width={60} fontSize={13} />
              <div className="num" style={{ textAlign: "right", fontSize: 12, color: a > 0 ? "var(--ink-2)" : "var(--ink-4)" }}
                title={t("Lo que entra a caja en ese mes (% del PTV), ya neto de la amortización del anticipo. Los descuentos contractuales se ven aparte en el flujo de caja detallado.")}>
                {a > 0 ? fmtShort(a * ptv) : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {t("Cada barra muestra lo que entra a caja ese mes, como % del PTV: el anticipo (M1, {pct}) más todas las cubicaciones juntas deben sumar 100%. Las barras ya son netas de la amortización del anticipo — por eso el total cobrado equivale exactamente al PTV y no más. Si cambias el anticipo en 04 · Aspectos fiscales, las barras se reescalan solas para mantener el 100%. Los descuentos contractuales se ven como línea aparte en el flujo de caja detallado.", { pct: fmtPct(params.ANTICIPO, 0) })}
      </div>

      <div style={{
        marginTop: 16, padding: "10px 14px", borderRadius: 8,
        background: totalOk ? "var(--good-tint)" : "var(--bad-tint)",
        color: totalOk ? "oklch(0.35 0.11 155)" : "oklch(0.35 0.18 25)",
        fontSize: 13, fontWeight: 500,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>{t("Anticipo + cubicaciones:")} <span className="num">{((params.ANTICIPO + cobrosTotal) * 100).toFixed(1)}%</span>
          {' · '}{t("Total a cobrar:")} <span className="num">{fmt(totalCobrar)}</span>
          {totalOk && ' (= PTV)'}
        </span>
        <span style={{ fontSize: 12, fontWeight: 400 }}>
          {totalOk ? <><i className="fa-solid fa-check" style={{marginRight:4}}></i>{t("neto de amortización del anticipo")}</> : <><i className="fa-solid fa-triangle-exclamation" style={{marginRight:4}}></i>{t("ajustar hasta que anticipo + barras sumen 100%")}</>}
        </span>
      </div>
    </Step>
  );
}

export function StepItbis({ params, setParam, final }) {
  const t = useT();
  const { fmt } = useMoney();
  if (!final) {
    return (
      <Step id="itbis" num="08" eyebrow={t("ITBIS · escenarios")} title={t("Tratamiento <em>fiscal</em>")} lede={t("Ajusta el cronograma para que sume 100% y los escenarios aparecerán aquí.")} />
    );
  }
  const scenarios = [
    { label: t("Contratista con código tributario"), itbis: params.ITBIS, compensa: true,
      desc: t("El ITBIS pagado en compras se compensa contra el cobrado al cliente.") },
    { label: t("Dueño-promotor-constructor (sin terceros)"), itbis: 0, compensa: false,
      desc: t("No hay facturación por servicios; el ITBIS pagado en insumos se asume como costo.") },
    { label: t("Zona franca con carta de exoneración"), itbis: 0, compensa: null,
      desc: t("Régimen especial sin ITBIS para la operación calificada.") },
    { label: t("Norma 07-2007 — 10% del total"), itbis: params.ITBIS, compensa: false,
      norma: true, desc: t("Para servicios profesionales: ITBIS aplicado sobre el 10 % del monto facturado.") },
    { label: t("Vivienda tasa cero"), itbis: 0, compensa: null,
      desc: t("Programa social — tratamiento confirmable con asesor fiscal.") },
  ];

  return (
    <Step
      id="itbis"
      num="08"
      eyebrow={t("ITBIS · escenarios")}
      title={t("El <em>impuesto</em> al precio final")}
      lede={t("El ITBIS no se integra al FSC ni al PTV porque su tratamiento varía según el régimen fiscal. Esta sección muestra precios finales estimados bajo los principales escenarios aplicables en RD, solo como referencia.")}
    >
      <div style={{
        marginBottom: 18, padding: "12px 14px",
        background: "var(--bg-paper)", borderRadius: 8,
        borderLeft: "4px solid var(--accent)",
        fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6,
      }}>
        <strong style={{ color: "var(--ink)" }}>{t("Referencia fiscal, no parte del FSC.")}</strong><br/>
        {t("Los siguientes escenarios comparan cómo quedaría el precio final con ITBIS según cada régimen. El PTV y el FSC no cambian; el ITBIS es un cargo fiscal adicional que depende de la facturación y la contabilidad del proyecto.")}
      </div>
      <Slider label={t("ITBIS general (tasa nominal)")} value={params.ITBIS}
        min={0} max={0.30} step={0.01}
        onChange={(v) => setParam("ITBIS", v)} format={(v) => fmtPct(v, 0)}
        hint={t("Tasa nominal vigente según DGII.")} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {scenarios.map((sc, i) => {
          const base = final.PTV;
          const itbisAplicado = sc.norma ? sc.itbis * 0.10 : sc.itbis;
          const itbisMonto = base * itbisAplicado;
          const total = base + itbisMonto;
          return (
            <div key={i} style={{
              background: "var(--card)",
              borderRadius: 10, padding: "14px 16px",
              border: "1px solid var(--rule)",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16, alignItems: "center",
            }}>
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{sc.label}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: sc.compensa === true ? "var(--good-tint)" : sc.compensa === false ? "var(--warn-tint)" : "var(--bg-paper)",
                    color: sc.compensa === true ? "oklch(0.35 0.11 155)" : sc.compensa === false ? "oklch(0.40 0.15 60)" : "var(--ink-3)",
                  }}>
                    {sc.compensa === true ? t("compensa") : sc.compensa === false ? t("no compensa") : t("revisar")}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
                  {sc.desc}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontSize: 18, fontWeight: 500 }}>
                  {fmt(total)}
                </div>
                {itbisMonto > 0 && (
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    +<span className="num">{fmt(itbisMonto)}</span> ITBIS
                  </div>
                )}
                {itbisMonto === 0 && (
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    {t("sin ITBIS")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 14, fontSize: 12, color: "var(--ink-3)",
        background: "var(--bg-paper)", padding: "12px 14px",
        borderRadius: 8, lineHeight: 1.6,
        borderLeft: "3px solid var(--accent)",
      }}>
        <strong>{t("Norma 07-2007")}</strong>: {t("para servicios profesionales (incluida ingeniería), el ITBIS se calcula sobre el 10 % del monto facturado. Validar con asesor fiscal actualizado al año del contrato.")}
      </div>
    </Step>
  );
}

export function StepMercado({ params, setParam, final }) {
  const t = useT();
  const { fmt } = useMoney();
  const PTV = final ? final.PTV : 0;
  const PCM = params.PCM || 0;
  const DM = PCM - PTV;
  const umbral = Math.max(PTV * 0.02, 5000);
  let veredicto = null;
  if (PCM > 0 && PTV > 0) {
    if (Math.abs(DM) <= umbral) veredicto = "cerca";
    else if (DM > 0) veredicto = "encima";
    else veredicto = "debajo";
  }

  const veredictoStyle = {
    cerca: { bg: "var(--good-tint)", color: "oklch(0.35 0.11 155)", icon: "fa-check", text: t("El PCM está alineado con el precio técnico.") },
    encima: { bg: "var(--warn-tint)", color: "oklch(0.40 0.15 60)", icon: "fa-arrow-trend-up", text: t("El PCM está por encima del precio técnico. Mayor margen comercial.") },
    debajo: { bg: "var(--bad-tint)", color: "oklch(0.35 0.18 25)", icon: "fa-arrow-trend-down", text: t("El PCM está por debajo del precio técnico. Revisa costos o utilidad.") },
  };

  return (
    <Step
      id="mercado"
      num="09"
      eyebrow={t("Análisis de mercado")}
      title={t("Precio técnico vs. <em>precio de mercado</em>")}
      lede={t("Compara el Precio Técnico de Venta (PTV) calculado por costos con el Precio Comercial de Mercado (PCM) real. El diferencial te ayuda a evaluar la razonabilidad del precio.")}
    >
      <MoneyInput
        label={t("Precio Comercial de Mercado (PCM)")}
        value={params.PCM}
        onChange={(v) => setParam("PCM", v)}
        hint={t("Precio al que se oferta o vende el inmueble en el mercado real.")}
        big
      />

      {final ? (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8, marginBottom: 20,
        }}>
          <div style={{
            background: "var(--bg-paper)", border: "1px solid var(--rule)", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 4 }}>PTV</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 500 }}>{fmt(PTV)}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{t("Precio técnico calculado")}</div>
          </div>
          <div style={{
            background: "var(--bg-paper)", border: "1px solid var(--rule)", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 4 }}>PCM</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 500 }}>{fmt(PCM)}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{t("Precio comercial de mercado")}</div>
          </div>
          <div style={{
            background: DM >= 0 ? "var(--good-tint)" : "var(--bad-tint)",
            border: "1px solid " + (DM >= 0 ? "var(--good)" : "var(--bad)"),
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: DM >= 0 ? "oklch(0.35 0.11 155)" : "oklch(0.35 0.18 25)", marginBottom: 4 }}>DM = PCM − PTV</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 500, color: DM >= 0 ? "oklch(0.35 0.11 155)" : "oklch(0.35 0.18 25)" }}>
              {DM >= 0 ? "+" : ""}{fmt(DM)}
            </div>
            <div style={{ fontSize: 11, color: DM >= 0 ? "oklch(0.35 0.11 155)" : "oklch(0.35 0.18 25)", marginTop: 2 }}>{t("Diferencial de mercado")}</div>
          </div>
        </div>
      ) : (
        <div style={{
          background: "var(--bg-paper)", border: "1px solid var(--rule)", borderRadius: 10, padding: "14px 16px",
          color: "var(--ink-3)", fontSize: 14,
        }}>
          {t("Completa el cronograma de avance para calcular el PTV y poder comparar con el PCM.")}
        </div>
      )}

      {veredicto && (
        <div style={{
          background: veredictoStyle[veredicto].bg,
          color: veredictoStyle[veredicto].color,
          borderRadius: 10, padding: "14px 16px", fontSize: 14,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <i className={"fa-solid " + veredictoStyle[veredicto].icon} style={{ fontSize: 20 }}></i>
          <span><strong>{t("Análisis:")}</strong> {veredictoStyle[veredicto].text}</span>
        </div>
      )}
    </Step>
  );
}
