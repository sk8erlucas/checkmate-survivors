# Checkmate Survivors — Documento de diseño

> Roguelite 2D de **ajedrez real** en pixel art. HTML5 + JavaScript puro, pensado para subirse a **itch.io**.
> Idioma por defecto: **inglés** (selector de **español** en el menú). Última actualización: 17/11/2026 (**v0.14.0 · Early Alpha**, se muestra en el menú principal; la constante es `D.VERSION` en `data.js`).
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
| 3 | Duelo, Puzzle, Evento, Tienda o Fogata (3 nodos), con **un Mate Rush garantizado** |
| 4 | **Tienda y Fogata garantizadas** + 1 duelo |
| 5 | Mixto, con **una Arena garantizada** |
| 6 | Mixto (2 nodos) |
| 7 | **Fogata y Tienda** (descanso antes del jefe) |
| Jefe | **The Hourglass Lich / El Liche del Reloj** (ladrón de tiempo) |

Cada nodo se conecta con 1–2 del paso siguiente (estilo *Slay the Spire*, en horizontal).

**Sin repeticiones (v0.9):** a lo largo de un camino nunca hay dos nodos seguidos del mismo tipo no combativo (tienda→tienda, fogata→fogata, evento→evento, Mate Rush, Arena o élite): se cambia el que no está fijado por las reglas del paso. Tampoco se repite el **mismo monstruo** en nodos conectados, y los rivales se reparten priorizando los menos usados en la run. La generación va en cuatro fases: tipos, conexiones, corrección de repeticiones y detalles. Antes de entrar se muestra un detalle con rival, estilo, dificultad, objetivo, reloj y recompensa estimada.

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
- **Mate Rush** (bonus): 60 s de mates en 1 seguidos; cada mate da monedas (sección 17).
- **Élite** (pasos 5–6, opcional): un monstruo difícil con su rasgo; paga ×1.3 monedas y el premio siempre incluye un amuleto (si quedan). Se marca con una etiqueta roja "Élite".
- **Arena**: 3 duelos cortos seguidos; cada victoria paga en el momento, podés retirarte entre rondas y perder solo termina la Arena (sección 17).
- **Evento**: decisiones con riesgo (El Apostador, El Viejo Relojero, El Ermitaño, El Pozo Extraño, El Prestamista) y **encuentros con monstruos** (v0.10.1, con el retrato del monstruo): *El caldero de Hexa* (15 monedas por 2 pociones, o un peón por +1 Reintento), *El espejo embrujado* (50%: copia una poción / 50%: −10 monedas) y *El gólem dormido* (arrancar la gema: 60% +50 monedas, si no −1 Reintento o −15 monedas; pasar despacio: +5).
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
| Jefe | 3 | 15% / 10% / 5% | según el acto (abajo) | 4.0 | violeta |

**Jefes por acto (v0.13, `D.BOSS_ACT`):** el autor encontró al Liche "muy difícil aun con todas las piezas". La simulación lo confirmó: con profundidad 4 y 1,1 × + 2 el jugador proxy (profundidad 2) perdía 6 de 6 incluso con el ejército completo. Ahora los tres jefes usan profundidad 3 y suben por acto:

| Jefe | Errores | Presupuesto | Reloj |
|---|---|---|---|
| Liche (Acto 1) | 15% | 0.80 × | rápido (2:30 +3) |
| Nigromante (Acto 2) | 10% | 0.90 × | rápido |
| Rey Sombra (Acto 3) | 5% | 1.00 × + 1 | blitz |

Con esos valores el proxy le gana al Liche 14 de 18 partidas (ejércitos de 17, 27 y 39 puntos). El Liche además roba tiempo 1 vez en lugar de 2.

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
| Oracle Eye (Pista) | Pista completa: flecha dorada, casillas de origen y destino marcadas y un cartel con la jugada ("Caballo a f3 (Cf3)"). Tu reloj se pausa mientras "piensa" | 25 |
| Watchtower (Atalaya) | Marca tus piezas atacadas (rojo) y las enemigas que atacás (verde) | 20 |
| Hourglass | +15 s en tu reloj | 20 |
| Time Thief | Robás 10 s al rival | 35 |
| Frozen Time | El reloj rival no corre durante su próxima jugada | 30 |
| Foresight (Premonición, v0.14) | Muestra con una flecha roja qué jugaría el monstruo si fuera su turno (su amenaza). No se puede usar en jaque | 20 |
| Haste Elixir (Elixir veloz, v0.14) | +3 s de incremento por jugada el resto de la batalla | 25 |
| Gold Potion (Poción de oro, v0.14) | Si ganás la batalla, ×1,5 monedas (una por batalla) | 25 |
| Banishment (Destierro, v0.14) | Elegís un peón enemigo y desaparece. Solo peones, y nunca uno que deje al rey rival en jaque. No es una jugada (sigue siendo tu turno); el Deshacer no puede volver antes de él | 60 |

