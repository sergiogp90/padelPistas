# ADR 0001 — Render multipista: un único renderer con un *viewport* por celda

- **Estado:** Aceptada
- **Fecha:** 2026-07-02
- **Hito:** M3 — Multipista
- **Contexto en el código:** `src/scene/MultiCourtRenderer.ts`,
  `src/scene/CourtView.ts`, `src/scene/gridLayout.ts`

## Contexto

El hito **M3** debe mostrar **N pistas a la vez** en una misma pantalla de TV,
cada una con su vista 3D, su cámara de retransmisión y su marcador. Cada pista
(`CourtView`) es autocontenida: posee su propia `THREE.Scene`, su cámara y sus
luces, de modo que una pista no comparte estado 3D con las demás.

La pregunta de diseño es **cómo dibujar esas N vistas en pantalla**. Con
Three.js/WebGL hay dos caminos naturales:

1. **N renderers** — un `WebGLRenderer` (y por tanto un `<canvas>` y un contexto
   WebGL) por pista.
2. **Un único renderer** — un solo `WebGLRenderer`/`<canvas>` a pantalla
   completa que dibuja cada pista en su propia región (celda) mediante
   `setViewport` / `setScissor`.

## Decisión

Usamos **un único `WebGLRenderer`** a pantalla completa. La pantalla se reparte
en una rejilla de celdas (`gridLayout`) y cada `CourtView` se dibuja en su celda
con el patrón multi-vista estándar de Three.js:

- `setViewport(x, y, w, h)` recorta la **proyección** de la cámara al rectángulo
  de la celda.
- `setScissor(x, y, w, h)` con `setScissorTest(true)` limita el **borrado y el
  pintado** a ese mismo rectángulo, para que cada pista no pise a sus vecinas.

En cada fotograma, `MultiCourtRenderer.render()` recorre las vistas y hace un
`renderer.render(view.scene, view.camera)` por celda. La aritmética de la
rejilla vive aislada en `gridLayout` (sin Three.js ni DOM), lo que permite
probarla por separado y reutilizarla para maquetar los overlays HTML de los
marcadores con la misma forma (columnas × filas).

Los marcadores **no** se dibujan en WebGL: son una capa HTML/CSS superpuesta,
una rejilla CSS con la misma forma que los viewports (ver `main.ts` y la
decisión del marcador como overlay en [`architecture.md`](../architecture.md)).

## Alternativa descartada: N renderers (uno por pista)

Crear un renderer por pista se descartó por:

- **Límite de contextos WebGL del navegador.** Un navegador solo mantiene un
  puñado de contextos WebGL activos a la vez (típicamente **~8–16**). Al superar
  el límite, el navegador **descarta** los contextos más antiguos (`context
  lost`), justo lo contrario de lo que necesita un panel pensado para mostrar
  **muchas** pistas de forma **desatendida**.
- **Coste y rendimiento.** Cada contexto WebGL tiene un coste fijo de memoria y
  de CPU/GPU; multiplicarlo por pista compite directamente con el objetivo no
  funcional de **rendimiento fluido con varias pistas**.
- **Composición y sincronización.** N canvases obligan a maquetar y sincronizar
  varios bucles de render o varios canvas en el DOM; un único canvas a pantalla
  completa con un solo bucle (`requestAnimationFrame`) es más simple y encaja
  mejor con el modo TV/kiosko.

## Consecuencias

**A favor:**

- Un solo contexto WebGL y un solo bucle de render, independientemente del
  número de pistas: escala sin chocar con el límite de contextos.
- Cada `CourtView` sigue siendo independiente (su escena y su cámara), así que
  el contenedor (`main.ts`) solo orquesta la rejilla, no comparte estado 3D.
- La rejilla es aritmética pura y testeable (`gridLayout`), reutilizada tanto
  para los viewports (píxeles, origen abajo-izquierda) como para los overlays
  CSS (fracciones, origen arriba-izquierda).

**En contra / a tener en cuenta:**

- Hay que reencuadrar la cámara de cada vista al **aspecto real de su celda**
  (`CourtView.frame(aspect)`) al maquetar y al redimensionar.
- El coste de dibujar N escenas sigue creciendo con N (una llamada `render` por
  celda); si en el futuro pesa, se puede optimizar (culling, menor detalle por
  celda, etc.), pero sin volver a N contextos.
- Al compartir un canvas, los marcadores viven como overlay HTML/CSS aparte y su
  rejilla debe mantener la misma forma que los viewports.
