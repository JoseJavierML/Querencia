---
type: Arquitectura
title: Arquitectura del Sprint 1
description: Capas comprobables del backend y del frontend, con su frontera HTTP.
timestamp: 2026-11-02
---

# Arquitectura

## Backend

- **API/presentación:** [server.js](../backend/server.js) define las rutas HTTP, valida entradas básicas y construye respuestas; [diaryRouter.js](../backend/diaryRouter.js) expone las rutas del diario y [debateRouter.js](../backend/debateRouter.js) expone las del muro, traduciendo errores de dominio a HTTP.
- **Lógica de aplicación:** [userModel.js](../backend/userModel.js), [authMiddleware.js](../backend/authMiddleware.js), [adminMiddleware.js](../backend/adminMiddleware.js), [domainLogic.js](../backend/domainLogic.js), [diaryService.js](../backend/diaryService.js), [debateService.js](../backend/debateService.js) y [debateConstants.js](../backend/debateConstants.js) gestionan usuarios, sesión, roles, dominios, entradas del diario y debates.
- **Datos:** [database.js](../backend/database.js) conecta Mongoose con MongoDB; `userModel.js` usa el modelo persistente `User`, [diaryModel.js](../backend/diaryModel.js) define `DiaryEntry` con referencia a `User` y [debateModel.js](../backend/debateModel.js) define `Debate` con autor, portada opcional (`coverImageUrl`), flag de anonimato (`isAnonymous`) y reacciones como arrays de `ObjectId`.
- **Datos de desarrollo:** [seedDebate.js](../backend/seedDebate.js) crea un debate inicial idempotente con portada musical. Reutiliza un administrador existente o crea un autor técnico si la base de datos todavía no tiene ninguno.
- **Servicios transversales:** [logger.js](../backend/logger.js) registra actividad y [mailer.js](../backend/mailer.js) prepara el correo de confirmación.

## Frontend

- **Presentación:** las páginas HTML de [backend/frontend/](../backend/frontend/) contienen las vistas pública, privada y de administración; [diario.html](../backend/frontend/diario.html) renderiza el historial “Ecos”, el formulario de escritura con título opcional y la vista de lectura de cada eco; [muro.html](../backend/frontend/muro.html) y [muro.js](../backend/frontend/js/muro.js) renderizan las tarjetas de debate, sus portadas, sus reacciones, el autor sin dominio de correo, el botón flotante con el lápiz y el diálogo de creación que solo existen para administradores. El diálogo incluye la casilla “Publicar como anónimo”; en el formulario de creación, solo el textarea usa el scrollbar fino dorado del Diario, sin scroll propio en el contenedor del diálogo. Las reflexiones largas se muestran colapsadas y “Leer más” abre un modal de lectura completa sobre un backdrop oscurecido.
- **Comunicación:** [api.js](../backend/frontend/js/api.js) centraliza las peticiones de negocio, incluidas `crearEntradaDiario`, `listarDiario`, `eliminarEntradaDiario`, `crearDebate`, `eliminarDebate`, `listarDebates` y `reaccionarDebate`, y [auth.js](../backend/frontend/js/auth.js) añade el token, comprueba la sesión y cierra sesión.

## Frontera exacta

El frontend llama a rutas relativas que empiezan por `/api`. Express las recibe en `server.js`; allí se aplican `authMiddleware` y, cuando corresponde, `isAdminMiddleware`, antes de delegar en el modelo o la lógica. Las páginas estáticas se sirven desde `frontend` mediante `express.static`.

En el diario, `server.js` actúa como composición: crea `DiaryRepository` y `createDiaryService` inyectando `userModel`, y después crea `createDiaryRouter` con el servicio y `authMiddleware`. Así `diaryService.js` no importa Express ni Mongoose, y `diaryRouter.js` no accede a la base de datos.

El borrado usa `DiaryRepository.deleteByIdForUser(id, userId)`, que ejecuta `findOneAndDelete({ _id: id, userId })`. La consulta incluye la propiedad del eco, de modo que un usuario no puede borrar entradas ajenas. Si el eco no existe o pertenece a otro usuario, la API responde `404` sin distinguir ambos casos.

En el frontend, `diario.html` no llama a `fetch` directamente: usa `api.listarDiario()` al cargar la página, `api.crearEntradaDiario(text, title)` al enviar el formulario y `api.eliminarEntradaDiario(id)` al borrar un eco. `api.js` usa rutas relativas `/api` y `fetchAutenticado`, que añade `Authorization: Bearer` desde `localStorage` y gestiona el `401`.

