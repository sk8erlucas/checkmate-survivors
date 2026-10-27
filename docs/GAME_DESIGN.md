# Checkmate Survivors — Documento de diseño

> Roguelite 2D de **ajedrez real** en pixel art. HTML5 + JavaScript puro, pensado para subirse a **itch.io**.
> Idioma por defecto: **inglés** (selector de **español** en el menú). Última actualización: 26/10/2026 (**v0.6.0 · Early Alpha**, se muestra en el menú principal; la constante es `D.VERSION` en `data.js`).
> **Publicado** en itch.io: <https://fibonaku.itch.io/checkmate-survivors>

---

## 1. Visión

Empezás con un rey y un puñado de peones y tenés que abrirte camino por un mapa ramificado de batallas contra rivales con personalidad propia. **Las reglas del ajedrez nunca cambian** (mismas piezas, mismos movimientos, enroque, al paso y coronación): lo roguelite está en la estructura de la run, el reloj, las pociones, los amuletos y la progresión permanente.

### Pilares
1. **Ajedrez de verdad.** Sin piezas inventadas ni reglas raras. Nunca se supera el ejército estándar (8P, 2N, 2B, 2R, 1Q).
2. **Presión de reloj.** Cada batalla tiene reloj (bullet / blitz / rápida). El tiempo es un recurso que se puede ganar, robar y perder.
3. **Riesgo vs. recompensa.** En cada bifurcación elegís dificultad: más difícil = más monedas y mejores premios.
4. **Rivales con carácter.** La IA está programada a mano, con estilos de juego distintos (nada de motores externos ni modelos de IA).
5. **Una más y listo.** Si perdés, la run termina, pero ganás Coronas para mejoras permanentes.

### Requisitos acordados con el autor
- Empezar con pocas piezas; el rival suele tener más. Ambos crecen a medida que se avanza.
- Las piezas capturadas **no se pierden** durante la run (vuelven al terminar la partida). Al perder la run, se pierde lo conseguido en el camino y se conservan las mejoras **compradas** en la tienda permanente.
- Caminos elegibles con dificultad (fácil / normal / difícil) según recompensa.
- Escenarios con partidas ya en curso (puzzles) y objetivos variados.
- Relojes con distinta duración (bullet, etc.), potions/power-ups que dan tiempo o **roban tiempo**, y rivales que también pueden robarlo.
- Al perder una partida se termina la run, pero se pueden comprar permanentemente **vidas (reintentos)** que reinician ese escenario.
- La IA enemiga **se programa a mano** (sin IA externa).
- Moneda de meta-progresión según qué tan lejos se llegue (**Coronas**).

---

## 2. Reglas de ajedrez implementadas
Motor propio (`js/chess.js`), validado con **perft** (conteo de nodos de posiciones de referencia, incluidas las más difíciles: enroque, al paso, promoción con jaque).
- Movimientos legales completos, jaque, jaque mate, ahogado.
- Enroque (con todas las restricciones), captura al paso, coronación (el jugador elige la pieza).
- Tablas por: ahogado, material insuficiente, triple repetición (hash Zobrist), regla de 50 jugadas.
- Reloj: si se acaba el tiempo se pierde, **salvo** que el rival no tenga material para dar mate (entonces es tablas).
- Notación SAN en el registro de jugadas.

> **Tablas = no es victoria.** En objetivos que piden ganar, un empate cuenta como derrota de la batalla (se puede usar un Reintento). En el objetivo *Sobrevivir*, las tablas cuentan como éxito.

---

## 3. Estructura de una run
**Acto 1 (prototipo):** 7 pasos + jefe. El mapa se genera en cada run.

| Paso | Contenido |
|---|---|
| 1 | **Mayormente puzzles** (80% puzzle / 20% duelo de calentamiento), 3 nodos fáciles |
| 2 | Mezcla con más puzzles: 50% puzzle, 25% duelo, 15% evento, 5% tienda, 5% fogata |
| 3 | Duelo, Puzzle, Evento, Tienda o Fogata (3 nodos) |
| 4 | **Tienda y Fogata garantizadas** + 1 duelo |
| 5 | Mixto |
| 6 | Mixto (2 nodos) |
| 7 | **Fogata y Tienda** (descanso antes del jefe) |
| Jefe | **The Hourglass Lich / El Liche del Reloj** (ladrón de tiempo) |

Cada nodo se conecta con 1–2 del paso siguiente (estilo *Slay the Spire*, en horizontal). Antes de entrar se muestra un detalle con rival, estilo, dificultad, objetivo, reloj y recompensa estimada.

