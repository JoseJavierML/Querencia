---
type: Sprint
title: Sprint 2
description: Progreso de ejecución del Sprint 2, con los PBIs del MVP ya integrados y el trabajo que sigue abierto.
timestamp: 2026-11-05
---

# Sprint 2

## Estado general

El Sprint 2 sigue en curso. Esta página recoge una actualización intermedia de progreso: los PBIs de Diario, Muro y El Velo ya están implementados, probados e integrados en la rama principal, pero el sprint no está cerrado. Quedan abiertos los requisitos heredados del Sprint 1 y las verificaciones de correo, despliegue y proceso.

## Objetivo

Consolidar el MVP funcional de Querencia: un diario íntimo privado, un muro de debates con roles y reacciones semánticas, y El Velo como escucha ciega diaria. El objetivo incluye mantener la suite automatizada, la documentación y el flujo de ramas al día.

## PBIs completados e integrados

### Diario Íntimo

- **RF-MVP-Diario / RF-MVP-Diario-Frontend.** Esquema `DiaryEntry` con `userId` como `ObjectId` de `User`; `POST`, `GET` y `DELETE /api/diario` protegidos por `authMiddleware`.
- **Aislamiento de datos por usuario.** El listado solo devuelve las entradas del usuario autenticado y el borrado usa `findOneAndDelete({ _id, userId })`; un eco ajeno o inexistente responde `404` sin distinguir ambos casos.
- Título opcional de hasta 50 caracteres, texto obligatorio de 1 a 5000, historial “Ecos” con extracto de 40 caracteres y lectura completa de cada entrada.

### Muro de Debates

- **RF-MVP-Muro.** Modelo `Debate` con autor, portada opcional, anonimato y tres reacciones semánticas almacenadas como arrays de `ObjectId`: `profundo` (“Profundo”), `melancolico` (“Melancólico”) y `rompeEsquemas` (“Rompe esquemas”). El toggle se resuelve con `$pull` y `$addToSet`, sin duplicar votos.
- **Gestión de roles y UI de administración.** Solo `admin` puede crear y borrar reflexiones. El botón flotante con el lápiz, el diálogo de creación y las papeleras de las tarjetas se insertan en el DOM únicamente para administradores; el backend mantiene la autorización con `authMiddleware` e `isAdminMiddleware` y responde `403` a cualquier otro rol.
- **Truncado expansible en modal.** Las reflexiones de más de 250 caracteres se muestran colapsadas con “Leer más”. El modal de lectura completa usa backdrop oscurecido y estética glassmorphism, se cierra con la “X”, el fondo o `Escape` y restaura el punto de scroll previo.
- **Portadas y autor.** `coverImageUrl` opcional mediante URL externa, con placeholder de respaldo; el autor no anónimo se muestra sin el dominio del correo y `isAnonymous` oculta `authorEmail` en la respuesta.

### El Velo

- **RF-MVP-Velo.** Modelo `VeloTrack` con una pista única por fecha (`releaseDate` normalizada a medianoche UTC), `audioUrl`, `title`, `artist`, `coverUrl` y un array de reflexiones con `userId` y `text`.
- `GET /api/velo/today` devuelve exclusivamente `audioUrl` hasta que el usuario participa; después revela metadatos y todas las voces. `POST /api/velo/today/reflect` guarda una reflexión de 1 a 5000 caracteres y responde `409` ante un segundo envío.
- **Panel de encolado para administradores.** `admin.html` y `admin.js` incorporan “La Cola del Velo” con alta para hoy o fechas futuras, listado con estado (`past`, `today`, `future`), número de reflexiones y edición de pistas no pasadas. `POST`, `GET` y `PUT /api/velo/tracks` exigen rol `admin`.

## Verificación

- Suite automatizada: **11 suites y 169 tests pasados** con `npm test -- --runInBand`.
- Comprobación de sintaxis de los módulos frontend y de los archivos Node nuevos y modificados.
- Revisión manual pendiente: flujo completo en navegador con MongoDB y una sesión real, y verificación de la URL pública.

## Trabajo abierto

- **RF-02:** verificar el envío real del correo de confirmación en el entorno público.
- **RF-08:** añadir y comprobar el endpoint administrativo para saber si un usuario está activo.
- **RF-10:** definir y comprobar el procedimiento para crear el primer administrador.
- **RNF-05:** comprobar el despliegue cloud y la URL pública.
- **PRO-01:** revisar Pull requests de GitHub para confirmar el flujo GitHub Flow.
- **PRO-03:** comprobar ejecuciones reales del despliegue continuo.
- Conciliar la sesión en memoria de `authMiddleware.js` con el despliegue multiinstancia o completar la decisión JWT.
- Resolver la discrepancia documental pendiente sobre el destino de despliegue.

## Próximos pasos

1. Completar las verificaciones manuales del MVP en un entorno con MongoDB.
2. Cerrar los requisitos heredados del Sprint 1.
3. Revisar la retrospectiva del sprint y consolidar la documentación de cierre.