El autor pidió "una poción que mate una pieza enemiga, pero no tanto": el Destierro se limita a peones, es la poción más cara y la más rara (peso 1). Las reglas del ajedrez no cambian: es como dar ventaja de un peón, algo que existe en el ajedrez real.

Los espacios de poción son limitados (3 base). **Las pociones iguales se apilan en un mismo espacio sin límite práctico** (`D.STACK = 99`, v0.14; en v0.13 el tope era 3–5). El autor quiere que una run con mucha plata se vuelva muy fácil, por eso en la tienda **las pociones no se agotan**: se pueden comprar las veces que quieras. Cada pila muestra abajo a la derecha cuántas quedan (en el encabezado, en "tu lado del tablero" y en la batalla). Si no entra en ninguna pila ni en un espacio libre, la poción se vende por la mitad de su precio. `run.potions` sigue siendo una lista plana de ids, así que las runs guardadas viejas cargan igual. El maleficio de Hexa bloquea **una** copia: con una pila podés tomar las demás.

### Amuletos (pasivos durante toda la run, 70 monedas en tienda)
En el juego se llaman **amuletos** (en el código siguen siendo `relic`/`RELICS`).
Pocket Watch (+10 s por batalla) · Lucky Coin (+25% monedas) · Deep Pockets (+1 espacio de poción) · Veteran Eye (1 pista gratis por batalla) · Tempo Charm (+1 s de incremento) · Iron Clock (inmune al robo de tiempo) · Phoenix Feather (+1 Reintento).
**Nuevos en v0.14:** Merchant's Ring / Anillo del mercader (precios de la tienda −20%) · Alchemist's Flask / Frasco del alquimista (35% de chance de una poción al azar después de cada batalla ganada) · Hunter Fang / Colmillo de cazador (+2 s cada vez que capturás) · Watch Lantern / Farol del vigía (la Atalaya queda siempre encendida). Los cuatro también están en la tienda permanente (70 / 100 / 80 / 110 Coronas).

### Piezas veteranas (v0.14)
- Cada pieza del ejército tiene **nombre** ("Peón Bruno", "Kiki the Knight"). `run.roster` guarda `{ name, b }` por pieza, en el mismo orden que `run.army` y que las casillas de salida (`armySlots`). Las runs viejas reciben un plantel nuevo al cargarse.
- Una pieza que **sobrevive a una batalla ganada** (duelo, élite o jefe) suma una batalla. Match sigue a cada pieza casilla por casilla (`cfg.ids`, también con enroque, coronación y Deshacer).
- **Medallas**: bronce a las 3 batallas, plata a las 6, oro a las 10 (punto de color en la esquina de la casilla, en el tablero y en "tu lado del tablero"). Cada medalla paga **1/2/3 monedas** por batalla ganada en la que esa pieza sobrevive.
- No cambia cómo se mueve ninguna pieza. Si cae una pieza con medalla aparece "¡Cayó Peón Bruno!" (vuelve en la próxima batalla, pero esa no le cuenta). Si deja el ejército para siempre (eventos), se va la menos veterana y, si tenía medalla, aparece un cartel de despedida.
- Pasando el mouse por una pieza propia en la batalla se ve su nombre y sus batallas. El resumen de la run muestra al **veterano estrella**.

### Piezas (tienda)
Peón 20 · Caballo 45 · Alfil 45 · Torre 70 · Dama 130 (máximos: 8 / 2 / 2 / 2 / 1).

### Rival con objetos
Algunos rivales pueden **robarte 8 s** (Colmillo el Lobizón, Conde Vlastor y el Liche del Reloj: 1 uso, y el Liche además un reloj de arena). Se avisa con un cartel y el amuleto *Iron Clock* te protege (también del drenaje del vampiro y de la fase 2 del Liche).

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
| **The Hourglass Lich / El Liche del Reloj** | Balanced | Jefe | Roba tiempo (1) + reloj de arena | azul acero, ojos y brillo cian |
| The Shade / La Sombra (puzzles) | — | — | | gris violáceo |

