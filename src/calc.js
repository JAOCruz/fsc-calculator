// Factor de Sobrecosto - calculation engine
// Methodology: Suárez Salazar (2005), adapted to Dominican Republic
// Matches Excel: Sistema_Factor_Sobrecosto_RD.xlsx

export const fmtRD = (v) =>
  "RD$\u00a0" +
  Number(v || 0).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtRDshort = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1e6) return "RD$\u00a0" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "RD$\u00a0" + (n / 1e3).toFixed(1) + "K";
  return "RD$\u00a0" + n.toFixed(0);
};

export const fmtPct = (v, d) => (v * 100).toFixed(d == null ? 2 : d) + "%";
export const fmtFactor = (v) => Number(v || 0).toFixed(6);

function calcMonthlyEgresos(cd, co, cc, duracion) {
  const fracMes = 1 / Math.max(duracion, 1);
  const GOC = cd * co * fracMes;
  const GOB = cd * cc * fracMes;
  return { GOC, GOB };
}

function resolveCODIA(params) {
  if (params.CODIA_APLICADO != null) return params.CODIA_APLICADO;
  if (params.TIPO_OBRA_CODIA === "Pública") return params.CODIA_PUBLICA || 0;
  if (params.TIPO_OBRA_CODIA === "Privada") return params.CODIA_PRIVADA || 0;
  return params.CODIA_MANUAL || 0;
}

export function runIteration(params, fscSupuesto, avance, cobros) {
  const {
    CD,
    CO,
    CC,
    CI,
    TPA,
    REA,
    TEA,
    ISR,
    SGND,
    TASA_ACTIVA,
    TASA_PASIVA,
    ANTICIPO,
    DESCUENTO,
    DURACION,
    FON,
  } = params;

  const CODIA_APLICADO = resolveCODIA(params);
  const PTV = CD * fscSupuesto;
  const meses = avance.length;
  const { GOC, GOB } = calcMonthlyEgresos(CD, CO, CC, DURACION);

  // CUB = cubicaciones valorizadas (seguimiento, no afecta el flujo directamente)
  const CUB = avance.map((a) => a * PTV);
  const EG_CD = avance.map((a) => a * CD);

  const ANT = Array(meses).fill(0);
  ANT[0] = ANTICIPO * PTV;

  // COB = cobros por cubicaciones. El usuario controla el cobro NETO de cada
  // mes (lo que entra a caja después de la amortización del anticipo), de modo
  // que anticipo (M1) + cubicaciones netas (M2+) = 100% del PTV. Internamente
  // se reconvierte a cubicación bruta para mantener la estructura del Excel
  // (COB bruto, AMO = -ANTICIPO*COB, DES = -DESCUENTO*COB); cuando los cobros
  // son válidos, la cubicación bruta vuelve a sumar exactamente el PTV.
  const netoAnticipo = 1 - ANTICIPO;
  const COB = cobros.map((c) => (netoAnticipo > 0 ? (c * PTV) / netoAnticipo : 0));

  const AMO = COB.map((c) => -ANTICIPO * c);
  const DES = COB.map((c) => -DESCUENTO * c);

  const SING = ANT.map((a, i) => a + COB[i] + AMO[i] + DES[i]);

  const IMP = EG_CD.map((e) => CI * e);
  const SEGRfix = Array(meses).fill(0);
  for (let m = 0; m < meses; m++) {
    const hasOverhead = m < DURACION;
    SEGRfix[m] = EG_CD[m] + (hasOverhead ? GOC + GOB : 0) + IMP[m];
  }

  const DIFP = SING.map((s, i) => s - SEGRfix[i]);
  const DIFA = Array(meses).fill(0);
  DIFA[0] = DIFP[0];
  for (let m = 1; m < meses; m++) DIFA[m] = DIFA[m - 1] + DIFP[m];

  const FPAS = Array(meses).fill(0);
  const FACT = Array(meses).fill(0);
  for (let m = 0; m < meses; m++) {
    if (DIFA[m] > 0) FPAS[m] = DIFA[m] * (TASA_PASIVA / 12);
    else FACT[m] = DIFA[m] * (TASA_ACTIVA / 12);
  }
  const FPAR = FPAS.map((p, i) => p + FACT[i]);

  const IMO = Math.abs(Math.min(...DIFA));
  const PIT = Math.abs(FACT.reduce((a, b) => a + b, 0));

  const F = CD > 0 ? PIT / CD : 0;

  const TAT = TPA + REA + TEA;
  const RC = IMO > 0 ? PTV / IMO : 0;
  const UAE = RC > 0 ? TAT / RC : 0;
  const GND = CD > 0 ? SGND / CD : 0;
  const UAI = UAE + GND;
  const FAI = 1 - ISR;
  const UC = FAI > 0 ? UAI / FAI : 0;

  const FIO = 1 + CO;
  const FIC = FIO + CC;
  const FII = FIC + CI;
  const FIF = FII + F;
  const FICOD = FIF + CODIA_APLICADO;
  const FIFON = FICOD + FON;
  const FIU = FIFON * (1 + UC);
  const FSC = FIU;

  return {
    fscInput: fscSupuesto,
    FSC,
    PTV,
    IMO,
    PIT,
    F,
    TAT,
    RC,
    UAE,
    GND,
    UAI,
    UC,
    FAI,
    FIO,
    FIC,
    FII,
    FIF,
    FICOD,
    FIFON,
    FIU,
    GOC,
    GOB,
    cashFlow: { SING, SEGRfix, DIFP, DIFA, FPAR, CUB, ANT, COB, AMO, DES, EG_CD, IMP, FPAS, FACT },
  };
}

