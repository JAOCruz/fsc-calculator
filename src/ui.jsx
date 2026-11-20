import { useState, useRef, useEffect } from 'react';
import { readAmount, readNumber } from './parseAmount.js';
import { usePrefs, useT, makeMoney, CURRENCIES, localeFor, toCurrency, fromCurrency } from './prefs.jsx';

// Calculate current % position of a slider for the gradient fill
export function rangeBg(value, min, max) {
  const p = ((value - min) / (max - min)) * 100;
  return { "--rp": Math.max(0, Math.min(100, p)) + "%" };
}

// Campo numérico escribible: muestra el valor formateado; al enfocar permite
// escribirlo directamente. Enter o clic fuera aplica (limitado a min/max), Esc cancela.
export function NumField({ value, min, max, scale = 1, onCommit, format, accent, color, width = 84, fontSize = 14 }) {
  const t = useT();
  const [txt, setTxt] = useState(null);
  const cancelRef = useRef(false);
  const startRef = useRef(null);
  // Entrada mal formada rechazada: se avisa y se conserva el valor anterior.
  const [rejected, setRejected] = useState(null);
  const commit = (raw) => {
    if (cancelRef.current) { cancelRef.current = false; setTxt(null); return; }
    // Si no se editó, no se reescribe: así no se redondea ni se recorta el valor guardado.
    if (String(raw) === startRef.current) { setTxt(null); return; }
    const n = readNumber(raw);
    if (Number.isNaN(n)) { setRejected(String(raw)); setTxt(null); return; }
    if (n !== null) {
      let v = n / scale;
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      if (v !== value) onCommit(v);
    }
    setTxt(null);
  };
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
    <input
      type="text"
      inputMode="decimal"
      className="num"
      data-num-field=""
      aria-invalid={rejected !== null ? true : undefined}
      value={txt !== null ? txt : (format ? format(value) : value)}
      onFocus={(e) => {
        const start = String(+(value * scale).toFixed(6));
        startRef.current = start;
        setTxt(start);
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={(e) => { setTxt(e.target.value); setRejected(null); }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") { cancelRef.current = true; e.target.blur(); }
      }}
      title={t("Click para escribir el valor")}
      style={{
        width, textAlign: "right", fontSize, fontWeight: 500,
        fontFamily: "var(--font-mono)",
        color: color || (accent ? "var(--accent)" : "var(--ink)"),
        background: "var(--bg-paper)",
        border: rejected !== null ? "1px solid var(--accent, #c2410c)" : "1px solid var(--rule)",
        borderRadius: 6, padding: "2px 6px",
      }}
    />
    {rejected !== null && (
      <span role="alert" data-num-rejected="" onClick={() => setRejected(null)} style={{
        position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 5,
        width: 220, padding: "6px 8px", fontSize: 11, lineHeight: 1.4, textAlign: "left",
        color: "var(--ink)", background: "var(--bg-paper)", cursor: "pointer",
        border: "1px solid var(--accent, #c2410c)", borderRadius: 6,
      }}>
        {t("«{txt}» no es un número válido y no se aplicó. Se conserva el valor anterior.", { txt: rejected })}
      </span>
    )}
    </span>
  );
}