Los monstruos de los Actos 2 y 3 están en la sección 14. **Tus piezas son siempre de marfil**, también cuando jugás con negras (sección 19): el color de dibujo depende de quién es la pieza, no del bando.

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
4. *Embed options*: viewport **1280 × 720**, botón de pantalla completa, "Automatically start on page load" (el juego tiene su propia pantalla de "clic para empezar").

**Resolución**: fija de 1280×720, escalada a la ventana, con scroll interno (ver sección 18). Hay un botón **Pantalla completa** en el menú y en el encabezado de la run.
5. Opcional: `butler push dist/checkmate-survivors-html5.zip usuario/checkmate-survivors:html5` para actualizar rápido.

Para regenerar las capturas: abrir copias guionadas de `index.html` en Edge headless (ver `AGENTS.md`).

---

## 11. Estado (v0.10.1 · Early Alpha) y hoja de ruta

**Hecho (resumen a v0.12):** motor completo, IA con 6 estilos, **3 actos** con 20 monstruos y 3 jefes, mapa ramificado con 9 tipos de nodo, 6 tipos de objetivo, relojes, 10 pociones, 11 amuletos, piezas veteranas, 8 eventos (3 con monstruos), 15 puzzles, Mate Rush (mates en 1 y en 2), Arena, Élite, tienda permanente con amuletos de colección, 21 logros, run del día, bestiario, repaso de partida, duelos con negras, guardado, EN/ES, sonido y música sintetizados con volumen.
**v0.2:** retratos animados de rivales con barra de vida, daño, reacciones y frases; nueva dama; tarjetas rediseñadas; guardar/continuar run.
**v0.3.0:** rivales monstruo con piezas temáticas por facción; inicio de calentamiento con objetivos *coronar* y *capturar N*; mapa rediseñado; panel "tu lado del tablero"; música y sonidos de golpe/muerte; animaciones de captura, jaque, enroque, coronación y mate; frases para dama perdida, coronación y jaque; versión en el menú.
**v0.4.0:** dificultad bastante más baja (IA menos profunda, ejércitos enemigos más chicos, más tiempo, 5 peones y 1 Reintento al empezar, calentamiento de 3 pasos); tienda permanente más barata y más Coronas por run; siluetas de piezas rediseñadas; pantalla "clic para empezar" para que suene la música del menú; kit de itch.io (`marketing/`); `AGENTS.md`.
**v0.5.0** (después de publicar en itch.io): música según el reloj (rápida = tema tranquilo); **rasgos de monstruo** implementados; **amuletos permanentes** en la tienda permanente (las "reliquias" pasan a llamarse amuletos); tienda con botones de precio nuevos, **renovar stock** (1ª gratis) y sonido de compra; ajuste a ventanas chicas + botón de pantalla completa; presentación de la batalla con el objetivo destacado en dorado, el reloj en celeste y el rasgo del rival; un poco más fácil (más errores de la IA, Ojo del Oráculo gratis al empezar).
**v0.6.0:** los primeros pasos son **mayormente puzzles** (5 puzzles fáciles nuevos, 15 en total); **más monedas** por victoria; **renovar premios**; nuevo modo **Mate Rush** (sección 17).
**v0.7.0:** Mate Rush deja de ser un modo aparte y pasa a ser un **nodo bonus del mapa** (60 s, monedas por mate, uno garantizado en el paso 3). Las demás ideas de modos se replantean como nodos de la run (sección 17).
**v0.8.0:** **resolución fija de 1280×720** escalada a la ventana, con scroll interno (arregla tiendas y pantallas largas que no se podían recorrer, sección 18); nodo **Arena**; **historial de runs** (paso alcanzado y quién te venció) para balancear, con la última run en el menú.
**v0.9.0:** **16 logros** (pagan Coronas); **Run del día** con mapa fijo por fecha; nodo **Élite**; pantalla de **Opciones** (sonido, música, menos animaciones, piezas enemigas clásicas); el mapa ya no repite nodos no combativos ni monstruos en caminos conectados.
**v0.10.0:** **Acto 2, Las Catacumbas** (sección 14): 4 monstruos nuevos y el jefe **Nigromante**, gran fogata entre actos y la opción de retirarse victorioso o seguir.
**v0.10.1:** 3 eventos con monstruos (caldero de Hexa, espejo embrujado, gólem dormido).
**v0.11.0:** **repaso después de cada batalla** (encuentra tu peor jugada y te muestra una mejor en el tablero), **duelos con negras** de vez en cuando (+15% monedas), **bestiario** con tu récord contra cada monstruo y **volumen** con deslizadores (sección 19).
**v0.14.0:** **piezas veteranas** con nombre y medallas que pagan monedas, **4 pociones nuevas** (Premonición, Elixir veloz, Poción de oro y Destierro), **4 amuletos nuevos** (Anillo del mercader, Frasco del alquimista, Colmillo de cazador y Farol del vigía), pociones apilables **sin límite** y que no se agotan en la tienda, y el **Ojo del oráculo da la jugada completa**.
**v0.13.0:** **jefes más amables según el acto** (sección 4: el Liche baja mucho), **pociones apilables** con contador (sección 5) y **resumen al terminar la run** (mejor victoria, mate más rápido, pieza más valiosa, pociones tomadas y quién te venció).
**v0.12.0:** **Acto 3, El Castillo** (sección 14): 4 monstruos nuevos y el jefe final **Rey Sombra**, Mate Rush con **mates en 2**, música propia para las Catacumbas y el Castillo, 3 logros nuevos.