**El mapa** se dibuja como un tablero oscuro: cada nodo es un medallón (retrato del monstruo en duelos y jefe, ícono en el resto) con el anillo del color de su dificultad o tipo, caminos curvos (el disponible en dorado animado, el recorrido en violeta), un rey marcando dónde estás, ✓ en los nodos superados y una leyenda. Se desplaza solo hasta tus opciones.

**Tu lado del tablero**: debajo del mapa (y en la tienda) se ve tu ejército ubicado en sus casillas iniciales, el valor del ejército, los espacios de poción (llenos y vacíos) y los amuletos.

### Inicio amable (calentamiento)
Con pocas piezas ganar por mate es muy difícil, así que los duelos fáciles de los **pasos 1 a 3** son de calentamiento (`D.INTRO`): IA de profundidad 1 con 60% de errores, ejército enemigo de 0.4× el tuyo (≈2 peones), reloj rápido y objetivos simples: **coronar un peón** o **capturar N piezas** (a veces mate).

Probabilidad de dificultad por paso (fácil / normal / difícil): paso 1 100/0/0 · paso 2 85/15/0 · paso 3 60/35/5 · paso 4 40/45/15 · paso 5 25/50/25 · paso 6 20/45/35.

### Tipos de nodo
- **Duelo**: batalla completa contra un rival (dificultad fácil/normal/difícil, reloj y objetivo propios). Al ganar: monedas + elegir premio (en *difícil* se eligen **2**).
- **Puzzle (partida en curso)**: posición prefabricada con objetivo propio (mate en N, capturar la dama, sobrevivir...). Todas las posiciones están **validadas por un solver exhaustivo** en los tests.
- **Tienda**: pociones, 1 amuleto y piezas (peón/otra pieza, dama a veces). Botones de precio dorados con ícono de moneda (en gris y con "no alcanza" si no te da la plata). **Renovar** el stock: la primera vez gratis, después 10, 20, 30... monedas. Comprar suena con una caja registradora.
- **Premios**: la pantalla de premios también se puede **renovar** (1ª gratis, después 10, 20...), solo antes de elegir el primero.
- **Evento**: decisiones con riesgo (El Apostador, El Viejo Relojero, El Ermitaño, El Pozo Extraño, El Prestamista).
- **Fogata**: elegir una: +1 Reintento (máx. 3), +1 peón, o una poción.
- **Jefe**: al vencerlo se completa el acto y la run termina en victoria.

### Estado inicial de la run
Ejército: **5 peones** (+ mejoras permanentes) · 20 monedas · **1 Reintento** (+ mejoras) · 3 espacios de poción (+ mejoras/amuletos) · **1 Ojo del Oráculo** (pista) gratis · los **amuletos permanentes** que hayas comprado.

### Ejércitos y colocación
Las piezas se ubican en sus casillas estándar. Peones por orden de centro a bordes (d, e, c, f, b, g, a, h). Caballos g1/b1, alfiles f1/c1, torres h1/a1, dama d1. El rival se arma con un **presupuesto de puntos** proporcional a tu ejército:

`presupuesto = valor_de_tu_ejército × factor + extra`, con valores P=1, N=3, B=3, R=5, Q=9.
Composición: ~45% del presupuesto en peones y el resto en piezas al azar (nunca más que un ejército estándar).

---

## 4. Dificultades

| Tier | IA (profundidad) | Errores* | Presupuesto enemigo | Monedas × | Color |
|---|---|---|---|---|---|
| Calentamiento (pasos 1–3) | 1 | 60% | 0.40 × tu ejército | 1.0 | verde |
| Fácil | 1 | 50% | 0.50 × tu ejército | 1.0 | verde |
| Normal | 2 | 30% | 0.70 × tu ejército | 1.5 | amarillo |
| Difícil | 3 | 15% | 0.90 × + 1 | 2.2 | rojo |
| Jefe | 4 | 3% | 1.10 × + 2 | 4.0 | violeta |

\* "Errores": probabilidad de que el rival elija una jugada plausible pero no la mejor (nunca una que permita mate en 1).
En finales con pocas piezas (≤8) la IA busca 1 nivel más profundo, y con ≤4 piezas 2 niveles más (solo rivales de profundidad ≥3).

### Relojes
| Control | Tiempo | Incremento | Monedas × |
|---|---|---|---|
| Bullet | 50 s | +1 s | 1.4 |
| Blitz | 90 s | +2 s | 1.15 |
| Rápida | 150 s | +3 s | 1.0 |

El jugador recibe bonos (Banco de tiempo +5 s por nivel, Reloj de bolsillo +10 s, Amuleto de tempo +1 s de incremento). El rival no.

