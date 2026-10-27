# Checkmate Survivors

**Jugalo en itch.io:** <https://fibonaku.itch.io/checkmate-survivors>

Roguelite de **ajedrez real** en pixel art (HTML5). Empezás con un rey y pocos peones, elegís tu camino por un mapa, enfrentás monstruos animados (cada uno con sus propias piezas temáticas) contra el reloj y mejorás de forma permanente cuando caés. La run se guarda sola entre nodos.

- **Jugar:** abrí `index.html` con doble clic (no necesita servidor ni instalación).
- **Nodos bonus Mate Rush** en el mapa: 60 segundos de mates en 1, cada mate da monedas.
- **Arena**: tres duelos cortos seguidos por monedas; perder no termina la run.
- Resolución fija de **1280×720** que se escala a cualquier ventana.
- **Diseño completo:** [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
- **Tests:** `node tests/perft.js`, `node tests/ai.js`, `node tests/scenarios.js`, `node tests/i18n.js`, `node tests/smoke.js`, `node tests/balance.js`
- **Página de itch.io:** portada, capturas y textos en [`marketing/`](marketing/ITCH_PAGE.md).
- **Para agentes de IA:** [`AGENTS.md`](AGENTS.md).
- **Subir a itch.io:** ejecutá `package-itch.ps1` (genera `dist/checkmate-survivors-html5.zip`) y subilo como proyecto *HTML* marcando "played in the browser".

Idioma por defecto: inglés (selector de español en el menú). Sin dependencias.