**Pendiente / ideas (por prioridad):**
1. **Niveles de desafío después de ganar** (tipo "Ascensión"): opcionales, se desbloquean al vencer al Rey Sombra. Cada nivel suma una dificultad (menos tiempo, rivales con más piezas, tienda más cara) a cambio de más Coronas. El comienzo de la run sin desafío no cambia.
2. **Pieza "estrella" por monstruo** con efecto visual (la dama araña deja telaraña) y tema musical por monstruo.
3. Más eventos con monstruos (hay 3, ninguno del Castillo todavía) y más puzzles (mate en 3–4, finales de peones, tácticas).
4. **Escenario vertical 720×1280 para celular** (sección 18) y controles táctiles.
5. Mejoras de IA: libro de aperturas corto, mejor manejo de finales de peones.
6. Revisar `meta.stats.history` después de varias runs del autor para afinar el balance (sección 12), sobre todo el Acto 3, que todavía no se probó con `tests/balance.js`.

**Decisiones del autor (10/11/2026)**
- **Tres actos** en total: Bosque, Catacumbas y Castillo. El Rey Sombra es el jefe final.
- **Jugar con negras de vez en cuando**: implementado como una variante de duelo (sección 19).

**Preguntas abiertas para el autor**
- ¿El triple empate/50 jugadas debe contar como derrota o dar un premio de consuelo?
- ¿Qué duración objetivo tiene una run completa de tres actos (hoy cada acto dura ~25–30 min)?
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

Los difíciles y el jefe se enfrentan más tarde, con un ejército más grande; con 5 peones solos se espera perder. **Registro (v0.8):** al terminar cada run se guarda en `meta.stats.history` (últimas 30) el paso alcanzado, nodos, victorias, si ganó y qué monstruo la terminó. El menú muestra la última ("llegaste al paso 3, te venció la Viuda Tejedora"). **Próximo paso:** si muchas runs mueren en el mismo paso o contra el mismo monstruo, bajar ese tier o ese rival.

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
| Sir Nadie (Acto 3) | *Caballería* | Solo caballos, torres y peones: sus alfiles se vuelven caballos y su dama, una torre (nunca pasa del ejército estándar). Nunca te toca "comer la dama" contra él. |
| Velvet la Súcubo (Acto 3) | *Beso robado* | Cuando te come una pieza que no sea peón, te roba una poción al azar de la bolsa (se pierde también para la run). |
| Krakk el Kraken del Foso (Acto 3) | *Ocho brazos* | +2 s de incremento por jugada para él. |
| Ember el Dragón Joven (Acto 3) | *Aliento de fuego* | Cada 5 jugadas suyas te quema 4 s, con llamas sobre tu rey. |
| El Rey Sombra (jefe del Acto 3) | *Eclipse* | Siempre tiene dama. Con menos de la mitad de vida: aura roja, música más rápida y te roba 10 s (Iron Clock lo bloquea). |

Los rasgos del Acto 2 están en la tabla de la sección 14.

