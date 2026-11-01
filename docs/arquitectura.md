---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas comprobables del backend y del frontend, con su frontera HTTP.
timestamp: 2026-11-01
---

# Arquitectura

## Backend

- **API/presentación:** [server.js](../backend/server.js) define las rutas HTTP, valida entradas básicas y construye respuestas; [diaryRouter.js](../backend/diaryRouter.js) expone las rutas del diario y [debateRouter.js](../backend/debateRouter.js) expone las del muro, traduciendo errores de dominio a HTTP.
- **Lógica de aplicación:** [userModel.js](../backend/userModel.js), [authMiddleware.js](../backend/authMiddleware.js), [adminMiddleware.js](../backend/adminMiddleware.js), [domainLogic.js](../backend/domainLogic.js), [diaryService.js](../backend/diaryService.js), [debateService.js](../backend/debateService.js) y [debateConstants.js](../backend/debateConstants.js) gestionan usuarios, sesión, roles, dominios, entradas del diario y debates.
- **Datos:** [database.js](../backend/database.js) conecta Mongoose con MongoDB; `userModel.js` usa el modelo persistente `User`, [diaryModel.js](../backend/diaryModel.js) define `DiaryEntry` con referencia a `User` y [debateModel.js](../backend/debateModel.js) define `Debate` con autor y reacciones como arrays de `ObjectId`.
- **Servicios transversales:** [logger.js](../backend/logger.js) registra actividad y [mailer.js](../backend/mailer.js) prepara el correo de confirmación.

## Frontend

- **Presentación:** las páginas HTML de [backend/frontend/](../backend/frontend/) contienen las vistas pública, privada y de administración; [diario.html](../backend/frontend/diario.html) renderiza el historial “Ecos”, el formulario de escritura con título opcional y la vista de lectura de cada eco; [muro.html](../backend/frontend/muro.html) y [muro.js](../backend/frontend/js/muro.js) renderizan las tarjetas de debate y sus reacciones.
- **Comunicación:** [api.js](../backend/frontend/js/api.js) centraliza las peticiones de negocio, incluidas `crearEntradaDiario`, `listarDiario`, `eliminarEntradaDiario`, `listarDebates` y `reaccionarDebate`, y [auth.js](../backend/frontend/js/auth.js) añade el token, comprueba la sesión y cierra sesión.

## Frontera exacta

El frontend llama a rutas relativas que empiezan por `/api`. Express las recibe en `server.js`; allí se aplican `authMiddleware` y, cuando corresponde, `isAdminMiddleware`, antes de delegar en el modelo o la lógica. Las páginas estáticas se sirven desde `frontend` mediante `express.static`.

En el diario, `server.js` actúa como composición: crea `DiaryRepository` y `createDiaryService` inyectando `userModel`, y después crea `createDiaryRouter` con el servicio y `authMiddleware`. Así `diaryService.js` no importa Express ni Mongoose, y `diaryRouter.js` no accede a la base de datos.

El borrado usa `DiaryRepository.deleteByIdForUser(id, userId)`, que ejecuta `findOneAndDelete({ _id: id, userId })`. La consulta incluye la propiedad del eco, de modo que un usuario no puede borrar entradas ajenas. Si el eco no existe o pertenece a otro usuario, la API responde `404` sin distinguir ambos casos.

En el frontend, `diario.html` no llama a `fetch` directamente: usa `api.listarDiario()` al cargar la página, `api.crearEntradaDiario(text, title)` al enviar el formulario y `api.eliminarEntradaDiario(id)` al borrar un eco. `api.js` usa rutas relativas `/api` y `fetchAutenticado`, que añade `Authorization: Bearer` desde `localStorage` y gestiona el `401`.

En el muro, `server.js` compone `DebateRepository` y `createDebateService` inyectando `userModel`, y después crea `createDebateRouter` con el servicio, `authMiddleware` e `isAdminMiddleware`. El router aplica autenticación opcional al `GET`: sin cabecera devuelve el muro público con `reactedByMe` en `false`; con token válido lo calcula para el usuario. `POST` y `POST /:id/react` exigen sesión, y la creación exige además rol administrador.

Las reacciones se guardan como arrays de `ObjectId` por tipo. Si el usuario ya había reaccionado, `DebateRepository.toggleReaction` ejecuta `$pull`; si no, `$addToSet`. La respuesta solo expone `count` y `reactedByMe`, nunca la lista de identificadores. En el frontend, `muro.html` usa `api.listarDebates()` al cargar y `api.reaccionarDebate(id, reaction)` al pulsar un botón; `muro.js` reutiliza las clases existentes y actualiza solo el contenedor de reacciones.

## Endpoints

| Método | Ruta | Quién puede |
|---|---|---|
| GET | `/api/auth/google` | Cualquiera |
| GET | `/api/auth/google/callback` | Proveedor OAuth |
| POST | `/api/registro` | Cualquiera |
| GET | `/api/auth/verify/:token` | Cualquiera con el enlace |
| POST | `/api/login` | Cualquiera |
| POST | `/api/logout` | Cualquiera; elimina el token si se envía |
| GET | `/api/session` | Usuario con sesión |
| GET | `/api/admin/dashboard` | Administrador con sesión |
| DELETE | `/api/users/:email` | Administrador con sesión |
| GET | `/api/users` | Administrador con sesión |
| POST | `/api/diario` | Usuario con sesión; crea una entrada propia con título opcional |
| GET | `/api/diario` | Usuario con sesión; lista solo sus entradas |
| DELETE | `/api/diario/:id` | Usuario con sesión; elimina solo un eco propio |
| POST | `/api/debates` | Administrador con sesión; crea un debate |
| GET | `/api/debates` | Público; con token válido añade `reactedByMe` |
| POST | `/api/debates/:id/react` | Usuario con sesión; alterna su reacción |
| POST | `/api/prueba/dominio` | Cualquiera |