### Objetivos
| Objetivo | Condición | Límite (fácil/normal/difícil/jefe) |
|---|---|---|
| Mate | Dar jaque mate | — |
| Mate en N | Mate en N jugadas tuyas o menos | 30 / 24 / 20 / 24 |
| Sobrevivir | Completar N jugadas sin perder (tablas = éxito) | 12 / 15 / 18 / 20 |
| Capturar la dama | Capturar la dama enemiga en N jugadas (el rival recibe una dama) | 12 / 10 / 8 / 10 |
| Coronar | Coronar un peón (gana al instante) | — |
| Capturar N | Capturar N piezas enemigas (sin límite de jugadas; N nunca supera las piezas del rival) | 2 / 3 / 4 / 5 |

### Recompensa en monedas
`round((20 + paso×4) × mult_dificultad × mult_reloj × (1 + 0.1×Monedero) × (1.25 si Moneda de la suerte))`

---

## 5. Pociones, amuletos y economía

### Pociones (consumibles, no gastan jugada, se usan en tu turno)
| Poción | Efecto | Precio |
|---|---|---|
| Rewind (Deshacer) | Deshace tu última jugada y la respuesta del rival | 30 |
| Oracle Eye (Pista) | Muestra una buena jugada (flecha dorada). Tu reloj se pausa mientras "piensa" | 25 |
| Watchtower (Atalaya) | Marca tus piezas atacadas (rojo) y las enemigas que atacás (verde) | 20 |
| Hourglass | +15 s en tu reloj | 20 |
| Time Thief | Robás 10 s al rival | 35 |
| Frozen Time | El reloj rival no corre durante su próxima jugada | 30 |

Los espacios de poción son limitados (3 base). Si la bolsa está llena, la poción se vende por la mitad de su precio.

### Amuletos (pasivos durante toda la run, 70 monedas en tienda)
En el juego se llaman **amuletos** (en el código siguen siendo `relic`/`RELICS`).
Pocket Watch (+10 s por batalla) · Lucky Coin (+25% monedas) · Deep Pockets (+1 espacio de poción) · Veteran Eye (1 pista gratis por batalla) · Tempo Charm (+1 s de incremento) · Iron Clock (inmune al robo de tiempo) · Phoenix Feather (+1 Reintento).

### Piezas (tienda)
Peón 20 · Caballo 45 · Alfil 45 · Torre 70 · Dama 130 (máximos: 8 / 2 / 2 / 2 / 1).

### Rival con objetos
Algunos rivales pueden **robarte 8 s** (Colmillo el Lobizón, Conde Vlastor: 1 uso; el Liche del Reloj: 2 usos y un reloj de arena). Se avisa con un cartel y el amuleto *Iron Clock* te protege (también del drenaje del vampiro y de la fase 2 del Liche).

---

## 6. Meta-progresión (Tienda permanente)
Al terminar una run (ganada, perdida o abandonada) se ganan **Coronas**:

`Coronas = 5 (por jugar) + 5 × batallas ganadas + 2 × otros nodos superados + 40 (si se vence al jefe) + ⌊monedas sobrantes / 10⌋`

Objetivo de diseño: **después de la primera run ya se puede comprar algo** (una run corta da ~15–25 Coronas y las primeras mejoras cuestan 15–25). La pantalla de fin de run avisa cuando te alcanza para una mejora.

| Mejora | Niveles | Costo (Coronas) | Efecto |
|---|---|---|---|
| Extra Life | 3 | 20 / 60 / 140 | +1 **Reintento** por nivel (reinicia la batalla perdida con los mismos objetos) |
| Veteran Pawns | 3 | 15 / 40 / 80 | +1 peón inicial por nivel |
| Knight / Bishop Recruit | 1 c/u | 60 | Empezar con un caballo / alfil |
| Rook Recruit | 1 | 150 | Empezar con una torre |
| Deeper Satchel | 2 | 30 / 90 | +1 espacio de poción |
| Time Bank | 3 | 15 / 45 / 110 | +5 s en tu reloj por nivel |
| Coin Purse | 3 | 20 / 50 / 110 | +10% monedas por nivel |
| Alchemist Kit | 1 | 25 | Empezar con Hourglass + Rewind |

### Amuletos permanentes (colección)
En la sección **Amuletos** de la tienda permanente se compra cada amuleto **una sola vez** y desde ahí empezás todas las runs con él. Con la colección completa arrancás con todo. Un amuleto que ya tenés no vuelve a aparecer en tiendas ni premios de la run. El menú muestra el avance de la colección (mejoras al máximo + amuletos).

| Amuleto | Costo (Coronas) |
|---|---|
| Iron Clock | 40 |
| Pocket Watch | 50 |
| Tempo Charm | 60 |
| Deep Pockets | 70 |
| Lucky Coin | 80 |
| Veteran Eye | 90 |
| Phoenix Feather (+1 Reintento al empezar) | 120 |

El progreso se guarda en `localStorage` (clave `checkmate_survivors_v1`).