El rasgo se ve en el detalle del nodo, debajo del nombre del rival (★) y en la tarjeta de presentación de la batalla. Se implementan en `match.js` (`this.trait`), salvo el del esqueleto (`startDuel` en `run.js`) y el robo de monedas, que la run aplica con `cfg.onSteal`.

## 14. Actos (Acto 2 implementado en v0.10)
### Acto 1: El Bosque Embrujado
Slime, goblin, fantasma, araña, esqueleto, bruja, lobizón, medusa y vampiro. Jefe: **el Liche del Reloj**.

### Entre actos: la gran fogata
Al vencer al Liche aparece una pantalla especial:
- **+1 Reintento** automático y **elegir 1 de 3 amuletos** que no tengas (60 monedas si ya los tenés todos).
- **Bajar al Acto 2** o **retirarte victorioso**: retirarse termina la run como victoria con el bonus del Acto 1. Seguir arriesga la run, pero paga más.
- Si se recarga en esta pantalla, vuelve a ella con la misma oferta (se guarda `run.actOffer`).

### Acto 2: Las Catacumbas (implementado)
- **Mapa propio**: la misma estructura de 7 pasos y jefe, fondo verde oscuro, título "Acto 2: Las Catacumbas". Sin calentamiento ni duelos fáciles: dificultad por paso (normal / difícil) 80/20, 70/30, 60/40, 55/45, 50/50 y 45/55.
- **Paga ×1.5** en monedas de duelos, puzzles, Mate Rush y Arena (`actMult`).
- **Monstruos** (`act: 2` en `D.ENEMIES`). Los difíciles del Acto 1 (lobizón, medusa, vampiro) también aparecen:

| Monstruo | Estilo | Tier | Rasgo | Sus piezas |
|---|---|---|---|---|
| Ankh la Momia | Defensive | Normal | *Paciencia milenaria*: +20 s en su reloj | oliva con vendas |
| Wren la Banshee | Aggressive | Normal | *Lamento*: cada jaque que te da te cuesta 3 s | celeste pálido, base ondulada |
| Escombro el Gólem | Positional | Normal | *Lento pero firme*: +30 s pero sin incremento | piedra con musgo, ojos cian |
| Grimspire la Gárgola | Balanced | Difícil (roba tiempo) | *Centinela*: tu primera poción de la batalla cuesta 5 s | piedra oscura con cuernos y alas |
| **El Nigromante** (jefe) | Balanced | Jefe (roba tiempo ×2 + reloj de arena) | *Cosecha de almas*: +4 s por cada pieza que te come; con menos de la mitad de vida te roba 10 s una vez | verde oscuro con brillo verde |

- **Coronas**: el bonus de victoria es 40 × acto alcanzado (80 si vencés al Nigromante).
- **Logros nuevos**: *Hacia la oscuridad* (bajar al Acto 2, 15 Coronas) y *Saqueatumbas* (vencer al Nigromante, 40). *Cazamonstruos* pasa a requerir también a los del Acto 2.
- La **Run del día** usa semilla solo para el mapa del Acto 1; el del Acto 2 es aleatorio.

### Entre el Acto 2 y el 3
Al vencer al Nigromante vuelve la gran fogata (+1 Reintento y 1 de 3 amuletos) con la opción de **subir al Castillo** o retirarte victorioso. Es la misma pantalla, generalizada para cualquier acto que no sea el último.

### Acto 3: El Castillo (implementado en v0.12)
- **El acto final** (`D.ACTS = 3`). Mapa propio con fondo de losas violetas y título "Acto 3: El Castillo". Sin duelos fáciles: normal / difícil 70/30, 60/40, 55/45, 50/50, 45/55 y 40/60.
- **Paga ×2** en monedas (`actMult` = 1 + 0,5 por acto después del primero). El bonus de Coronas por terminar es 40 × acto (120 si vencés al Rey Sombra).
- **Monstruos** (`act: 3`). La gárgola, difícil del Acto 2, también aparece (regla general: los difíciles del acto anterior te siguen):