export function Slider({ label, value, min, max: maxScale, step, onChange, format, hint, kbd, accent }) {
  const t = useT();
  // La escala se amplía si el valor guardado o importado la supera: el valor se
  // muestra y se conserva tal cual, nunca se recorta al máximo de la escala.
  const max = Math.max(maxScale, value || 0);
  const [showHint, setShowHint] = useState(false);
  // Si el formato es porcentual, el campo acepta el número en puntos porcentuales (ej. 6.5 = 6.5%)
  const numScale = format && /%/.test(format(value)) ? 100 : 1;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <label style={{ fontSize: 13, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 8 }}>
          {label}
          {hint && (
            <button
              onClick={(e) => { e.preventDefault(); setShowHint((v) => !v); }}
              type="button"
              aria-label={t("Más información")}
              style={{
                width: 16, height: 16, padding: 0, borderRadius: "50%",
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: "var(--ink-3)", border: "1px solid var(--rule-strong)",
                background: "transparent", lineHeight: 1, display: "inline-flex",
                alignItems: "center", justifyContent: "center",
              }}
            >i</button>
          )}
        </label>
        <NumField value={value} min={min} max={max} scale={numScale} onCommit={onChange} format={format} accent={accent} />
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={rangeBg(value, min, max)}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
      {showHint && hint && (
        <div style={{
          marginTop: 8, fontSize: 12, color: "var(--ink-2)",
          background: "var(--bg-paper)", padding: "10px 12px",
          borderRadius: 6, border: "1px solid var(--rule)",
          lineHeight: 1.5,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// Campo de monto. El valor entra y sale en la moneda base del caso y se muestra
// en la moneda elegida arriba; si es distinta de la base, se indica el importe
// original en la moneda del caso.
// Arranca en la moneda global y la sigue cuando esta cambia.
export function MoneyInput({ label, value, onChange, hint, big }) {
  const t = useT();
  const { currency: unit, rate, lang, base } = usePrefs();
  const [txt, setTxt] = useState(null);
  // Entrada ambigua ("1,234" / "1.234") pendiente de confirmar: mientras no se
  // elija una lectura, el valor guardado no cambia.
  const [pending, setPending] = useState(null);
  // Entrada mal formada ("1,2,3", "12abc34") rechazada al salir del campo: se
  // avisa y se conserva el valor anterior.
  const [rejected, setRejected] = useState(null);
  const locale = localeFor(lang);
  const shown = toCurrency(value || 0, unit, rate, base);
  const original = makeMoney(base, rate, lang, base);
  const fmt = (n, maxDec = 2) => `${CURRENCIES[unit].sym} ${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: maxDec })}`;

  // El valor se aplica al salir del campo o con Enter, no en cada tecla: así una
  // entrada a medio escribir ("1,23" camino de "1,234") nunca se guarda.
  const startRef = useRef(null);
  const cancelRef = useRef(false);
  const handleChange = (raw) => {
    setTxt(raw);
    setRejected(null);
    const r = readAmount(raw);
    setPending(r.ambiguous ? r : null);
  };
  const commit = () => {
    if (cancelRef.current) { cancelRef.current = false; setPending(null); setTxt(null); return; }
    if (txt === null || pending) return;           // ambigua: se espera la confirmación
    if (txt === startRef.current) { setTxt(null); return; } // sin editar: no se reescribe
    const r = readAmount(txt);
    if (r.invalid) { setRejected(txt); setTxt(null); return; } // mal formada: no cambia nada
    onChange(r.value === null ? 0 : fromCurrency(r.value, unit, rate, base));
    setTxt(null);
  };
  const choose = (n) => {
    onChange(fromCurrency(n, unit, rate, base));
    setPending(null);
    setTxt(null);
  };
  // Lectura que se aplicará a lo escrito (regla visible mientras se edita).
  const current = txt !== null && !pending ? readAmount(txt) : null;
  const reading = current ? current.value : null;
  const invalidNow = !!(current && current.invalid);

  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>{label}</label>
      )}
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          fontFamily: "var(--font-mono)", fontSize: big ? 18 : 13,
          color: "var(--ink-3)", pointerEvents: "none",
        }}>{CURRENCIES[unit].sym}</span>
        <input
          data-money-input=""
          type="text"
          inputMode="decimal"
          value={txt !== null ? txt : shown.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          onFocus={(e) => {
            if (!pending) { const start = String(+shown.toFixed(2)); startRef.current = start; setTxt(start); }
            setTimeout(() => e.target.select(), 0);
          }}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.target.blur();
            if (e.key === "Escape") { cancelRef.current = true; setRejected(null); e.target.blur(); }
          }}
          aria-invalid={pending || invalidNow || rejected !== null ? true : undefined}
          className="num"
          style={{
            width: "100%",
            ...(pending || invalidNow || rejected !== null ? { borderColor: "var(--accent, #c2410c)", boxShadow: "0 0 0 1px var(--accent, #c2410c)" } : {}),
            fontSize: big ? 22 : 14,
            fontWeight: big ? 500 : 400,
            padding: big ? "14px 12px 14px 56px" : "8px 10px 8px 44px",
            fontFamily: "var(--font-mono)",
          }}
        />
      </div>
      {reading !== null && (
        <div className="num" data-money-reading="" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
          {t("Se toma como {v}", { v: fmt(reading, 6) })}
          <span style={{ color: "var(--ink-4)" }}> · {t("decimales con coma o punto; si hay los dos, el último es el decimal")}</span>
        </div>
      )}
      {invalidNow && (
        <div className="num" data-money-invalid="" style={{ fontSize: 12, color: "var(--accent, #c2410c)", marginTop: 4 }}>
          {t("«{txt}» no es un monto válido. Si sales del campo así, se conserva el valor anterior.", { txt })}
        </div>
      )}
      {rejected !== null && (
        <div role="alert" data-money-rejected="" style={{
          marginTop: 6, padding: "8px 12px", fontSize: 12, lineHeight: 1.5,
          color: "var(--ink)", background: "var(--bg-paper)",
          border: "1px solid var(--accent, #c2410c)", borderRadius: 6,
        }}>
          {t("«{txt}» no es un monto válido y no se aplicó. Se conserva el valor anterior: {v}.", { txt: rejected, v: fmt(shown, 6) })}
          <span style={{ color: "var(--ink-3)" }}> {t("Escribe solo cifras, con coma o punto como separador.")}</span>
          <button type="button" data-choice="entendido"
            onClick={() => setRejected(null)}
            style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", borderRadius: 4, border: "1px solid var(--rule-strong)", background: "var(--card)", color: "var(--ink)" }}>
            {t("Entendido")}
          </button>
        </div>
      )}
      {pending && (
        <div role="alert" data-money-ambiguous="" style={{
          marginTop: 6, padding: "10px 12px", fontSize: 12, lineHeight: 1.5,
          color: "var(--ink)", background: "var(--bg-paper)",
          border: "1px solid var(--accent, #c2410c)", borderRadius: 6,
        }}>
          <div style={{ marginBottom: 8 }}>
            {t("«{txt}» se puede leer de dos formas. ¿Cuál quisiste escribir? El valor no cambia hasta que elijas.", { txt })}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-choice="miles" className="num"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(pending.asThousands)}
              style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer", borderRadius: 4, border: "1px solid var(--rule-strong)", background: "var(--card)", color: "var(--ink)" }}>
              {t("Miles: {v}", { v: fmt(pending.asThousands) })}
            </button>
            <button type="button" data-choice="decimal" className="num"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(pending.asDecimal)}
              style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer", borderRadius: 4, border: "1px solid var(--rule-strong)", background: "var(--card)", color: "var(--ink)" }}>
              {t("Decimal: {v}", { v: fmt(pending.asDecimal, 3) })}
            </button>
            <button type="button" data-choice="cancelar"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setPending(null); setTxt(null); }}
              style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer", borderRadius: 4, border: "1px solid transparent", background: "transparent", color: "var(--ink-3)" }}>
              {t("Cancelar")}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
        <span>{hint}</span>
        {unit !== base && (
          <span className="num" style={{ whiteSpace: "nowrap" }}>
            {t("Importe del caso: {v}", { v: original.fmt(value) })}
          </span>
        )}
      </div>
    </div>
  );
}

