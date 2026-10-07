# Componentes de terceros

FSC Calculator RD usa los siguientes componentes de terceros. Todos son de código abierto o de uso gratuito y permiten el uso comercial, la modificación y la redistribución, siempre que se conserven sus avisos de copyright y licencia. Ninguno es propiedad de Arcova.

## 1. Incluidos en la aplicación publicada

Se empaquetan dentro de `dist/` al compilar.

| Componente | Versión | Licencia | Titular | Uso |
|---|---|---|---|---|
| React | 18.3.1 | MIT | Facebook, Inc. (Meta) y afiliados | Interfaz de usuario |
| React DOM | 18.3.1 | MIT | Facebook, Inc. (Meta) y afiliados | Interfaz de usuario |
| scheduler | 0.23.2 | MIT | Facebook, Inc. (Meta) y afiliados | Dependencia de React DOM |
| loose-envify | 1.4.0 | MIT | Andres Suarez | Dependencia de React |
| js-tokens | 4.0.0 | MIT | Simon Lydell | Dependencia de loose-envify |

## 2. Cargados desde servicios externos (CDN)

No están dentro del código: el navegador los descarga al abrir la página.

| Componente | Versión | Licencia | Origen | Uso |
|---|---|---|---|---|
| KaTeX | 0.16.9 | MIT | cdn.jsdelivr.net | Fórmulas en la documentación (`docs.html`) |
| Font Awesome Free | 6.5.2 | Iconos: CC BY 4.0 · Fuentes: SIL OFL 1.1 · Código: MIT | cdnjs.cloudflare.com | Iconos |
| Instrument Serif | — | SIL Open Font License 1.1 | Google Fonts | Tipografía de títulos |
| IBM Plex Sans / IBM Plex Mono | — | SIL Open Font License 1.1 | Google Fonts | Tipografía de textos y cifras |

## 3. Herramientas de desarrollo

Se usan para compilar el proyecto y no forman parte de la aplicación publicada. Se instalan con `npm install` (archivo `package-lock.json`).

- Vite 5 y @vitejs/plugin-react (MIT), junto con sus dependencias: 109 paquetes en total, con licencias MIT (101), ISC (5), Apache-2.0 (1), BSD-3-Clause (1) y CC-BY-4.0 (1, la base de datos de compatibilidad de navegadores `caniuse-lite`).
- Las pruebas de aceptación usan Playwright (Apache-2.0), que no se incluye en el proyecto y se instala aparte.

## 4. Servicios externos

Tienen sus propios términos de uso y se contratan en la cuenta del titular.

| Servicio | Uso | Términos |
|---|---|---|
| Netlify | Publicación de la página y de la función del asistente | netlify.com/legal |
| Google Gemini API | Respuestas del asistente de IA (clave del titular) | ai.google.dev/gemini-api/terms |
| Azure OpenAI (opcional) | Respaldo del asistente, si se configura | Términos de Microsoft Azure |

## Notas

- Los textos completos de las licencias MIT, ISC, Apache-2.0 y BSD están dentro de cada paquete en `node_modules/` después de `npm install`. La SIL OFL 1.1 está en scripts.sil.org/OFL y CC BY 4.0 en creativecommons.org/licenses/by/4.0.
- La metodología de cálculo proviene de la hoja de Excel suministrada por el titular, basada en Suárez Salazar (2005). No es un componente de software de terceros.
