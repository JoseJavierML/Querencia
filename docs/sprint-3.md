---
type: Sprint
title: Sprint 3
description: Refactor interno del MVP para reducir duplicación, separar responsabilidades y endurecer la API sin añadir funcionalidades nuevas.
timestamp: 2026-11-22
---

# Sprint 3

## Estado general

El Sprint 3 es un refactor interno del MVP. No añade funcionalidades nuevas ni cambia los contratos HTTP existentes: reorganiza el código para reducir duplicación, aislar las integraciones externas, endurecer el tratamiento de errores y facilitar el mantenimiento. El alcance se ejecutó en una única rama, `refactor/sprint-3`, y se entrega en un único Pull Request hacia `main`.

La suite automatizada queda en **16 suites y 222 tests pasados** con `cd backend && npm test`. El servidor se puede importar sin abrir puertos ni conectar a MongoDB gracias a la separación entre `app` y `start()`. La verificación manual en navegador del arrastre, los modales y el módulo extraído del Diario sigue pendiente, y el despliegue en Google App Engine no se ha vuelto a probar en esta iteración.

## Objetivo

Consolidar la base del MVP antes de seguir añadiendo historias:

- Una sola implementación de las validaciones que compartían Diario, Muro, El Velo y El Archivo.
- Un servicio de El Archivo que orqueste sin mezclar transporte HTTP, adaptadores de proveedores, caché y mapeo de respuestas.
- Una API con errores codificados, proyecciones públicas seguras y respuestas JSON homogéneas.
- Un frontend sin cargadores de YouTube duplicados, con constantes compartidas y renderizado seguro del DOM.
- Documentación actualizada y una verificación reproducible de la suite.

## Tareas

### T1 — Validaciones de dominio compartidas

**Qué se hizo:** se añadieron [validation.js](../backend/validation.js) y [timeConstants.js](../backend/timeConstants.js). `validation.js` concentra `isValidObjectId`, `normalizeVinylId`, `resolveUserId` y `normalizeHttpUrl`; cada servicio inyecta su propia clase de error para conservar los mensajes y los códigos HTTP existentes. `timeConstants.js` expone `DAY_IN_MILLISECONDS`, usado por la caché de El Archivo y por el cálculo diario de El Velo.

**Servicios ajustados:** [diaryService.js](../backend/diaryService.js), [debateService.js](../backend/debateService.js), [veloService.js](../backend/veloService.js) y [archivoUtils.js](../backend/archivoUtils.js). Las funciones locales duplicadas se sustituyeron por delegaciones a `validation.js`; `archivoUtils.js` mantiene la reexportación de `isValidObjectId` para no romper imports existentes.

**Criterios de aceptación:**

- Una única implementación de cada validación compartida.
- Los mensajes de error de cada dominio no cambian.
- Las referencias opcionales a `Vinyl` siguen aceptando ausencia, cadena vacía y `null`.
- La suite existente sigue pasando.

**Evidencia:** [validation.test.js](../backend/validation.test.js) cubre identificadores, referencias opcionales, resolución de usuario y URLs `http`/`https`, incluido el rechazo de `javascript:`.

### T2 — Descomposición de El Archivo

**Qué se hizo:** [archivoService.js](../backend/archivoService.js) queda como orquestador de búsqueda, detalle y cajones. La implementación se reparte en módulos con una responsabilidad cada uno:

| Módulo | Responsabilidad |
|---|---|
| [archivoErrors.js](../backend/archivoErrors.js) | Errores de dominio de El Archivo. |
| [httpJsonClient.js](../backend/httpJsonClient.js) | Fetch con timeout, validación de respuesta y traducción de fallos de red o JSON. |
| [lastfmClient.js](../backend/lastfmClient.js) | Construcción de URLs, búsqueda, ficha y normalización de Last.fm. |
| [youtubeClient.js](../backend/youtubeClient.js) | YouTube Data API y fallback de scraping. |
| [archivoCache.js](../backend/archivoCache.js) | TTL, enriquecimiento de audio, refresco y registro de acceso. |
| [vinylMapper.js](../backend/vinylMapper.js) | Respuesta pública completa del vinilo. |

`archivoService.js` conserva la exportación de las clases de error para que [archivoRouter.js](../backend/archivoRouter.js) y las pruebas no cambien su punto de importación.