| Monstruo | Estilo | Tier | Rasgo | Sus piezas |
|---|---|---|---|---|
| Sir Nadie, el Caballero sin Cabeza | Aggressive | Normal | *Caballería* (solo caballos y torres) | acero, sin ojos: una llama violeta arriba |
| Velvet la Súcubo | Positional | Normal | *Beso robado* (te roba pociones) | magenta con cuernitos y alas |
| Krakk el Kraken del Foso | Defensive | Normal | *Ocho brazos* (+2 s de incremento) | verde mar con tentáculos en la base |
| Ember el Dragón Joven | Aggressive | Difícil (roba tiempo) | *Aliento de fuego* (−4 s cada 5 jugadas) | rojo fuego con cuernos y escamas |
| **El Rey Sombra** (jefe final) | Balanced | Jefe (roba tiempo ×2 + reloj de arena) | *Eclipse* (siempre con dama; segunda fase con robo de 10 s) | violeta noche con brillo violeta y base dorada |

- **Decisión de balance:** la propuesta decía que el Rey Sombra empezaba con el ejército completo. Se descartó porque contradice el pedido de que el juego sea más amable: usa el presupuesto de jefe del Acto 3 (1,0 × tu ejército + 1 desde v0.13), pero siempre con dama.
- **Mate Rush con mates en 2**: en el Acto 3 el nodo dura 90 s y paga el doble por mate. Los 60 mates en 2 (una sola jugada clave, el defensor siempre tiene opciones) se generaron fuera del juego y están en `D.RUSH2`; `tests/scenarios.js` comprueba que cada uno sea legal y tenga mate forzado en 2 sin mate en 1. Después de tu jugada clave responde el rival y tenés que dar mate.
- **Música por acto**: el mapa y las pantallas entre batallas tocan el tema del acto (Bosque: el del menú; Catacumbas: `crypt`, re menor lento; Castillo: `castle`, mi menor con aire de marcha). Las batallas siguen eligiendo por reloj.
- **Logros**: *Las puertas del castillo* (llegar al Acto 3, 20 Coronas) y *Regicidio* (vencer al Rey Sombra, 60).
- **Final**: vencer al Rey Sombra termina la run con la pantalla "EL CASTILLO ES TUYO".

## 15. Run del día, logros y estadísticas (implementado en v0.9)
### Run del día
- Botón **Run del día (fecha)** en el menú, debajo de *Comenzar run*. **No es un modo aparte**: es una run normal cuyo **mapa** (tipos de nodo, conexiones, monstruos, puzzles y eventos) se genera con una **semilla fija por fecha** (`seeded(AAAAMMDD)` en `run.js`). Todos los que juegan ese día ven el mismo mapa.
- Los premios, la tienda y la IA siguen siendo aleatorios, para que la partida no se resuelva memorizándola.
- Se guarda el **mejor paso alcanzado del día** (`meta.daily`) y se muestra en el botón. Terminar una cuenta para el logro *Dosis diaria*.

### Logros
itch.io **no tiene sistema de logros** para juegos HTML (su API solo cubre compras y descargas), así que son **locales** (`meta.ach`). Se desbloquean una vez, avisan con un cartel dorado y **pagan Coronas**, para que también empujen la meta-progresión. Pantalla *Logros (x/18)* en el menú, con los bloqueados en gris ("???" pero con la descripción visible).

| Logro | Condición | Coronas |
|---|---|---|
| Primera sangre | Ganar una batalla | 5 |
| Coronación | Coronar un peón | 5 |
| A prueba de balas | Ganar una batalla bullet | 5 |
| A mitad de camino | Superar un nodo del paso 5 o más | 5 |
| Resolvedor | 5 puzzles (sumando runs) | 10 |
| Cazadora de damas | Capturar 5 damas enemigas (sumando runs) | 10 |
| Máquina de mates | 10 mates en un solo Mate Rush | 10 |
| Tesoro | Juntar 200 monedas a la vez | 10 |
| Dosis diaria | Terminar una run del día | 10 |
| Campeón | Ganar las 3 rondas de una Arena | 15 |
| Cazaélites | Vencer a un monstruo élite | 15 |
| Ejército completo | Tener el ejército estándar completo | 20 |
| Ajedrez puro | Vencer al jefe sin usar pociones en la run | 20 |
| Coleccionista | Tener todos los amuletos permanentes | 25 |
| Rompetiempos | Vencer al Liche del Reloj | 30 |
| Cazamonstruos | Vencer a cada monstruo al menos una vez (incluye el Acto 2) | 30 |
| Hacia la oscuridad | Bajar al Acto 2 | 15 |
| Saqueatumbas | Vencer al Nigromante | 40 |
| El lado oscuro | Ganar una batalla jugando con negras | 10 |
| Las puertas del castillo | Llegar al Acto 3 | 20 |
| Regicidio | Vencer al Rey Sombra | 60 |

