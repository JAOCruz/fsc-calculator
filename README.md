# FSC Calculator RD

Calculadora guiada para estimar el **Factor de Sobrecosto (FSC)** en proyectos de construcción en República Dominicana.

Metodología basada en *Suárez Salazar (2005)*, adaptada al contexto local (CODIA, ITBIS, tasas financieras RD, etc.).

## Estructura

- `src/main.jsx` — punto de entrada de React.
- `src/App.jsx` — estado global, navegación de pasos, exportación/importación de casos.
- `src/calc.js` — motor de cálculo del FSC, formateadores y valores por defecto.
- `src/ui.jsx` — componentes de UI reutilizables (inputs, sliders, controles).
- `src/viz.jsx` — visualizaciones SVG (waterfall, cash-flow, gauge, convergencia).
- `src/sections.jsx` — los 10 pasos del wizard de entrada.
- `src/index.css` — estilos globales.
- `public/fsc-assistant.js` — widget de asistente que se cargó en el deploy original de Netlify.

## Scripts

```bash
npm install
npm run dev      # servidor local
npm run build    # build de producción en dist/
npm run preview  # previsualizar build
```

## Despliegue

El repositorio puede conectarse a Netlify para deploy continuo. El build command es `npm run build` y el publish directory es `dist`.

> Nota: el widget `fsc-assistant.js` en `public/` intenta llamar a `/.netlify/functions/ask-ai`. Esa función serverless no fue recuperable desde el deploy público, por lo que la funcionalidad de chat requiere recrearla en `netlify/functions/ask-ai` si se desea activar.
