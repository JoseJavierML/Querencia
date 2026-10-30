---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas comprobables del backend y del frontend, con su frontera HTTP.
timestamp: 2026-10-30
---

# Arquitectura

## Backend

- **API/presentación:** [server.js](../backend/server.js) define las rutas HTTP, valida entradas básicas y construye respuestas.
- **Lógica de aplicación:** [userModel.js](../backend/userModel.js), [authMiddleware.js](../backend/authMiddleware.js), [adminMiddleware.js](../backend/adminMiddleware.js) y [domainLogic.js](../backend/domainLogic.js) gestionan usuarios, sesión, roles y dominios.
- **Datos:** [database.js](../backend/database.js) conecta Mongoose con MongoDB; `userModel.js` usa el modelo persistente `User`.
- **Servicios transversales:** [logger.js](../backend/logger.js) registra actividad y [mailer.js](../backend/mailer.js) prepara el correo de confirmación.

## Frontend

- **Presentación:** las páginas HTML de [backend/frontend/](../backend/frontend/) contienen las vistas pública, privada y de administración.
- **Comunicación:** [api.js](../backend/frontend/js/api.js) centraliza las peticiones de negocio y [auth.js](../backend/frontend/js/auth.js) añade el token, comprueba la sesión y cierra sesión.

## Frontera exacta

El frontend llama a rutas relativas que empiezan por `/api`. Express las recibe en `server.js`; allí se aplican `authMiddleware` y, cuando corresponde, `isAdminMiddleware`, antes de delegar en el modelo o la lógica. Las páginas estáticas se sirven desde `frontend` mediante `express.static`.

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
| POST | `/api/prueba/dominio` | Cualquiera |
