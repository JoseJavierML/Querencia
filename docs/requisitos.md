---
type: Requisitos
title: Requisitos del Sprint 1
description: Evaluación de los requisitos frente a la especificación y al repositorio.
timestamp: 2026-10-30
---

# Requisitos

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Separación cliente-servidor y mismo origen | hecho | `server.js` sirve `frontend` y el cliente usa `/api`. |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | `server.js`, `userModel.js` y `database.js`. |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | HTML separado de `frontend/js/api.js` y `frontend/js/auth.js`. |
| RF-01 | Registro de usuario local | hecho | `POST /api/registro` y `UserModel.create`. |
| RF-02 | Confirmación de cuenta por correo | parcial | `mailer.js`, token de confirmación y `/api/auth/verify/:token`; queda por verificar el envío real. |
| RF-03 | Inicio de sesión local | hecho | `POST /api/login`, comprobación del estado y del hash. |
| RF-04 | Inicio de sesión con OAuth | hecho | Passport Google en `server.js` y callback. |
| RF-05 | Cierre de sesión | hecho | `POST /api/logout` llama a `deleteToken`. |
| RF-06 | Mantenimiento de la sesión entre recargas | hecho | Token en `localStorage` y consulta de `/api/session`. |
| RF-07 | Listar usuarios (administrador) | hecho | `GET /api/users` está protegido por sesión y rol. |
| RF-08 | Comprobar si un usuario está activo (administrador) | pendiente | Existe `UserModel.isActive`, pero no se ha encontrado un endpoint administrativo para esta operación. |
| RF-09 | Eliminar usuario | hecho | `DELETE /api/users/:email` está protegido por sesión y rol. |
| RF-10 | Creación del primer administrador | pendiente | No se ha encontrado en el repositorio un mecanismo verificable para crear el primer administrador. |
| RNF-01 | Persistencia en una base de datos real | hecho | Mongoose conecta con MongoDB y `User` persiste los usuarios. |
| RNF-02 | Secretos fuera del código y .env.example | hecho | `.env.example` declara los nombres y el workflow usa secretos de GitHub. |
| RNF-03 | Hash seguro de contraseñas | hecho | `bcrypt.hash` y `bcrypt.compare` en `userModel.js`. |
| RNF-04 | Rutas protegidas por sesión y rol | hecho | `authMiddleware` e `isAdminMiddleware` protegen las rutas privadas. |
| RNF-05 | Despliegue en cloud con URL pública | parcial | Hay workflow y configuración de App Engine; la URL pública operativa queda por verificar. |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | `backend npm test -- --runInBand`: 2 suites, 10 tests pasados. |
| RNF-07 | Manejo de errores con feedback al usuario | hecho | Las rutas devuelven mensajes y `api.js` propaga errores al frontend. |
| RNF-08 | Registro de actividad (log) | hecho | Winston y Morgan se configuran en `logger.js` y `server.js`. |
| PRO-01 | Flujo de trabajo GitHub Flow | Por verificar | El historial muestra ramas y merges; revisar Pull requests de GitHub porque `gh` no está autenticado. |
| PRO-02 | Integración continua | hecho | [ci.yml](../.github/workflows/ci.yml) ejecuta `npm ci` y `npm test` en PR y en `main`. |
| PRO-03 | Despliegue continuo | parcial | El workflow despliega después de CI en `push` a `main`; la ejecución real queda por verificar. |