### Guardar y continuar la run
La run en curso se guarda automáticamente entre nodos (clave `checkmate_survivors_run_v1`) y el menú ofrece **Continuar run**. Se guardan el mapa, el stock de la tienda y los premios ofrecidos, así que recargar no los vuelve a sortear. **Salir en medio de una batalla cuenta como perderla**: se gasta un Reintento y la batalla se reinicia; sin Reintentos, la run termina. Los eventos ya resueltos no se pueden repetir.

---

## 7. Rivales y personalidades de la IA
La IA (`js/ai.js`) es **programada a mano**: búsqueda negamax con poda alfa-beta, profundización iterativa, búsqueda de quietud (6 plies), tabla de transposición, heurísticas killer/history, reducciones de jugadas tardías y extensión por jaque. La **evaluación** combina material, tablas de casillas, peones pasados, ataque al rey, escudo de peones, avance de peones y "mop-up" (arrinconar al rey solo). Cada personalidad es un set de pesos:

| Estilo | Comportamiento |
|---|---|
| Balanced | Equilibrado (se usa también para las pistas del jugador) |
| Aggressive | Prioriza atacar al rey y avanzar peones; descuida su seguridad |
| Defensive | Protege al rey y la estructura; poco ataque |
| Greedy | Sobrevalora el material, ignora la posición |
| Positional | Pondera mucho las casillas y los peones pasados |
| Rookie | Evaluación pobre y muchos errores |

Los rivales son **monstruos**. Cada uno juega con **sus propias piezas** (`FACTIONS` en `sprites.js`): la silueta de ajedrez se mantiene siempre legible, pero se recolorea y lleva ojos y detalles del monstruo (patas de araña, alas de murciélago, orejas de goblin, cola de fantasma, caldero de bruja, costillas, serpientes...). Tus piezas siguen siendo marfil.

| Rival | Estilo | Tier | Nota | Sus piezas |
|---|---|---|---|---|
| Gloop the Slime / Gloop el Slime | Rookie | Fácil | | verdes, gotean |
| Grabby the Goblin / Grabby el Goblin | Greedy | Fácil | | verde oliva con orejas puntiagudas |
| Boo the Ghost / Buu el Fantasma | Defensive | Fácil | | lavanda, base ondulada |
| Widow Weaver / La Viuda Tejedora | Aggressive | Normal | | violeta oscuro, patas y marca roja |
| Sir Bones / Sir Huesos | Defensive | Normal | | gris hueso con costillas |
| Hexa the Witch / Hexa la Bruja | Positional | Normal | | violeta, ojos verdes, caldero (el peón y la torre llevan sombrero) |
| Fang the Werewolf / Colmillo el Lobizón | Aggressive | Difícil | Roba tiempo (1) | marrón con orejas y pelaje |
| Medusa | Positional | Difícil | | verde agua con serpientes |
| Count Vlastor / Conde Vlastor | Balanced | Difícil | Roba tiempo (1) | bordó con alas de murciélago |
| **The Hourglass Lich / El Liche del Reloj** | Balanced | Jefe | Roba tiempo (2) + reloj de arena | azul acero, ojos y brillo cian |
| The Shade / La Sombra (puzzles) | — | — | | gris violáceo |

### Retratos y reacciones de los rivales
Cada rival tiene un **retrato pixel art animado** (`js/portraits.js`, 32×32 generado por código) junto al tablero:
- **Idle según estilo**: Rookie se inquieta, Greedy se balancea, Defensive respira lento, Aggressive rebota, Positional/Balanced se mecen; el jefe flota con un aura violeta. Parpadea cada pocos segundos.
- **Barra de vida = material enemigo** (P=1, C/A=3, T=5, D=9). Al comerle una pieza: cara de dolor, sacudida con destello rojo, número de daño flotante con la pieza capturada (dorado y más grande si vale 5+), y la barra baja con una "estela" blanca.
- Al darle **jaque** se sobresalta; cuando **te come** una pieza o te da jaque, festeja con un salto; cuando te roba tiempo, también.
- Mientras piensa muestra puntos animados. Al final: **KO** (gris, cae de costado) si pierde, o festeja en loop si gana.
- **Frases propias** (EN/ES) para 8 momentos: presentación, recibir daño, capturar, ganar, perder, **perder la dama**, **cuando coronás** y **cuando le das jaque** (`say.<id>.<momento>` en `i18n.js`, variantes separadas por `|`).
- El retrato aparece también en el título, en el mapa, en el detalle del nodo y en la tarjeta de presentación de la partida.