Son 21 logros y suman 370 Coronas. *Cazamonstruos* incluye a todos los monstruos de los tres actos. Los contadores entre runs (puzzles, damas, monstruos vencidos) están en `meta.counts`.

### Estadísticas
`meta.stats.history` (últimas 30 runs: paso, nodos, victorias, quién te venció) y la última run en el menú (sección 12).

## 16. Opciones y accesibilidad (implementado en v0.9)
Botón **Opciones** en el menú (modal):
- **Efectos de sonido** y **Música**: deslizadores de volumen de 0 a 100% (desde v0.11; antes eran interruptores). En 0 quedan en silencio. Cada uno tiene su propio bus de ganancia en `ui.js`, y se guardan en `meta.opts.sfxVol` / `musVol`. El botón *Sonido* de la batalla sigue siendo un silencio rápido.
- **Menos animaciones**: sin temblor de tablero, destellos ni partículas, y sin animaciones de reposo de retratos, medallas y fichas (`body.reduced` + `UI.reduced`).
- **Piezas enemigas clásicas**: el set carmesí en lugar de las facciones de cada monstruo. El rasgo y el retrato del monstruo se mantienen (`UI.classic`).
- **Pantalla completa.**
- Se guarda en `meta.opts`.

Ya estaban hechas y quedan anotadas: las coordenadas se ven siempre en el borde del tablero, la última jugada se marca en dorado y la lista de jugadas está en el panel izquierdo. Pendiente: el escenario vertical para celular (sección 18).

## 17. Todo dentro de la run (decisión del autor, v0.7)
**No hay modos de juego aparte**: cada idea nueva entra como **parte del juego principal**, sobre todo como un tipo de nodo del mapa, para que alimente la misma run (monedas, piezas, amuletos).

### Mate Rush: nodo bonus (implementado en v0.7)
- **Nodo del mapa** (ícono de rayo, color coral). **Siempre hay uno en el paso 3** y puede aparecer en otros pasos (10% en el paso 2, 8% del paso 5 en adelante).
- **60 segundos**: en el tablero aparece un **mate en 1** tras otro.
  - **Acierto**: +1 mate y el siguiente puzzle.
  - **Error** (cualquier jugada que no sea mate): **−10 s** y el siguiente puzzle.
  - *Terminar* corta antes de tiempo.
- **Paga monedas por mate**: `round((4 + paso) × (1 + 0.1×Monedero) × (1.25 si Moneda de la suerte))`. En el paso 3 son 6 monedas por mate: 8 mates dan 48 monedas, algo más que un duelo normal del mismo paso (42).
- **Puzzles generados al azar** (`js/rush.js`) y verificados por el motor: posición legal, nadie en jaque y al menos un mate en 1. No se repiten.
- **Dificultad**: arranca según el paso del mapa y sube con cada mate. Los sets de ataque pasan de dama sola o dos torres a combinaciones de 3–4 piezas, aparecen más defensores y, desde el nivel 6, hay una única jugada de mate.
- **Salir a mitad** pierde el bonus (el nodo queda resuelto sin monedas), así que recargar no sirve para repetirlo.
- La pantalla final muestra los mates y las monedas, y se vuelve al mapa.

### Ideas que antes eran "modos", replanteadas como partes de la run
| Idea | Cómo entra en la run |
|---|---|
| Boss Rush | **Nodo "Desafío de jefe"** (élite) en el paso 5: un mini-jefe con su rasgo y un premio de amuleto garantizado. Opcional, riesgoso. |
| Supervivencia | **Nodo "Arena" (implementado en v0.8)**: ver abajo. |
| Mate Rush en 2 | **Implementado en v0.12**: en el **Acto 3** el nodo Mate Rush pasa a mates en 2 (precalculados en `D.RUSH2`, sección 14). |
| Desafío diario | **Run del día**: la misma run (mapa, monstruos y premios) con semilla fija por fecha. Se elige desde el botón de empezar run, no es un modo nuevo. |

### Arena: nodo de riesgo (implementado en v0.8)
- **Siempre hay una en el paso 5.**
- Al entrar se ven los **3 rivales** (fácil, fácil, normal) y el premio de cada ronda: `round((8 + paso×2) × {1, 1.5, 2.2})`, con Monedero y Moneda de la suerte. En el paso 5 son 16 / 24 / 35 monedas.
- **Cada ronda es un duelo corto**: reloj blitz y objetivo **capturar 2 piezas**. Valen el rasgo del monstruo y tus pociones.
- **Ganar** paga en el momento y habilita la ronda siguiente. Entre rondas podés **retirarte** con lo ganado.
- **Perder** solo termina la Arena: la run sigue y **no se gasta un Reintento**. Si salís a mitad, conservás lo cobrado.
- Cada ronda ganada cuenta como batalla ganada para las Coronas.