// Excel logic: 4 iterative convergence steps, then FSC Final = average of iter 3 & 4.
// A final cash-flow recalculation is run with the averaged FSC so PTV, IMO, PIT and UC align.
export function iterateFSC(params, avance, cobros) {
  const iterations = [];
  let fscCurrent = params.FSC_INICIAL;

  // 4 iterative convergence steps
  for (let i = 0; i < 4; i++) {
    const result = runIteration(params, fscCurrent, avance, cobros);
    iterations.push({ ...result, iter: i + 1 });
    fscCurrent = result.FSC;
  }

  // FSC Final = average of iteration 3 and 4 outputs (Excel: C16 = (G13+H13)/2)
  const fscFinal = (iterations[2].FSC + iterations[3].FSC) / 2;

  // Final recalculation using the averaged FSC, matching Excel's final cash-flow block
  const finalResult = runIteration(params, fscFinal, avance, cobros);

  return { iterations, fscFinal, finalResult };
}

export const DEFAULTS = {
  CD: 971737,
  CO: 0.062,
  CC: 0.075,
  CI: 0.01,
  TPA: 0.09,
  REA: 0.10,
  TEA: 0.05,
  ISR: 0.27,
  SGND: 15000,
  TASA_ACTIVA: 0.22,
  TASA_PASIVA: 0.10,
  ANTICIPO: 0.20,
  DESCUENTO: 0.003,
  DURACION: 8,
  FSC_INICIAL: 1.3,
  TIPO_OBRA_CODIA: "Privada",
  CODIA_PUBLICA: 0.001,
  CODIA_PRIVADA: 0.002,
  CODIA_MANUAL: 0.001,
  FON: 0.01,
  ITBIS: 0.18,
  PCM: 0,
  // RD$ por US$ 1 — solo para mostrar/escribir montos en dólares; editable en el paso 01
  TASA_CAMBIO: 63.0,
};

export const DEFAULT_AVANCE = [0.05, 0.20, 0.40, 0.20, 0.15, 0, 0, 0, 0, 0, 0, 0];
// Cobros netos: M1 siempre es 0 (ahí entra el anticipo); M2+ suman 1 - ANTICIPO,
// de modo que anticipo + cubicaciones = 100% del PTV.
export const DEFAULT_COBROS = [0, 0.04, 0.16, 0.32, 0.16, 0.12, 0, 0, 0, 0, 0, 0];

