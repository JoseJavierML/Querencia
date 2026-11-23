---
type: Proceso
title: Flujo de trabajo, CI y despliegue
description: Proceso observable en el historial y en el workflow de GitHub Actions, actualizado tras el refactor del Sprint 3.
timestamp: 2026-11-22
---

# Procesos

## Flujo de trabajo

El historial local muestra ramas de funcionalidad, documentación y corrección integradas mediante commits de merge en `main`. No hay etiquetas Git en el repositorio local. La confirmación de que cada integración pasó por un pull request requiere revisar Pull requests de GitHub: **Por verificar**, porque `gh` no estaba autenticado. El refactor del Sprint 3 se prepara en la rama `refactor/sprint-3` y se entrega en un único Pull Request hacia `main`; las cinco tareas del refactor se agrupan en ese PR para revisar el conjunto y no fragmentar la validación.

## Integración continua

En [ci.yml](../.github/workflows/ci.yml), los eventos `pull_request` contra `main` y `push` a `main` ejecutan un job con Ubuntu y Node.js 22. El job instala dependencias con `npm ci` dentro de `backend` y ejecuta `npm test`. La última comprobación local observada es: **16 suites pasadas, 222 tests pasados, 0 snapshots**. Las pruebas del diario, del muro, de El Velo, de El Archivo y del refactor usan dobles de repositorios, autenticación y red, sin MongoDB ni llamadas externas.

El refactor añade pruebas de las validaciones compartidas (`validation.test.js`), del escapado y la serialización HTML (`htmlUtils.test.js`), de la proyección pública de usuarios y de los caminos de error de El Archivo (HTTP no satisfactorio, JSON malformado y timeout). La extracción de módulos del frontend no añade pruebas de navegador a Jest.

## Verificación del refactor

La comprobación reproducible del Sprint 3 es:

```bash
cd backend
npm test
```

Además se comprueba que `server.js` se puede importar sin efectos secundarios:

```bash
cd backend
node -e "const { app, start } = require('./server'); console.log(Boolean(app), typeof start);"
```

La salida esperada es `true function`, sin conexión a MongoDB ni puerto abierto. Los módulos de `backend/frontend/js` se validan con `node --input-type=module --check`; los trece archivos pasan la comprobación de sintaxis.

Queda pendiente la verificación manual en navegador: iniciar sesión, arrastrar un vinilo de El Archivo al tocadiscos, abrir los modales del Muro y de El Archivo, y recorrer el Diario extraído a `js/diario.js` (guardar, leer, borrar y adjuntar vinilo). El despliegue en Google App Engine tampoco se ha vuelto a ejecutar después del refactor.

## Verificación manual del diario

La integración frontend del diario no añade pruebas de navegador a Jest. Se verifica manualmente con el servidor en local: iniciar sesión, comprobar el `GET /api/diario` al cargar `diario.html`, guardar entradas con y sin título, abrir un eco para leer su contenido completo, comprobar el extracto de 40 caracteres cuando no hay título y borrar un eco con confirmación. Tras el Sprint 3, el módulo vive en `js/diario.js` y la página solo lo carga como `type="module"`.

## Verificación manual del muro

La integración frontend del muro tampoco añade pruebas de navegador. Se verifica manualmente: iniciar sesión, comprobar que `muro.html` carga las tarjetas con `GET /api/debates`, que un usuario normal recibe `403` al intentar crear o borrar y que un administrador puede hacerlo, que cada clic en una reacción alterna el voto y actualiza el contador, y que al recargar se conserva el estado `active` de las reacciones propias.

