---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas comprobables del backend y del frontend, con su frontera HTTP.
timestamp: 2026-10-30
---

# Arquitectura

## Backend

- **API/presentación:** [server.js](../backend/server.js) define las rutas HTTP, valida entradas básicas y construye respuestas; [diaryRouter.js](../backend/diaryRouter.js) expone las rutas del diario y traduce errores de dominio a HTTP.
- **Lógica de aplicación:** [userModel.js](../backend/userModel.js), [authMiddleware.js](../backend/authMiddleware.js), [adminMiddleware.js](../backend/adminMiddleware.js), [domainLogic.js](../backend/domainLogic.js) y [diaryService.js](../backend/diaryService.js) gestionan usuarios, sesión, roles, dominios y entradas del diario.
- **Datos:** [database.js](../backend/database.js) conecta Mongoose con MongoDB; `userModel.js` usa el modelo persistente `User` y [diaryModel.js](../backend/diaryModel.js) define `DiaryEntry` con referencia a `User`.
- **Servicios transversales:** [logger.js](../backend/logger.js) registra actividad y [mailer.js](../backend/mailer.js) prepara el correo de confirmación.

## Frontend

- **Presentación:** las páginas HTML de [backend/frontend/](../backend/frontend/) contienen las vistas pública, privada y de administración.
- **Comunicación:** [api.js](../backend/frontend/js/api.js) centraliza las peticiones de negocio y [auth.js](../backend/frontend/js/auth.js) añade el token, comprueba la sesión y cierra sesión.

## Frontera exacta

El frontend llama a rutas relativas que empiezan por `/api`. Express las recibe en `server.js`; allí se aplican `authMiddleware` y, cuando corresponde, `isAdminMiddleware`, antes de delegar en el modelo o la lógica. Las páginas estáticas se sirven desde `frontend` mediante `express.static`.

En el diario, `server.js` actúa como composición: crea `DiaryRepository` y `createDiaryService` inyectando `userModel`, y después crea `createDiaryRouter` con el servicio y `authMiddleware`. Así `diaryService.js` no importa Express ni Mongoose, y `diaryRouter.js` no accede a la base de datos.

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
| POST | `/api/diario` | Usuario con sesión; crea una entrada propia |
| GET | `/api/diario` | Usuario con sesión; lista solo sus entradas |
| POST | `/api/prueba/dominio` | Cualquiera |
