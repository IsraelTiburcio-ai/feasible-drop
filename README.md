# FEASIBLE DROP

Microjuego educativo mobile-first para practicar la **región factible** y la pertenencia de puntos al tema **2.5 Método Gráfico** del Gimnasio 2 de Optimización I.

## Jugar

- **Repositorio:** https://github.com/IsraelTiburcio-ai/feasible-drop
- **Versión pública:** https://IsraelTiburcio-ai.github.io/feasible-drop/

La partida tiene 6 rondas y normalmente dura entre 45 y 90 segundos.

## Cómo se juega

1. Observa el plano cartesiano y el área de intersección sombreada.
2. En unas rondas decide si el punto **sí pertenece** o **no pertenece**.
3. En otras, toca el punto que pertenece o el intruso que queda fuera.
4. Revisa la sustitución en cada restricción después de responder.

Las líneas, puntos y botones tienen objetivos táctiles amplios. También se puede navegar con teclado. El juego incluye sonido breve, control de silencio y respeta `prefers-reduced-motion`.

## Cobertura académica

El contenido se construyó a partir de las páginas 41-43 del PDF `Gimnasio 2. Modelos de Programación Lineal`:

- Método gráfico con dos variables de decisión.
- Región factible como conjunto de soluciones que satisface las restricciones explícitas e implícitas.
- Área de intersección de las restricciones.
- Puntos extremos y relación con la solución óptima.
- Modelo principal de la página 43:

  ```text
  max z = 3x + 2y
  s. a.  2x + y <= 80
        x + y <= 50
        x, y >= 0
  ```

- Verificación de los puntos del material: `(40,60)` no pertenece; `(30,10)` y `(20,30)` pertenecen.
- Segundo modelo de la página 43, usado en una ronda adicional, con `y >= 3` y su región factible sombreada.

## Tecnología

HTML, CSS y JavaScript vanilla. La gráfica se dibuja con SVG y los sonidos se generan con Web Audio API; no hay dependencias de runtime ni servidor.

## Deploy

`.github/workflows/pages.yml` publica automáticamente el contenido estático en GitHub Pages cada vez que hay un push a `main`. En la configuración del repositorio, GitHub Pages debe usar **GitHub Actions** como fuente.