export function makeDefaultAvance(duracion) {
  if (duracion <= 0) return [];
  const arr = Array(duracion).fill(0);
  const preset = [0.05, 0.20, 0.40, 0.20, 0.15];
  // Si la obra dura menos que el preset, lo que sobra se acumula en el último mes
  preset.forEach((v, i) => { arr[Math.min(i, duracion - 1)] += v; });
  return arr;
}

export function makeDefaultCobros(duracion, anticipo = 0.20) {
  if (duracion <= 0) return [];
  const arr = Array(duracion).fill(0);
  // Default: same as avance but delayed by 1 month (PLAZO_PAGO = 1 behavior),
  // escalado a (1 - anticipo) porque M1 es el anticipo.
  const preset = [0, 0.05, 0.20, 0.40, 0.20, 0.15];
  const k = 1 - anticipo;
  if (duracion === 1) return arr; // solo cabe el anticipo
  // Igual que el avance: lo que no cabe se cobra en el último mes
  preset.forEach((v, i) => { arr[Math.min(i, duracion - 1)] += v * k; });
  return arr;
}

// Convierte cronogramas guardados con el formato viejo (cubicaciones brutas
// que sumaban 100% sin contar el anticipo) al formato neto actual.
export function normalizeCobros(cobros, anticipo) {
  if (!Array.isArray(cobros) || cobros.length === 0) return cobros;
  const sum = cobros.reduce((a, b) => a + b, 0);
  const target = 1 - anticipo;
  if (Math.abs(sum - target) < 0.001) return cobros; // ya está en formato neto
  if (Math.abs(sum - 1) < 0.001 && anticipo > 0) {
    // formato viejo (bruto, suma 100%): escalar M2+ a (1 - anticipo)
    return cobros.map((v, i) => (i === 0 ? 0 : v * target));
  }
  return cobros; // suma inválida: se deja para que el usuario la ajuste
}

const EXAMPLE_RESIDENCIAL = {
  name: "Residencial Las Praderas",
  params: { ...DEFAULTS, CD: 971737, DURACION: 8 },
  avance: [0.05, 0.20, 0.40, 0.20, 0.15, 0, 0, 0, 0, 0, 0, 0],
  cobros: [0, 0.04, 0.16, 0.32, 0.16, 0.12, 0, 0, 0, 0, 0, 0],
};
const EXAMPLE_COMERCIAL = {
  name: "Local Comercial Centro",
  params: {
    ...DEFAULTS,
    CD: 4_500_000,
    DURACION: 6,
    CO: 0.055,
    CC: 0.070,
    ANTICIPO: 0.25,
    TIPO_OBRA_CODIA: "Privada",
  },
  avance: [0.10, 0.20, 0.30, 0.20, 0.15, 0.05, 0, 0, 0, 0, 0, 0],
  cobros: [0, 0.075, 0.15, 0.225, 0.15, 0.15, 0, 0, 0, 0, 0, 0],
};
const EXAMPLE_PUBLICA = {
  name: "Aula Escolar (Pública)",
  params: {
    ...DEFAULTS,
    CD: 2_800_000,
    DURACION: 5,
    ANTICIPO: 0.30,
    TIPO_OBRA_CODIA: "Pública",
    CO: 0.058,
    CC: 0.082,
  },
  avance: [0.15, 0.25, 0.30, 0.20, 0.10, 0, 0, 0, 0, 0, 0, 0],
  // Obra de 5 meses: la última cubicación (M6) se cobra junto con la de M5
  cobros: [0, 0.105, 0.175, 0.21, 0.21, 0, 0, 0, 0, 0, 0, 0],
};

export const EXAMPLES = {
  residencial: EXAMPLE_RESIDENCIAL,
  comercial: EXAMPLE_COMERCIAL,
  publica: EXAMPLE_PUBLICA,
};