## 18. Resolución y formato (v0.8)
**Decisión: resolución fija de referencia de 1280×720, horizontal (16:9).** Todo el juego vive en un escenario (`#stage`) de ese tamaño que `UI.fit` **escala para llenar la ventana**, con bandas oscuras si la proporción no coincide. Las pantallas largas (tienda, mapa con el panel de tu ejército, tienda permanente) hacen **scroll dentro del escenario**, nunca de la página. Así:
- se arregla que algunas pantallas no se pudieran recorrer dentro del iframe de itch.io, incluso en pantalla completa;
- se ve igual en cualquier pantalla: en 1920×1080 todo se agranda 1.5× y el pixel art queda nítido;
- los modales y avisos están dentro del escenario y escalan con él.

**¿Por qué horizontal y no vertical?**
- **El público de itch.io juega casi todo en escritorio**, y el embed de itch se muestra dentro de una página horizontal. Un 9:16 en un monitor 1080p queda de unos 540×960: tablero chico y mucho espacio vacío a los costados.
- **El diseño ya aprovecha el ancho**: el rival animado a la izquierda, el tablero al centro y las pociones y amuletos a la derecha. En vertical habría que apilarlos y el tablero bajaría de 560 px a unos 480.
- **El vertical sí es mejor para celular.** Queda como trabajo futuro: un segundo escenario de **720×1280** (tablero arriba, rival y pociones abajo) que se elija solo cuando la ventana sea más alta que ancha, con las mismas pantallas reacomodadas. Recién ahí convendría marcar "Mobile friendly" en itch.

**Configuración en itch.io:** *Viewport dimensions* **1280 × 720**, activar *Fullscreen button* y *Automatically start on page load*.

## 19. Repaso, negras y bestiario (implementado en v0.11)
### Repaso después de la batalla
- Al terminar una batalla (ganada o perdida, con al menos 2 jugadas tuyas) la tarjeta de resultado ofrece **Repasar la partida**.
- El juego repite la partida y analiza **cada jugada tuya** con la IA (profundidad 3, 60 ms por búsqueda), en pedazos chicos para no trabar la página, con un contador "Analizando tus jugadas... 5 / 12".
- Muestra **la jugada que más te costó** (si perdiste al menos 1,5 peones de ventaja): el tablero vuelve a esa posición con una **flecha roja** (lo que jugaste) y una **dorada** (la mejor), y dice cuánto valía ("unos 3,0 peones más" o "llevaba a un mate forzado"). Si no hubo errores graves, felicita.
- *Volver* regresa a la tarjeta de resultado. No hay repaso en el Mate Rush.
- Enseña ajedrez sin hacer el juego más difícil, pensado para quien no juega seguido.

### Jugar con negras de vez en cuando
- Desde el paso 3, cada duelo que no sea de calentamiento tiene un **20%** de jugarse con negras (también los nodos Élite). Los jefes, la Arena y los puzzles siguen como antes.
- El nodo muestra la etiqueta **NEGRAS** en el mapa, y el detalle dice "Tus piezas: Negras (abre el monstruo, +15% monedas)".
- Tu ejército se ubica en las filas 7 y 8, el tablero se da vuelta (seguís jugando "desde abajo") y **el monstruo mueve primero**. Las reglas no cambian.
- Paga **+15% de monedas** para compensar la desventaja de no empezar. Logro: *El lado oscuro*.
- La decisión es parte del mapa (`node.black`), así que la run del día también la fija por fecha.

### Bestiario
- Botón **Bestiario (x/20)** en el menú. Muestra a todos los monstruos agrupados por acto.
- Los que ya enfrentaste aparecen con su retrato, tier, estilo, rasgo y **tu récord** (ganadas / perdidas). Los demás son una silueta negra con "???".
- El récord se guarda en `meta.counts.record` (`{ id: [ganadas, perdidas] }`); las partidas viejas sin ese campo cuentan como conocidos a los monstruos que ya venciste (`meta.counts.beaten`).