### Animaciones en el tablero
- **Captura**: explosión de partículas con los colores de la pieza comida (de la facción si es enemiga), la pieza sale volando girando y se desvanece, onda expansiva, temblor del tablero (más fuerte si la pieza vale 5+) y texto flotante (+N dorado si comés, −N rojo si te comen).
- **Jaque**: onda roja sobre el rey. **Enroque**: la torre también se desliza y aparece "¡ENROQUE!". **Coronación**: explosión dorada y "¡CORONACIÓN!".
- **Jaque mate**: el rey derrotado cae de costado con una explosión grande. Las piezas en movimiento hacen un pequeño salto.

Recompensas más generosas desde v0.6 (antes `12 + paso×3`): un puzzle fácil del paso 1 da 20 monedas, un duelo normal en reloj rápido del paso 3 da 42.

### Puzzles incluidos (15)
**Fáciles:** Queen Kiss, Edge Mate y Arabian Mate (mate en 1), Rook Roller (mate en 2), Royal Fork (horquilla de caballo para comer la dama), Smothered King, Back Rank y Knight Fork
 **Normales:** Rook Ladder, Queen Hunt, Hold the Line, Rook Technique · **Difíciles:** Deep Mate Queen, Deep Mate Rook, Last Wall.

Como los primeros pasos son mayormente puzzles, hay 8 fáciles para que no se repitan en una run. Se agregan en `js/data.js` (`SCENARIOS`) con su FEN; `tests/scenarios.js` valida que el mate/objetivo exista.

---

## 8. Arte, sonido e idiomas
- **Pixel art generado por código** (`js/sprites.js`): siluetas 16×16 → sombreado automático → contorno. Tus piezas marfil; las del rival en el tema de su monstruo (facciones), íconos de nodos, pociones y amuletos. No hay archivos de imagen.
- **Siluetas bien distintas (v0.4)**: cada tipo se reconoce por forma y tamaño, aunque todas tengan el mismo color.
  - **Peón:** la pieza más chica, cabeza redonda.
  - **Caballo:** cabeza de caballo.
  - **Alfil:** alto y finito, con bolita dorada y un corte diagonal bien marcado.
  - **Torre:** almenas.
  - **Dama:** corona de puntas con joya y cinturón dorados.
  - **Rey:** la pieza más alta, con una cruz dorada grande y cinturón dorado.

  Los adornos de facción (patas, capa, caldero, costillas...) van en la mitad inferior o en la base, para no tapar la parte que identifica a la pieza.
- **Retratos de rivales** (`js/portraits.js`): monstruos 32×32 (cuerpo propio o cabeza compartida + rasgos), 6 expresiones (normal, parpadeo, pensando, contento, dolor, KO).
- **Tarjetas** (premios, tienda, tienda permanente): franja y etiqueta de color según tipo (pieza, poción, amuleto, monedas, mejora), ícono sobre un halo y efecto al pasar el mouse.
- **Sonido**: efectos sintetizados con WebAudio (sin archivos): golpe al comer, "muerte" con ruido y caída de tono para piezas de 5+ y el mate, quejido cuando te comen, enroque, fanfarria de coronación, jaque.
- **Música** chiptune procedural (secuenciador propio en `ui.js`, sin archivos): tema del **menú** (La menor, tranquilo y misterioso), temas de batalla **según el reloj**, para que la música no apure en partidas largas:

| Reloj | Tema | Tempo |
|---|---|---|
| Rápida (y puzzles) | **calm**: Mi menor, triángulo suave, sin batería | 80 bpm |
| Blitz | **battle**: Re menor con batería | 108 bpm |
| Bullet | **rush**: el mismo tema, apurado | 132 bpm |
| Jefe | **boss**: frigio, bombo en negras | 148 bpm (172 en la fase 2) |
 Al abrir el juego aparece una pantalla **"Hacé clic para empezar"**: los navegadores no reproducen audio sin un gesto del usuario, y ese clic habilita la música, que ya suena en el menú principal. Botones *Sonido* y *Música* en el menú.
- **Idiomas**: inglés (por defecto) y español. **Todo el texto** vive en `js/i18n.js`; `tests/i18n.js` verifica que cada clave exista en ambos idiomas. Para agregar un idioma: copiar el bloque `DICT.es`, traducir y sumar el botón del menú.

---

## 9. Arquitectura técnica
Sin dependencias ni build: se abre `index.html` con doble clic. (Se decidió **no usar Phaser** en el prototipo: Canvas 2D + DOM alcanzan y el juego pesa ~140 KB (44 KB comprimido). Se puede migrar más adelante si hace falta.)