**Criterios de aceptación:**

- El contrato de `createArchivoService` y las respuestas `{ disco, cached, created, stale }` no cambian.
- Un fallo de Last.fm, YouTube o la red no impide devolver una ficha cacheada.
- Los timeouts y las respuestas JSON inválidas se traducen a errores de dominio.
- Las pruebas pueden inyectar `fetchImpl`, `now` y `logger` sin red real.

**Evidencia:** [archivoService.test.js](../backend/archivoService.test.js) añade casos de error HTTP, JSON malformado y timeout, además de conservar los escenarios de caché, refresco y `upsert`.

### T3 — Endurecimiento de autenticación, errores y arranque

**Qué se hizo:**

- [userModel.js](../backend/userModel.js) usa errores con `code` (`EMAIL_ALREADY_REGISTERED`, `INVALID_VERIFICATION_TOKEN`, `USER_NOT_FOUND`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`), centraliza `SALT_ROUNDS` y limita `getAll()` a `email role status createdAt`, sin hash de contraseña ni token de verificación.
- [server.js](../backend/server.js) distingue `401` de credenciales o cuenta pendiente frente a `500` inesperado, revierte el registro si falla el correo, escapa el HTML de verificación, serializa los valores del callback OAuth para un script inline, devuelve `404` y errores JSON bajo `/api`, y separa `app` de `start()`.
- [httpErrors.js](../backend/httpErrors.js) define `HttpError` para que los routers puedan lanzar errores con estado sin acoplarse a Express.
- [htmlUtils.js](../backend/htmlUtils.js) concentra `escapeHtml` y `serializeForInlineScript`.
- [database.js](../backend/database.js) registra el fallo y lo propaga; [mailer.js](../backend/mailer.js) exige `BACKEND_URL` y elimina el valor por defecto de Render.
- [backend/.env.example](../backend/.env.example) documenta `BACKEND_URL=http://localhost:3000`.
- [frontend/js/apiError.js](../backend/frontend/js/apiError.js) define `ApiError`; [frontend/js/api.js](../backend/frontend/js/api.js) lee JSON o texto sin asumir el contenido y [frontend/js/auth.js](../backend/frontend/js/auth.js) detecta la sesión caducada por estado HTTP.

**Criterios de aceptación:**

- Importar `server.js` no conecta a MongoDB ni abre un puerto.
- `npm start` sigue arrancando el servidor y App Engine sigue usando `npm start`.
- Un correo de verificación fallido no deja un usuario huérfano.
- La lista de usuarios no expone campos sensibles.
- Las respuestas de error de `/api` son JSON y los 404 también.

**Evidencia:** [htmlUtils.test.js](../backend/htmlUtils.test.js) y el caso de proyección segura en [userModel.test.js](../backend/userModel.test.js). La comprobación `node -e "require('./server')"` devuelve `app` y `start` sin efectos secundarios.

### T4 — Modularización del frontend

**Qué se hizo:**

- [youtubeApi.js](../backend/frontend/js/youtubeApi.js) centraliza la carga única de la YouTube Iframe API.
- [constants.js](../backend/frontend/js/constants.js) define `VINYL_MIME` y `TIME_ZONE`.
- [modal.js](../backend/frontend/js/modal.js) concentra la trampa de foco de los modales.
- [diario.js](../backend/frontend/js/diario.js) recoge el módulo que vivía inline en [diario.html](../backend/frontend/diario.html); la página solo carga `js/auth.js` y `js/diario.js`.
- [archivo.js](../backend/frontend/js/archivo.js), [velo.js](../backend/frontend/js/velo.js) y [vinylPlayer.js](../backend/frontend/js/vinylPlayer.js) reutilizan `loadYouTubeApi` y el mismo MIME.
- [muro.js](../backend/frontend/js/muro.js) reutiliza `handleFocusTrap`.
- [admin.js](../backend/frontend/js/admin.js) construye la tabla de usuarios con `createElement` y `textContent`, y codifica el correo en la URL de borrado.
- [auth.js](../backend/frontend/js/auth.js) pinta la cabecera con nodos y `textContent` en lugar de interpolar el correo en `innerHTML`.

El MIME anterior de `vinylPlayer.js` era `application/x-querencia-vinyl`, mientras que `archivo.js` usaba `application/x-querencia-vinilo`; ahora ambos comparten `application/x-querencia-vinilo`. El arrastre conserva una copia en `text/plain` para los navegadores que la necesiten.

**Criterios de aceptación:**

- El arrastre nativo sigue funcionando entre El Archivo y el dock global.
- Los modales conservan foco, cierre con `Escape` y restauración de scroll.
- El Diario conserva guardado, lectura, borrado y selector de vinilo.
- Ningún dato de usuario se interpola como HTML.

**Evidencia:** los trece módulos de `backend/frontend/js` pasan una comprobación de sintaxis con `node --input-type=module --check`. No hay pruebas automatizadas de navegador; la verificación manual del arrastre, los modales y el Diario extraído sigue pendiente.

### T5 — Documentación y verificación

**Qué se hizo:** se creó este documento y se actualizaron [index.md](index.md), [arquitectura.md](arquitectura.md), [procesos.md](procesos.md), [log.md](log.md), [decisiones.md](decisiones.md), [requisitos.md](requisitos.md), [sprint-2.md](sprint-2.md) y [README.md](../README.md). La documentación registra el alcance del refactor, las decisiones nuevas, la limitación de la sesión en memoria y el debate abierto sobre JWT.

**Criterios de aceptación:**

- La documentación no presenta el refactor como una funcionalidad nueva.
- La suite y el comando de verificación quedan actualizados.
- La limitación de la sesión en memoria y la alternativa JWT quedan explícitas.
- El README permite configurar y ejecutar el proyecto en local sin depender de valores hardcodeados.

## Verificación

| Comprobación | Resultado |
|---|---|
| `cd backend && npm test` | 16 suites, 222 tests, 0 fallos. |
| Importación de `server.js` | `app` y `start` disponibles; sin conexión ni `listen`. |
| Sintaxis de módulos del frontend | 13 archivos correctos con `node --input-type=module --check`. |
| Arranque con `npm start` | No se ha levantado el servidor en esta sesión; el entrypoint no cambia. |
| Despliegue en App Engine | No se ha vuelto a probar; `backend/app.yaml` no se modificó. |
| Verificación manual en navegador | Pendiente: arrastre, modales y Diario extraído. |

## Riesgos y limitaciones

- **Sesión en memoria.** `authMiddleware.js` sigue usando un `Map` del proceso. Es la opción más conservadora para no invalidar sesiones existentes ni alterar el despliegue actual, pero las sesiones se pierden al reiniciar o al cambiar de instancia. La migración a JWT stateless queda como debate abierto en el Pull Request y en [decisiones.md](decisiones.md).
- **Sin pruebas de navegador.** Jest cubre modelos, servicios, routers y utilidades, pero no el DOM ni los eventos nativos de arrastre. La extracción de `diario.js` y el cambio de MIME requieren una pasada manual.
- **App Engine sin revalidar.** El refactor no toca `app.yaml` ni el workflow, pero el despliegue real no se ha ejecutado después de los cambios.
- **Dependencias externas.** Last.fm y YouTube siguen siendo puntos de fallo; la caché y los errores de dominio limitan el impacto, no lo eliminan.

## Retrospectiva

### Qué funcionó

- La suite existente actuó como red de seguridad: las tareas se pudieron aplicar sin cambiar los contratos HTTP.
- La inyección de dependencias de El Archivo permitió dividir el servicio sin reescribir las pruebas desde cero.
- La separación `app`/`start` facilita comprobaciones de importación y futuras pruebas de integración.

### Qué cambiaría

- Habría sido útil disponer de una prueba de humo de navegador para el arrastre y el Diario antes de extraer módulos.
- La documentación de variables de entorno debería haber acompañado antes al cambio de `mailer.js`.
- El debate JWT debería cerrarse con una prueba de despliegue multiinstancia, no solo con una decisión teórica.

## Trabajo abierto

- Verificar manualmente en navegador el arrastre de El Archivo, el dock global, los modales y el Diario extraído.
- Reejecutar el despliegue en App Engine y comprobar la URL pública.
- Decidir si se migra la sesión a JWT stateless o se mantiene la sesión en memoria con una configuración de una sola instancia.
- Completar las verificaciones heredadas del Sprint 1 y del Sprint 2: correo real, primer administrador, endpoint de usuario activo y Pull requests de GitHub.