// Selector compacto RD$ / US$
export function CurrencyToggle({ value, onChange }) {
  const t = useT();
  return (
    <div role="group" aria-label={t("Moneda")} style={{
      display: "inline-flex", padding: 2, gap: 2,
      background: "var(--bg-paper)", border: "1px solid var(--rule)", borderRadius: 6,
    }}>
      {Object.entries(CURRENCIES).map(([code, c]) => {
        const active = code === value;
        return (
          <button key={code} type="button" onClick={() => onChange(code)}
            aria-pressed={active}
            title={code === "DOP" ? t("Peso dominicano") : t("Dólar estadounidense")}
            style={{
              padding: "2px 8px", fontSize: 11, fontFamily: "var(--font-mono)",
              fontWeight: active ? 500 : 400,
              background: active ? "var(--card)" : "transparent",
              border: active ? "1px solid var(--rule-strong)" : "1px solid transparent",
              color: active ? "var(--ink)" : "var(--ink-3)",
              borderRadius: 4, cursor: "pointer",
            }}>{c.sym}</button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({ value, options, onChange, label }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ fontSize: 13, color: "var(--ink-2)", display: "block", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div style={{
        display: "inline-flex",
        padding: 3,
        background: "var(--bg-paper)",
        border: "1px solid var(--rule)",
        borderRadius: 8,
        gap: 2,
      }}>
        {options.map((opt) => {
          const v = typeof opt === "string" ? opt : opt.value;
          const l = typeof opt === "string" ? opt : opt.label;
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{
                padding: "5px 12px",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                background: active ? "var(--card)" : "transparent",
                border: active ? "1px solid var(--rule-strong)" : "1px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-3)",
                borderRadius: 6,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >{l}</button>
          );
        })}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, accent, big, mono }) {
  return (
    <div style={{
      padding: big ? "18px 18px" : "12px 14px",
      borderRadius: big ? 10 : 8,
      background: accent ? "var(--accent-tint)" : "var(--bg-paper)",
      border: accent ? "1px solid color-mix(in oklab, var(--accent) 25%, transparent)" : "1px solid var(--rule)",
    }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
        color: accent ? "var(--accent-ink)" : "var(--ink-3)",
        marginBottom: big ? 8 : 4,
      }}>{label}</div>
      <div className={mono ? "num" : ""} style={{
        fontFamily: big ? "var(--font-serif)" : (mono ? "var(--font-mono)" : "inherit"),
        fontSize: big ? 40 : 18,
        fontWeight: big ? 400 : 500,
        lineHeight: 1,
        color: accent ? "var(--accent-ink)" : "var(--ink)",
        letterSpacing: big ? "-0.02em" : 0,
      }}>{value}</div>
      {sub && <div style={{
        fontSize: 11, marginTop: big ? 8 : 3,
        color: accent ? "var(--accent-ink)" : "var(--ink-3)",
      }}>{sub}</div>}
    </div>
  );
}

// Section wrapper with sticky-anchor support
export function Step({ id, num, eyebrow, title, lede, children }) {
  return (
    <section id={id} className="step" data-step={id}>
      <div className="step-eyebrow">
        <span className="step-num">{num}</span>
        {eyebrow}
      </div>
      {title && <h2 dangerouslySetInnerHTML={{ __html: title }} />}
      {lede && <p className="step-lede">{lede}</p>}
      <div>{children}</div>
    </section>
  );
}

// Toggle button
export function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--bg-paper)" : "var(--ink-2)",
        border: "1px solid " + (active ? "var(--ink)" : "var(--rule-strong)"),
        borderRadius: 999,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >{children}</button>
  );
}

// Definition list row
export function Def({ k, v, accent }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 12,
      padding: "5px 0", borderBottom: "1px dotted var(--rule)",
      fontSize: 12,
    }}>
      <span style={{ color: "var(--ink-3)" }}>{k}</span>
      <span className="num" style={{ color: accent ? "var(--accent)" : "var(--ink)", fontWeight: 500 }}>{v}</span>
    </div>
  );
}