```
checkmate-survivors/
├─ index.html            carga los scripts en orden
├─ css/style.css         tema oscuro pixel
├─ js/
│  ├─ chess.js           motor de reglas (make/unmake, perft, SAN, tablas)
│  ├─ ai.js              IA propia (búsqueda + evaluación + personalidades)
│  ├─ sprites.js         pixel art por código
│  ├─ portraits.js       retratos de rivales (6 expresiones)
│  ├─ data.js            pociones, amuletos, rivales, escenarios, mejoras
│  ├─ i18n.js            textos EN/ES
│  ├─ ui.js              helpers de DOM, toasts, sonido, localStorage
│  ├─ match.js           la partida: tablero, reloj, objetivos, pociones
│  ├─ run.js             la run: mapa, recompensas, tienda, eventos, meta
│  └─ main.js            arranque
├─ tests/                perft, ai, scenarios, i18n, smoke, balance
├─ docs/GAME_DESIGN.md   este documento
├─ dist/                 .zip listo para itch.io
├─ marketing/            portada, capturas y textos para la página de itch.io
├─ AGENTS.md             guía para agentes de IA que trabajen en el código
└─ package-itch.ps1      genera el .zip en Windows
```

### Tests (`node tests/<archivo>.js`)
| Test | Qué valida |
|---|---|
| `perft.js` | El generador de jugadas contra conteos de nodos de referencia |
| `ai.js` | La IA encuentra mates, no se cuelga piezas, convierte KQ vs K, no altera la posición |
| `scenarios.js` | Los 10 puzzles son legales y resolubles (solver exhaustivo) |
| `i18n.js` | Cada texto existe en inglés y español, con los mismos `{placeholders}` |
| `smoke.js` | Juega una run completa en un DOM simulado: mapa, partida real por UI, pociones, rewind, reintento, todos los tipos de nodo, tienda permanente, cambio de idioma y guardar/continuar |
| `balance.js` | Simula un jugador proxy contra cada tier para calibrar dificultad |

---

## 10. Publicar en itch.io
Todo el material está en **`marketing/`**:
- `marketing/ITCH_PAGE.md`: qué poner en cada campo del formulario de itch.io (título, tagline, tags, viewport, orden de capturas), la descripción en inglés y en español, y un texto para el devlog de lanzamiento.
- `marketing/cover.png`: portada de 630×500.
- `marketing/screenshots/`: capturas de 1280×720 tomadas del juego real (título, mapa, captura de dama contra la araña, jefe, coronación contra la bruja, tienda y mejoras).

Pasos:
1. Ejecutar `package-itch.ps1` (o usar `dist/checkmate-survivors-html5.zip`, ya generado). El zip contiene `index.html` en la raíz + `css/` + `js/` (no incluye `marketing/` ni `docs/`).
2. En itch.io: *Create new project* → *Kind of project*: **HTML**.
3. Subir el zip y marcar **"This file will be played in the browser"**.
4. *Embed options*: viewport **1280 × 760**, botón de pantalla completa, "Automatically start on page load" (el juego tiene su propia pantalla de "clic para empezar").

**Resolución**: el juego está pensado para unos 1200×740. En ventanas más chicas (por ejemplo el embed de itch.io sin pantalla completa) `UI.fit` **achica todo con zoom** (hasta 50%) en vez de cortarlo, y el diseño de una columna queda solo para teléfonos (<640 px). Hay un botón **Pantalla completa** en el menú y en el encabezado de la run.
5. Opcional: `butler push dist/checkmate-survivors-html5.zip usuario/checkmate-survivors:html5` para actualizar rápido.

Para regenerar las capturas: abrir copias guionadas de `index.html` en Edge headless (ver `AGENTS.md`).

---

## 11. Estado (v0.6.0 · Early Alpha) y hoja de ruta

**Hecho:** motor completo, IA con 6 estilos, mapa ramificado, 4 tipos de objetivo, relojes, 6 pociones, 7 reliquias, 5 eventos, tienda, fogata, jefe, 10 puzzles, tienda permanente, guardado, EN/ES, sonido.
**v0.2:** retratos animados de rivales con barra de vida, daño, reacciones y frases; nueva dama; tarjetas rediseñadas; guardar/continuar run.
**v0.3.0:** rivales monstruo con piezas temáticas por facción; inicio de calentamiento con objetivos *coronar* y *capturar N*; mapa rediseñado; panel "tu lado del tablero"; música y sonidos de golpe/muerte; animaciones de captura, jaque, enroque, coronación y mate; frases para dama perdida, coronación y jaque; versión en el menú.
**v0.4.0:** dificultad bastante más baja (IA menos profunda, ejércitos enemigos más chicos, más tiempo, 5 peones y 1 Reintento al empezar, calentamiento de 3 pasos); tienda permanente más barata y más Coronas por run; siluetas de piezas rediseñadas; pantalla "clic para empezar" para que suene la música del menú; kit de itch.io (`marketing/`); `AGENTS.md`.
**v0.5.0** (después de publicar en itch.io): música según el reloj (rápida = tema tranquilo); **rasgos de monstruo** implementados; **amuletos permanentes** en la tienda permanente (las "reliquias" pasan a llamarse amuletos); tienda con botones de precio nuevos, **renovar stock** (1ª gratis) y sonido de compra; ajuste a ventanas chicas + botón de pantalla completa; presentación de la batalla con el objetivo destacado en dorado, el reloj en celeste y el rasgo del rival; un poco más fácil (más errores de la IA, Ojo del Oráculo gratis al empezar).
**v0.6.0:** los primeros pasos son **mayormente puzzles** (5 puzzles fáciles nuevos, 15 en total); **más monedas** por victoria; **renovar premios**; nuevo modo **Mate Rush** (sección 17).

