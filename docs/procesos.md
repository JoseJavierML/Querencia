---
type: Proceso
title: Flujo de trabajo, CI y despliegue
description: Proceso observable en el historial y en el workflow de GitHub Actions.
timestamp: 2026-11-01
---

# Procesos

## Flujo de trabajo

El historial local muestra ramas de funcionalidad, documentación y corrección integradas mediante commits de merge en `main`. No hay etiquetas Git en el repositorio local. La confirmación de que cada integración pasó por un pull request requiere revisar Pull requests de GitHub: **Por verificar**, porque `gh` no estaba autenticado.

## Integración continua

En [ci.yml](../.github/workflows/ci.yml), los eventos `pull_request` contra `main` y `push` a `main` ejecutan un job con Ubuntu y Node.js 22. El job instala dependencias con `npm ci` dentro de `backend` y ejecuta `npm test`. La comprobación local equivalente observada fue: **8 suites pasadas, 117 tests pasados, 0 snapshots**. Las pruebas del diario y del muro usan dobles de repositorios y de autenticación, sin MongoDB ni llamadas externas.

La integración frontend del diario no añade pruebas de navegador a Jest. Se verifica manualmente con el servidor en local: iniciar sesión, comprobar el `GET /api/diario` al cargar `diario.html`, guardar entradas con y sin título, abrir un eco para leer su contenido completo, comprobar el extracto de 40 caracteres cuando no hay título y borrar un eco con confirmación.

La integración frontend del muro tampoco añade pruebas de navegador. Se verifica manualmente: iniciar sesión, comprobar que `muro.html` carga las tarjetas con `GET /api/debates`, que un usuario normal recibe `403` al intentar crear o borrar y que un administrador puede hacerlo, que cada clic en una reacción alterna el voto y actualiza el contador, y que al recargar se conserva el estado `active` de las reacciones propias.

La administración se comprueba con dos sesiones: un `admin` debe ver el botón flotante con el lápiz en la esquina inferior derecha, abrir su diálogo, crear una reflexión con y sin URL de portada, marcar o desmarcar “Publicar como anónimo” y ver la papelera en cada tarjeta; un `oyente` no debe tener el FAB, el diálogo ni las papeleras en el DOM. La portada debe renderizarse sobre la tarjeta y, si la URL falla, debe aparecer el placeholder. Solo el textarea debe mostrar el scrollbar fino dorado, no la barra blanca nativa; el contenedor del diálogo no debe tener scroll propio ni `max-height` con overflow. El autor no anónimo debe aparecer sin el dominio del correo y el anónimo como “Publicado por Anónimo”, sin `authorEmail` en la respuesta de la API. Las reflexiones de más de 250 caracteres deben aparecer colapsadas con puntos suspensivos y “Leer más”; al pulsar la tarjeta o el control debe verse el texto completo y el control debe cambiar a “Mostrar menos”, y un segundo clic debe volver a colapsarlo. Pulsar una reacción o la papelera no debe expandir ni colapsar el texto. El borrado debe pedir confirmación, eliminar la tarjeta y recargar el muro. Si se fuerza una petición sin rol `admin`, la API debe responder `403`.

La redirección se comprueba desde `index.html`: un login correcto debe terminar en `muro.html`; el callback de Google también. Tras un registro, si la cuenta está activa se entra al muro y, si sigue pendiente de verificación, se muestra el aviso correspondiente sin inventar una sesión.

El seed se verifica con `node backend/seedDebate.js` desde la raíz o con `cd backend && npm run seed`: la primera ejecución crea el debate con portada y la segunda informa de que ya existe sin duplicarlo. La prueba requiere `MONGO_URI` y no forma parte de Jest.

## Despliegue continuo

El job `deploy` depende de `test` y solo se ejecuta en `push` a `main`. Reconstruye `backend/app.yaml`, autentica en Google Cloud y ejecuta `gcloud app deploy`. La ejecución real del workflow y la disponibilidad de la URL pública quedan **Por verificar**.

## Variables de entorno

Los nombres declarados en [backend/.env.example](../backend/.env.example) son `PORT`, `MONGO_URI`, `DIARY_MAX_TEXT_LENGTH`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_USER`, `EMAIL_PASS` y `ALLOWED_DOMAINS`. No se documentan sus valores. `DIARY_MAX_TEXT_LENGTH` es opcional y solo reduce el límite de 5000 caracteres del diario.