La administración se comprueba con dos sesiones: un `admin` debe ver el botón flotante con el lápiz en la esquina inferior derecha, abrir su diálogo, crear una reflexión con y sin URL de portada, marcar o desmarcar “Publicar como anónimo” y ver la papelera en cada tarjeta; un `oyente` no debe tener el FAB, el diálogo ni las papeleras en el DOM. La portada debe renderizarse sobre la tarjeta y, si la URL falla, debe aparecer el placeholder. Solo el textarea debe mostrar el scrollbar fino dorado, no la barra blanca nativa; el contenedor del diálogo no debe tener scroll propio ni `max-height` con overflow. El autor no anónimo debe aparecer sin el dominio del correo y el anónimo como “Publicado por Anónimo”, sin `authorEmail` en la respuesta de la API. Las reflexiones de más de 250 caracteres deben aparecer colapsadas con puntos suspensivos y “Leer más”; al pulsar el control o la tarjeta debe abrirse un modal centrado con el texto completo, fondo oscurecido y estética glassmorphism. La “X” debe cerrarlo y devolver al mismo punto de scroll. Pulsar una reacción o la papelera no debe abrir la lectura. Los avisos de publicación, borrado o error deben desvanecerse solos tras unos 3,5 segundos, mientras que “Cargando”, el error de carga y el muro vacío deben permanecer visibles. El borrado debe pedir confirmación, eliminar la tarjeta y recargar el muro. Si se fuerza una petición sin rol `admin`, la API debe responder `403`.

## Verificación manual de El Velo

El Velo se comprueba con una sesión de administrador y otra de oyente. El administrador debe poder programar una pista para hoy y otra para una fecha futura desde “La Cola del Velo”, ver el estado `today` o `future`, editar una pista no pasada y recibir un error si intenta duplicar la fecha. El oyente debe recibir solo el reproductor en el estado ciego, sin título, artista ni portada en el DOM; al enviar una reflexión debe ver la ficha completa y el muro de voces, con la propia marcada como “Tu reflexión”. Un segundo envío debe responder `409`. El listado administrativo no debe ser accesible para un oyente (`403`), y las pistas pasadas no deben poder editarse.

## Verificación manual de El Archivo

La vista de cajones debe cargar con `GET /api/archivo/cajones`, alternar entre género y artista sin que una respuesta antigua pise a una nueva, y mostrar los estados de carga, vacío, error y reintento. Un clic simple debe abrir la ficha con los datos de Last.fm y cerrarse con la “X”, el fondo o `Escape`, devolviendo el foco a la portada. El arrastre nativo debe llevar el vinilo al plato y reproducirlo; si no tiene `youtubeVideoId`, debe mostrarse el aviso sin romper la página. El MIME compartido es `application/x-querencia-vinilo` y el dock global debe aceptar tanto ese tipo como `text/plain`.

## Redirección y seed

La redirección se comprueba desde `index.html`: un login correcto debe terminar en `muro.html`; el callback de Google también. Tras un registro, si la cuenta está activa se entra al muro y, si sigue pendiente de verificación, se muestra el aviso correspondiente sin inventar una sesión.

El seed se verifica con `node backend/seedDebate.js` desde la raíz o con `cd backend && npm run seed`: la primera ejecución crea el debate con portada y la segunda informa de que ya existe sin duplicarlo. La prueba requiere `MONGO_URI` y no forma parte de Jest.

## Despliegue continuo

El job `deploy` depende de `test` y solo se ejecuta en `push` a `main`. Reconstruye `backend/app.yaml`, autentica en Google Cloud y ejecuta `gcloud app deploy`. El refactor no modifica `backend/app.yaml` ni el workflow; la ejecución real del despliegue y la disponibilidad de la URL pública quedan **Por verificar** después de los cambios.

## Variables de entorno

Los nombres declarados en [backend/.env.example](../backend/.env.example) son `PORT`, `MONGO_URI`, `BACKEND_URL`, `DIARY_MAX_TEXT_LENGTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, `ALLOWED_DOMAINS`, `LASTFM_API_KEY`, `LASTFM_API_URL`, `YOUTUBE_API_KEY`, `YOUTUBE_API_URL`, `YOUTUBE_SEARCH_URL`, `YOUTUBE_SCRAPING_ENABLED`, `ARCHIVO_CACHE_TTL_DAYS` y `ARCHIVO_HTTP_TIMEOUT_MS`. No se documentan sus valores.

`BACKEND_URL` es obligatoria para que `mailer.js` construya el enlace de verificación; en local se usa `http://localhost:3000` y en App Engine debe coincidir con el origen público. `DIARY_MAX_TEXT_LENGTH` es opcional y solo reduce el límite de 5000 caracteres del diario. Las variables de El Archivo son opcionales salvo `LASTFM_API_KEY` para consultas externas; sin ella solo se pueden servir fichas ya cacheadas.