**Pendiente / ideas (por prioridad):**
1. **Balance con partidas humanas**: el autor sigue sintiéndolo difícil. Registrar en `meta.stats` en qué paso termina cada run y contra quién, para ajustar con datos (sección 12).
2. Pieza "estrella" por monstruo con efecto visual (la dama araña deja telaraña) y temas musicales por monstruo.
3. **Actos 2 y 3** (sección 14).
4. Eventos con monstruos y más puzzles (mate en 3–4, finales de peones, tácticas).
5. Desafío diario con semilla fija, logros y estadísticas (sección 15).
6. Opciones: reducir animaciones, piezas enemigas "clásicas", tamaño de tablero (sección 16).
7. Pulido móvil (tablero táctil, layouts verticales).
8. Mejoras de IA: libro de aperturas corto, mejor manejo de finales de peones.

**Preguntas abiertas para el autor**
- ¿El triple empate/50 jugadas debe contar como derrota o dar un premio de consuelo?
- ¿Querés que el jugador pueda jugar con negras en algunos duelos?
- ¿Cuántos actos y qué duración objetivo de run (hoy ~25–30 min)?
- ¿Monetización/estilo de publicación (gratis con donaciones en itch.io, premium)?

---

## 12. Curva de dificultad (v0.4)
El autor reportó dos veces que el comienzo era difícil. Diagnóstico: con 4 peones y sin piezas, ganar **por mate** contra el reloj exige coronar y después dar mate, algo muy exigente para alguien que no juega ajedrez seguido. Medidas:
- **Objetivos de calentamiento** (coronar / capturar N) en los primeros pasos: se ganan sin necesidad de dar mate.
- **Rivales débiles al principio**: profundidad 1 y muchos errores. A partir del paso 4 aparecen los normales con frecuencia.
- **Más margen**: 5 peones, 1 Reintento gratis y relojes más largos con incremento.
- **Progresión desde la primera run**: mejoras de 15–25 Coronas y unas 15–25 Coronas por run corta.

Simulación (`tests/balance.js`, jugador proxy de profundidad 2, ejército inicial de 5 peones, 8 partidas por fila):

| Rival | Victorias / tablas / derrotas |
|---|---|
| Fácil | 8 / 0 / 0 |
| Normal | 7 / 1 / 0 |
| Difícil | 0 / 2 / 6 |
| Jefe | 0 / 0 / 8 |

Los difíciles y el jefe se enfrentan más tarde, con un ejército más grande; con 5 peones solos se espera perder. **Próximo paso:** registrar en partidas reales en qué paso termina cada run (se puede guardar en `meta.stats`) y ajustar con datos.

## 13. Rasgos de monstruo (implementado en v0.5)
Cada monstruo suma **un rasgo** que no cambia las reglas del ajedrez. Actúa sobre el reloj, los objetos o la economía de la run, se muestra en el detalle del nodo y tiene su propia animación en el retrato.

| Monstruo | Rasgo | Efecto |
|---|---|---|
| Gloop el Slime | *Novato* | Ninguno: es el rival de aprendizaje. |
| Grabby el Goblin | *Carterista* | Te roba 2 monedas cada vez que te come una pieza. |
| Buu el Fantasma | *Escurridizo* | Su reloj no corre en sus 3 primeras jugadas. |
| La Viuda Tejedora | *Telaraña* | Mover una de tus piezas que ella ataca te cuesta 1 s (aparece "-1s" violeta). |
| Sir Huesos | *Muralla de huesos* | Empieza con un peón extra (sin pasar de 8). |
| Hexa la Bruja | *Maleficio* | Al empezar hechiza una de tus pociones: no la podés usar en esa batalla (no se pierde). |
| Colmillo el Lobizón | *Luna llena* | Con menos de la mitad de vida aúlla y gana 10 s (una vez). |
| Medusa | *Mirada pétrea* | En su 6ª jugada, tu reloj corre al doble durante tu siguiente jugada. |
| Conde Vlastor | *Drenaje* | Cada vez que te come una pieza te drena 2 s para él (Iron Clock lo bloquea). |
| El Liche del Reloj | *Segunda fase* | Al perder la dama: aura roja, música más rápida y te roba 8 s (Iron Clock lo bloquea). |

