/* ============================================================
   FEASIBLE DROP · data.js
   Fuente académica: Gimnasio 2 — Modelos de Programación Lineal
   Tema 2.5 Método Gráfico (pp. 41-43)
   Ejercicio base p.43:
     max z = 3x + 2y
     s.a.  2x + y ≤ 80      (R1)
           x  +  y ≤ 50     (R2)
           x, y ≥ 0         (restricciones implícitas)
   Respuestas del material: (40,60) No pertenece ·
   (30,10) Pertenece · (20,30) Pertenece
   Vértices según la gráfica de la maestra:
     D(0,0) · B(40,0) · A(30,20) · C(0,50)
   Segundo modelo p.43:
     max z = 5x + 9y
     s.a.  4x − 2y ≤ 4   (R1)
           2x + 4y ≤ 20  (R2)
           y ≥ 3         (R3)
           x, y ≥ 0
   Región factible (cuadrilátero): (0,3), (2.5,3), (2.8,3.6), (0,5)
   ============================================================ */

const MODELS = {
  m1: {
    id: "m1",
    title: "max z = 3x + 2y",
    restrictions: "s. a.   2x + y ≤ 80  ·  x + y ≤ 50  ·  x, y ≥ 0",
    // Ventana visible del plano (unidades académicas)
    view: { xMax: 60, yMax: 70, tickX: 10, tickY: 10 },
    // Región factible sombreada (vértices de la maestra: D-B-A-C)
    region: [[0, 0], [40, 0], [30, 20], [0, 50]],
    vertices: [
      { p: [0, 0], label: "D" },
      { p: [40, 0], label: "B" },
      { p: [30, 20], label: "A" },
      { p: [0, 50], label: "C" }
    ],
    lines: [
      { id: "R1", from: [0, 80], to: [40, 0], label: "2x + y = 80", labelAt: [10, 64], color: "var(--c-r1)" },
      { id: "R2", from: [0, 50], to: [50, 0], label: "x + y = 50", labelAt: [43, 12], color: "var(--c-r2)" }
    ]
  },

  m2: {
    id: "m2",
    title: "max z = 5x + 9y",
    restrictions: "s. a.   4x − 2y ≤ 4  ·  2x + 4y ≤ 20  ·  y ≥ 3  ·  x, y ≥ 0",
    view: { xMax: 11, yMax: 6, tickX: 1, tickY: 1, tickEveryX: 2, tickEveryY: 1 },
    region: [[0, 3], [2.5, 3], [2.8, 3.6], [0, 5]],
    vertices: [],
    lines: [
      { id: "R1", from: [0, -2], to: [3, 4], label: "4x − 2y = 4", labelAt: [1.7, 1.4], color: "var(--c-r1)" },
      { id: "R2", from: [0, 5], to: [10, 0], label: "2x + 4y = 20", labelAt: [6.1, 1.8], color: "var(--c-r2)" },
      { id: "R3", from: [0, 3], to: [11, 3], label: "y = 3", labelAt: [9.9, 3.35], color: "var(--c-r3)" }
    ]
  }
};

/* Tipos de ronda:
   "sino"  → un punto cae en dron; el jugador decide SÍ / NO pertenece
   "toca"  → tres puntos en escena; tocar el que se pide
   En "toca", find: "intruder" (el que NO pertenece) | "member" (el que SÍ) */

const ROUNDS = [
  {
    type: "sino",
    model: "m1",
    point: { name: "A", xy: [40, 60] },
    belongs: false,
    // Verificación restricción por restricción (estilo del material)
    checks: [
      { txt: "R1: 2(40) + 60 = 140 > 80", ok: false },
      { txt: "R2: 40 + 60 = 100 > 50", ok: false },
      { txt: "x, y ≥ 0", ok: true }
    ],
    note: "No satisface TODAS las restricciones: queda fuera de la región factible."
  },
  {
    type: "toca",
    find: "intruder",
    model: "m1",
    points: [
      { name: "A", xy: [40, 60], belongs: false },
      { name: "B", xy: [30, 10], belongs: true },
      { name: "C", xy: [20, 30], belongs: true }
    ],
    correctName: "A",
    checks: [
      { txt: "A(40,60): R1 = 140 > 80 ✗", ok: false },
      { txt: "B(30,10): R1 = 70 ≤ 80 ✓ · R2 = 40 ≤ 50 ✓", ok: true },
      { txt: "C(20,30): R1 = 70 ≤ 80 ✓ · R2 = 50 ≤ 50 ✓", ok: true }
    ],
    note: "El intruso A(40,60) viola las dos restricciones: no pertenece."
  },
  {
    type: "sino",
    model: "m1",
    point: { name: "C", xy: [20, 30] },
    belongs: true,
    checks: [
      { txt: "R1: 2(20) + 30 = 70 ≤ 80", ok: true },
      { txt: "R2: 20 + 30 = 50 ≤ 50", ok: true },
      { txt: "x, y ≥ 0", ok: true }
    ],
    note: "50 ≤ 50 justo: los puntos del borde TAMBIÉN pertenecen a la región factible."
  },
  {
    type: "sino",
    model: "m1",
    point: { name: "P", xy: [50, 0] },
    belongs: false,
    checks: [
      { txt: "R1: 2(50) + 0 = 100 > 80", ok: false },
      { txt: "R2: 50 + 0 = 50 ≤ 50", ok: true },
      { txt: "x, y ≥ 0", ok: true }
    ],
    note: "Cumple R2, pero basta fallar UNA restricción para quedar fuera."
  },
  {
    type: "toca",
    find: "member",
    model: "m2",
    points: [
      { name: "A", xy: [0, 4], belongs: true },
      { name: "B", xy: [4, 3], belongs: false },
      { name: "C", xy: [1, 2], belongs: false }
    ],
    correctName: "A",
    checks: [
      { txt: "A(0,4): R1 = −8 ≤ 4 ✓ · R2 = 16 ≤ 20 ✓ · y = 4 ≥ 3 ✓", ok: true },
      { txt: "B(4,3): R1 = 10 > 4 ✗", ok: false },
      { txt: "C(1,2): y = 2 < 3 ✗", ok: false }
    ],
    note: "La región factible es la INTERSECCIÓN de todas las restricciones."
  },
  {
    type: "sino",
    model: "m1",
    point: { name: "A", xy: [30, 20] },
    belongs: true,
    checks: [
      { txt: "R1: 2(30) + 20 = 80 ≤ 80", ok: true },
      { txt: "R2: 30 + 20 = 50 ≤ 50", ok: true },
      { txt: "x, y ≥ 0", ok: true }
    ],
    note: "Es el punto extremo A: ¡en los vértices vive la solución óptima!",
    star: true
  }
];

const ROUND_TIME = 12; // segundos por ronda
const BASE_POINTS = 100;
const MAX_BONUS = 50;