En el muro, `server.js` compone `DebateRepository` y `createDebateService` inyectando `userModel`, y después crea `createDebateRouter` con el servicio, `authMiddleware` e `isAdminMiddleware`. El router aplica autenticación opcional al `GET`: sin cabecera devuelve el muro público con `reactedByMe` en `false`; con token válido lo calcula para el usuario. `POST`, `DELETE /:id` y `POST /:id/react` exigen sesión, y la creación y el borrado exigen además rol administrador. `DELETE` delega en `DebateRepository.deleteById`, que valida el `ObjectId` y usa `findByIdAndDelete`; si no encuentra el debate, el servicio lanza `DebateNotFoundError` y el router responde `404`. `POST` acepta `isAnonymous` como booleano opcional; el servicio lo normaliza a `false` cuando falta y rechaza valores de otro tipo.

Las reacciones se guardan como arrays de `ObjectId` por tipo. El catálogo vive en `debateConstants.js` con tres claves y sus etiquetas exactas: `profundo` (“Profundo”), `melancolico` (“Melancólico”) y `rompeEsquemas` (“Rompe esquemas”). Si el usuario ya había reaccionado, `DebateRepository.toggleReaction` ejecuta `$pull`; si no, `$addToSet`. La respuesta expone `label`, `count`, `reactedByMe`, `coverImageUrl` e `isAnonymous`, nunca la lista de identificadores. En el frontend, `muro.html` usa `api.listarDebates()` al cargar, `api.reaccionarDebate(id, reaction)` al pulsar un botón, `api.crearDebate(title, content, coverImageUrl, isAnonymous)` desde el diálogo del botón flotante y `api.eliminarDebate(id)` desde la papelera de cada tarjeta. `muro.js` reutiliza las clases existentes, actualiza solo el contenedor de reacciones y construye el botón flotante, el diálogo y las papeleras solo cuando `obtenerUsuarioActual()` devuelve rol `admin`; para un oyente no inserta ninguno de esos nodos.

Las reflexiones de más de 250 caracteres se renderizan colapsadas: `muro.js` muestra un recorte de 250 caracteres con `...` y añade un botón “Leer más”. La tarjeta y el botón abren `crearModalLectura`, un diálogo único creado al cargar el módulo que muestra título, autor, fecha y contenido completo. El modal bloquea el scroll del documento, guarda la posición previa y la restaura al cerrar mediante la “X”, el backdrop o `Escape`; los clics en `.reactions-container` y `.debate-delete` se excluyen para no interferir con las reacciones ni con el borrado.

Los avisos de `mostrarEstado` usan la clase `is-visible` y una transición CSS de opacidad y desplazamiento. Salvo los mensajes persistentes de carga, error de carga y muro vacío, cada aviso se oculta con `setTimeout` a los 3,5 segundos y se marca como `hidden` al terminar la transición de 350 ms.

La portada se guarda como `coverImageUrl` opcional. El servicio recorta la URL, limita su longitud y exige los protocolos `http` o `https`; el modelo aplica además `trim` y `maxlength`. Si la tarjeta no tiene portada o la imagen falla, el frontend usa el placeholder existente.

El autor visible se obtiene del correo recortando su dominio (`admin@querencia.es` se muestra como `admin`). Si `isAnonymous` es `true`, el router devuelve `authorEmail: null`, la tarjeta muestra “Publicado por Anónimo” y la API no filtra el correo del autor.

El login de `index.html` y el callback de Google redirigen a `muro.html`. El registro intenta iniciar sesión automáticamente para entrar al muro; si la cuenta sigue pendiente de verificación, muestra el aviso y no crea una sesión ficticia.

El seed se ejecuta con `node backend/seedDebate.js` desde la raíz o con `npm run seed` desde `backend`. Conecta directamente con Mongoose, busca un debate por título para no duplicarlo, completa la portada si el debate ya existía sin ella y resuelve el autor con `SEED_AUTHOR_EMAIL`, con el primer administrador o con un autor técnico `seed@querencia.local`. No imprime credenciales y cierra la conexión al terminar.

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
| POST | `/api/debates` | Administrador con sesión; crea un debate con portada opcional y anonimato opcional |
| GET | `/api/debates` | Público; con token válido añade `reactedByMe`; cada reacción incluye `label` y el debate incluye `coverImageUrl` e `isAnonymous`; `authorEmail` es `null` si es anónimo |
| DELETE | `/api/debates/:id` | Administrador con sesión; elimina un debate |
| POST | `/api/debates/:id/react` | Usuario con sesión; alterna su reacción y devuelve `label`, `count` y `reactedByMe` |
| POST | `/api/prueba/dominio` | Cualquiera |
