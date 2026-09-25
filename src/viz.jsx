import { fmtRD, fmtRDshort, fmtPct, fmtFactor } from './calc.js';

// --- FSC Waterfall: 1 → CO → CC → CI → F → CODIA → FON → ×(1+UC) = FSC
export function WaterfallFSC({ final }) {
  if (!final) return null;
  const steps = [
    { key: "Base", label: "Base (CD)", v: 1, delta: 1, color: "#1a1612", isBase: true },
    { key: "CO",   label: "Operación",       v: final.FIO,   delta: final.FIO - 1, color: "#8a8276" },
    { key: "CC",   label: "Campo",           v: final.FIC,   delta: final.FIC - final.FIO, color: "#8a8276" },
    { key: "CI",   label: "Imprevistos",     v: final.FII,   delta: final.FII - final.FIC, color: "#8a8276" },
    { key: "F",    label: "Financiamiento",  v: final.FIF,   delta: final.FIF - final.FII, color: "#8a8276" },
    { key: "CODIA",label: "CODIA",           v: final.FICOD, delta: final.FICOD - final.FIF, color: "#8a8276" },
    { key: "FON",  label: "F. Pensiones",    v: final.FIFON, delta: final.FIFON - final.FICOD, color: "#8a8276" },
    { key: "UC",   label: "Utilidad UC",     v: final.FIU,   delta: final.FIU - final.FIFON, color: "var(--accent)" },
    { key: "FSC",  label: "FSC",             v: final.FSC,   delta: 0, color: "var(--accent)", isFinal: true },
  ];
  const maxV = Math.max(...steps.map((s) => s.v));
  const yScale = (v) => (v / (maxV * 1.05)) * 100; // percent of height
  const W = 100 / steps.length;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", height: 220, padding: "8px 0 30px" }}>
        {/* baseline rule at v=1 */}
        <div style={{
          position: "absolute", left: 0, right: 0,
          bottom: 30 + yScale(1) * 1.82, height: 1,
          borderTop: "1px dashed var(--rule-strong)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 4, top: 0,
          fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)",
        }}>{fmtFactor(maxV * 1.05)}</div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="182" style={{ display: "block", overflow: "visible" }}>
          {steps.map((s, i) => {
            const x = i * W + W * 0.15;
            const w = W * 0.7;
            const top = s.isBase || s.isFinal
              ? 100 - yScale(s.v)
              : 100 - yScale(s.v);
            const bottom = s.isBase || s.isFinal
              ? 100
              : 100 - yScale(s.v - s.delta);
            const h = Math.max(0.5, bottom - top);
            return (
              <g key={s.key}>
                {/* connector line */}
                {i > 0 && !steps[i].isFinal && (
                  <line
                    x1={(i - 1) * W + W * 0.15 + W * 0.7}
                    y1={100 - yScale(steps[i - 1].v)}
                    x2={i * W + W * 0.15}
                    y2={100 - yScale(steps[i - 1].v)}
                    stroke="var(--rule-strong)"
                    strokeDasharray="0.5 0.5"
                    strokeWidth="0.2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <rect
                  x={x} y={top} width={w} height={h}
                  fill={s.color}
                  opacity={s.isBase ? 1 : (s.isFinal ? 1 : 0.9)}
                />
              </g>
            );
          })}
        </svg>

        {/* labels under bars */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          display: "flex", height: 30,
        }}>
          {steps.map((s) => (
            <div key={s.key} style={{ flex: 1, textAlign: "center", paddingTop: 4 }}>
              <div style={{ fontSize: 10, color: "var(--ink-2)", fontWeight: s.isFinal ? 500 : 400, marginBottom: 1 }}>
                {s.label}
              </div>
              <div className="num" style={{ fontSize: 9, color: s.isFinal ? "var(--accent)" : "var(--ink-3)" }}>
                {s.isBase ? "1.000000" : s.isFinal ? fmtFactor(s.v) : "+" + s.delta.toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Cash flow chart: DIFA line + zero baseline
export function CashFlowChart({ iteration, height, showLegend }) {
  if (!iteration) return null;
  const h = height || 180;
  const cf = iteration.cashFlow;
  const DIFA = cf.DIFA;
  const DIFP = cf.DIFP;
  const meses = DIFA.length;

  const max = Math.max(...DIFA, 0, ...DIFP, 0);
  const min = Math.min(...DIFA, 0, ...DIFP, 0);
  const range = max - min || 1;
  const pad = range * 0.1;
  const yMax = max + pad;
  const yMin = min - pad;

  const W = 600, H = 200;
  const xStep = meses > 1 ? W / (meses - 1) : W;
  const yScale = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
  const xPos = (i) => (meses > 1 ? i * xStep : W / 2);

  // DIFA line path
  const path = DIFA.map((v, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yScale(v)}`).join(" ");
  // Area below DIFA
  const area = `M ${xPos(0)} ${yScale(DIFA[0])} ` +
    DIFA.slice(1).map((v, i) => `L ${xPos(i + 1)} ${yScale(v)}`).join(" ") +
    ` L ${xPos(meses - 1)} ${yScale(0)} L ${xPos(0)} ${yScale(0)} Z`;

  const zeroY = yScale(0);
  const imoLevel = -iteration.IMO;

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={h} style={{ display: "block", overflow: "visible" }}>
        {/* IMO line */}
        {iteration.IMO > 0 && yScale(imoLevel) >= 0 && yScale(imoLevel) <= H && (
          <line x1="0" x2={W} y1={yScale(imoLevel)} y2={yScale(imoLevel)}
            stroke="var(--bad)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
        )}
        {/* zero baseline */}
        <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="var(--ink)" strokeWidth="1" opacity="0.5" />
        {/* Bars for DIFP (monthly delta) */}
        {DIFP.map((v, i) => {
          if (v === 0) return null;
          const yTop = yScale(Math.max(v, 0));
          const yBot = yScale(Math.min(v, 0));
          return (
            <rect key={i} x={xPos(i) - 8} y={yTop} width="16"
              height={Math.max(0.5, yBot - yTop)}
              fill={v >= 0 ? "var(--good)" : "var(--accent)"}
              opacity="0.25" />
          );
        })}
        {/* DIFA area */}
        <path d={area} fill="var(--ink)" opacity="0.06" />
        {/* DIFA line */}
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        {/* DIFA dots */}
        {DIFA.map((v, i) => (
          <circle key={i} cx={xPos(i)} cy={yScale(v)} r="3"
            fill={v < 0 ? "var(--accent)" : "var(--good)"} stroke="var(--bg-paper)" strokeWidth="1.5" />
        ))}
      </svg>

      <div style={{ display: "flex", marginTop: 6, fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
        {DIFA.map((_, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>M{i + 1}</div>
        ))}
      </div>

      {showLegend && (
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--ink-2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 2, background: "var(--ink)" }}></span> Saldo acumulado (DIFA)
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "var(--bad)", opacity: 0.6 }}></span> IMO = {fmtRDshort(iteration.IMO)}
          </span>
        </div>
      )}
    </div>
  );
}

// --- S-curve: project advance accumulated
export function SCurve({ avance, duracion, height }) {
  const h = height || 100;
  const meses = avance.length;
  const W = 600, H = 100;
  const accum = [];
  let s = 0;
  for (let i = 0; i < meses; i++) {
    s += avance[i];
    accum.push(s);
  }
  const xPos = (i) => (meses > 1 ? (i / (meses - 1)) * W : W / 2);
  const yPos = (v) => H - v * H;
  const pathAccum = accum.map((v, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yPos(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={h} style={{ display: "block" }}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1="0" x2={W} y1={yPos(g)} y2={yPos(g)}
          stroke="var(--rule)" strokeWidth="1" />
      ))}
      {/* duration marker */}
      {duracion <= meses && (
        <line x1={xPos(duracion - 1)} x2={xPos(duracion - 1)} y1="0" y2={H}
          stroke="var(--accent)" strokeDasharray="3 3" strokeWidth="1" opacity="0.5" />
      )}
      {/* monthly bars */}
      {avance.map((v, i) => v > 0 && (
        <rect key={i} x={xPos(i) - 12} y={yPos(v)} width="24"
          height={H - yPos(v)} fill="var(--accent)" opacity="0.35" />
      ))}
      {/* accumulated line */}
      <path d={pathAccum} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      {accum.map((v, i) => v > 0 && (
        <circle key={i} cx={xPos(i)} cy={yPos(v)} r="2.5" fill="var(--ink)" />
      ))}
    </svg>
  );
}

// --- Convergence chart: FSC across iterations
export function Convergence({ iterations }) {
  if (!iterations || iterations.length < 2) return null;
  const vals = iterations.map((it) => it.FSC);
  const inputs = iterations.map((it) => it.fscInput);
  const all = [...vals, ...inputs];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = max - min || 0.01;
  const pad = range * 0.2;
  const W = 600, H = 100;
  const xPos = (i) => (i / Math.max(1, iterations.length - 1)) * W;
  const yPos = (v) => H - ((v - (min - pad)) / (range + pad * 2)) * H;
  const pathVals = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xPos(i)} ${yPos(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100" style={{ display: "block" }}>
      {/* final convergence value rule */}
      <line x1="0" x2={W} y1={yPos(vals[vals.length - 1])} y2={yPos(vals[vals.length - 1])}
        stroke="var(--accent)" strokeDasharray="3 3" strokeWidth="1" opacity="0.5" />
      <path d={pathVals} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      {vals.map((v, i) => (
        <circle key={i} cx={xPos(i)} cy={yPos(v)} r="3.5"
          fill="var(--accent)" stroke="var(--bg-paper)" strokeWidth="1.5" />
      ))}
      {/* labels */}
      {vals.map((v, i) => (
        <text key={"t" + i} x={xPos(i)} y={yPos(v) - 8}
          textAnchor="middle" fontSize="8" fontFamily="IBM Plex Mono" fill="var(--ink-2)">
          {v.toFixed(4)}
        </text>
      ))}
    </svg>
  );
}

// --- FSC gauge — circular meter showing FSC vs 1.0..2.0 range
export function FSCGauge({ value }) {
  const min = 1.0, max = 1.8;
  const clamped = Math.max(min, Math.min(max, value || min));
  const pct = (clamped - min) / (max - min);
  // semicircle gauge
  const r = 80, cx = 100, cy = 100;
  const startAngle = Math.PI;       // 180deg
  const endAngle = 2 * Math.PI;     // 360deg
  const angle = startAngle + pct * (endAngle - startAngle);
  const arc = (a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const largeArc = pct > 0.5 ? 1 : 0;
  const bgArc = `M ${arc(startAngle)} A ${r} ${r} 0 1 1 ${arc(endAngle)}`;
  const fillArc = `M ${arc(startAngle)} A ${r} ${r} 0 ${largeArc} 1 ${arc(angle)}`;
  return (
    <svg viewBox="0 0 200 130" width="100%" height="120" style={{ display: "block" }}>
      <path d={bgArc} stroke="var(--rule)" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d={fillArc} stroke="var(--accent)" strokeWidth="10" fill="none" strokeLinecap="round" />
      {/* tick marks */}
      {[1.0, 1.2, 1.4, 1.6, 1.8].map((t) => {
        const a = startAngle + ((t - min) / (max - min)) * (endAngle - startAngle);
        return (
          <g key={t}>
            <line
              x1={cx + (r + 6) * Math.cos(a)} y1={cy + (r + 6) * Math.sin(a)}
              x2={cx + (r + 12) * Math.cos(a)} y2={cy + (r + 12) * Math.sin(a)}
              stroke="var(--ink-3)" strokeWidth="1"
            />
            <text x={cx + (r + 20) * Math.cos(a)} y={cy + (r + 20) * Math.sin(a) + 3}
              textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono" fill="var(--ink-3)">
              {t.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* center value */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="32"
        fontFamily="Instrument Serif" fill="var(--ink)">{(value || 0).toFixed(4)}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9"
        fontFamily="IBM Plex Sans" fill="var(--ink-3)" letterSpacing="1.5">FSC</text>
    </svg>
  );
}
