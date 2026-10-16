# FSC Calculator RD

Calculadora guiada para estimar el **Factor de Sobrecosto (FSC)** y el **Precio Técnico de Venta (PTV)** de proyectos de construcción en República Dominicana.

La metodología de cálculo, las fórmulas, los parámetros y el caso de uso los suministró el titular mediante la hoja de Excel `Sistema_Factor_Sobrecosto_RD.xlsx`, basada en la metodología pública de *Suárez Salazar (2005)* y adaptada al contexto local (CODIA, Fondo de Pensiones, ITBIS, tasas financieras RD).

Titular: Nayib Wessin. Ver el documento de titularidad que acompaña esta entrega. Componentes de terceros y sus licencias: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Estructura

| Archivo | Contenido |
|---|---|
| `src/calc.js` | Motor de cálculo del FSC: 4 iteraciones y promedio de las dos últimas, flujo de caja mensual, valores por defecto y ejemplos precargados. |
| `src/App.jsx` | Estado de la aplicación, navegación de pasos, escenarios guardados, exportación e importación de casos, confirmación de la moneda base. |
| `src/sections.jsx` | Los 10 pasos de captura de datos. |
| `src/ui.jsx` | Componentes de interfaz: campos de monto (en la moneda que se está viendo), deslizadores y controles. |
| `src/viz.jsx` | Gráficos SVG: cascada, flujo de caja, indicador del FSC y convergencia. |
| `src/prefs.jsx` | Idioma (es/en), moneda de visualización y conversión desde la moneda base del caso. |
| `src/i18n-en.js` | Textos en inglés. |
| `src/index.css`, `index.html`, `src/main.jsx` | Estilos y punto de entrada. |
| `public/docs.html` | Documentación de fórmulas (español/inglés). |
| `public/fsc-assistant.js` | Widget del asistente de IA. |
| `netlify/functions/ask-ai.mjs` | Función del asistente de IA (Gemini, con respaldo opcional de Azure OpenAI). |
| `netlify.toml` | Configuración de publicación en Netlify. |
| `tests/` | Pruebas de regresión del motor y de aceptación de la moneda base. |

## Uso local

Requiere Node.js 22.

```bash
npm install
npm run dev       # servidor local en http://localhost:5173
npm run build     # versión de producción en dist/
npm run preview   # previsualizar dist/
```

El asistente de IA solo funciona publicado en Netlify (o con `netlify dev`), porque usa la función `ask-ai`.

## Publicación en Netlify

1. Crear un sitio en Netlify conectado a este repositorio. `netlify.toml` ya define el comando (`npm run build`), la carpeta (`dist`) y las funciones (`netlify/functions`).
2. En *Site configuration → Environment variables*, definir:

| Variable | Obligatoria | Uso |
|---|---|---|
| `GEMINI_API_KEY` | Sí, para el asistente | Clave de Google Gemini (Google AI Studio). |
| `GEMINI_MODEL` | No | Modelo preferido; si falla se usan `gemini-flash-latest` y `gemini-flash-lite-latest`. |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_VERSION` | No | Proveedor de respaldo opcional. |

Las claves nunca se guardan en el código.

## Casos y moneda

- Los casos se guardan en el navegador de cada usuario y se pueden exportar e importar como JSON desde el panel de resultados ("Exportar caso" / "Importar caso"). Al cambiar la dirección de la página, los casos guardados en el navegador no se trasladan: conviene exportarlos antes.
- Cada caso tiene una **moneda base** (`params.MONEDA_BASE`: `DOP` o `USD`). Los importes se guardan y se calculan en esa moneda, y todo el caso se muestra en ella. El selector RD$/US$ del encabezado solo convierte para visualizar, con la tasa de cambio del caso (`params.TASA_CAMBIO`, RD$ por US$ 1), y mientras está activo muestra un aviso de conversión. Los campos de monto no tienen selector propio.
- Al abrir un JSON o un caso guardado sin moneda base, la aplicación pide confirmarla y no convierte ningún valor.

## Pruebas

```bash
# Motor de cálculo: compara una versión anterior (commit) con la actual, valor por valor.
node tests/regresion-motor.mjs b422083                 # ejemplos precargados
node tests/regresion-motor.mjs b422083 caso.json       # uno o más casos exportados

# Aceptación de la moneda base en el navegador (requiere Playwright: npm i -D playwright && npx playwright install chromium).
node tests/aceptacion-moneda.mjs <url-anterior> <url-actual> caso.json salida/ USD
```

Los casos de prueba se leen sin modificarse y se informa su huella SHA-256.

## Historial

El historial de cambios está en git (`git log`). Si recibiste esta entrega en ZIP, el archivo `fsc-calculator.bundle` contiene el repositorio completo con su historial:

```bash
git clone fsc-calculator.bundle fsc-calculator
```