El rasgo se ve en el detalle del nodo, debajo del nombre del rival (★) y en la tarjeta de presentación de la batalla. Se implementan en `match.js` (`this.trait`), salvo el del esqueleto (`startDuel` en `run.js`) y el robo de monedas, que la run aplica con `cfg.onSteal`.

## 14. Actos 2 y 3 (propuesta)
- **Acto 1, El Bosque Embrujado** (actual): slime, goblin, fantasma, araña, esqueleto, bruja, lobizón, medusa, vampiro. Jefe: el Liche del Reloj.
- **Acto 2, Las Catacumbas**: momia (defensiva, venda tus piezas: efecto visual), gólem de piedra (lento, posicional; su reloj tiene +30 s pero sin incremento), banshee (grita: −3 s a tu reloj en cada jaque que te da), murciélago gigante, rata reina. Jefe: **el Nigromante**, que juega con el ejército de los jefes anteriores (otra paleta).
- **Acto 3, El Castillo**: gárgola, dragón joven, caballero sin cabeza (solo caballos y torres: composición de ejército temática), súcubo, kraken del foso. Jefe final: **el Rey Sombra**, que empieza con el ejército completo; vos llegás con lo que juntaste.
- Cada acto suma un paso al mapa y su propia paleta de fondo y tema musical. Entre actos, una **fogata grande**: curar 1 Reintento + elegir un amuleto de 3.
- **Composición temática de ejércitos** (sin salir del máximo estándar): algunos monstruos prefieren ciertas piezas. El caballero sin cabeza tiene caballos, el gólem torres y la bruja alfiles.

## 15. Desafío diario, logros y estadísticas
- **Desafío diario**: semilla fija por fecha (mapa, rivales y premios iguales para todos). Un intento por día y un puntaje = nodos × 10 + victorias × 25 + tiempo restante promedio. Tabla local de los últimos 7 días.
- **Logros** (locales, se muestran en el menú): "Primera sangre" (primera captura), "Coronación" (coronar un peón), "Sin pociones" (ganar una run sin usarlas), "Bullet master" (ganar 3 batallas bullet en una run), "Cazador de monstruos" (vencer a los 10), "El tiempo es mío" (robarle 30 s al rival en una partida).
- **Estadísticas**: paso donde termina cada run, rival que más te venció, piezas comidas por tipo. Además sirven para balancear (sección 12).

## 16. Opciones y accesibilidad (propuesta)
- **Reducir animaciones**: sin temblor de tablero ni destellos; partículas mínimas.
- **Piezas enemigas clásicas**: usar el set carmesí en vez de las facciones, para quien prefiera claridad total.
- **Volumen** separado de música y efectos (hoy son interruptores).
- **Tamaño de tablero / modo vertical** para pantallas chicas.
- **Coordenadas siempre visibles** y opción de mostrar la última jugada con flecha.

## 17. Modos de juego
### Run (modo principal)
El roguelite completo: mapa, monstruos, tienda, eventos y jefe. Unos 25–30 minutos.

### Mate Rush (modo rápido, v0.6)
Para una partida corta o para practicar. Se elige en el menú principal.
- **3 minutos** en total. En el tablero aparece un **mate en 1** y hay que encontrarlo.
- **Acierto**: +1 punto y el siguiente puzzle. **Error** (cualquier jugada que no sea mate): **−10 s** y el siguiente puzzle. *Terminar* corta la partida.
- **Puzzles generados al azar** (`js/rush.js`) y verificados por el motor: posición legal, nadie en jaque y al menos un mate en 1. No se repiten y no hace falta cargarlos a mano.
- **Dificultad creciente** según los puntos:
  - Los sets de ataque pasan de dama sola o dos torres a combinaciones de 3–4 piezas.
  - Aparecen más defensores (piezas que distraen).
  - Desde 6 puntos se exige una **única** jugada de mate (antes se aceptan hasta 3 soluciones).
- **Premio**: 1 Corona por mate y +5 si es récord personal (`meta.stats.rushBest`). Así el modo rápido también alimenta la tienda permanente.
- Música *rush*, reloj propio arriba (el de la partida se oculta) y el host es La Sombra.

### Ideas para más modos
- **Boss Rush**: los 3 jefes seguidos con un solo reloj compartido y tus mejoras permanentes; sin mapa.
- **Desafío diario** (sección 15): una run con semilla fija por día.
- **Mate Rush en 2**: la misma idea con mates en 2, para jugadores avanzados (el generador ya existe; hace falta una verificación más costosa, conviene precalcular en un worker).
- **Supervivencia**: duelos seguidos contra monstruos cada vez más fuertes, sin tienda; puntaje = victorias.

