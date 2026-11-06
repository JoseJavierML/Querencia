---
type: Arquitectura
title: Arquitectura del MVP (Sprint 2 en curso)
description: Capas comprobables del backend y del frontend, modelos de Mongoose, servicio de caché de El Archivo y endpoints consolidados.
timestamp: 2026-11-06
---

# Arquitectura

## Backend

- **API/presentación:** [server.js](../backend/server.js) define las rutas HTTP, valida entradas básicas y construye respuestas; [diaryRouter.js](../backend/diaryRouter.js) expone las rutas del diario, [debateRouter.js](../backend/debateRouter.js) expone las del muro, [veloRouter.js](../backend/veloRouter.js) expone la escucha ciega y la administración de su cola, y [archivoRouter.js](../backend/archivoRouter.js) expone los cajones, el detalle y la búsqueda de El Archivo, traduciendo errores de dominio a HTTP.
- **Lógica de aplicación:** [userModel.js](../backend/userModel.js), [authMiddleware.js](../backend/authMiddleware.js), [adminMiddleware.js](../backend/adminMiddleware.js), [domainLogic.js](../backend/domainLogic.js), [diaryService.js](../backend/diaryService.js), [debateService.js](../backend/debateService.js), [debateConstants.js](../backend/debateConstants.js), [veloService.js](../backend/veloService.js), [veloConstants.js](../backend/veloConstants.js), [archivoService.js](../backend/archivoService.js), [archivoConstants.js](../backend/archivoConstants.js) y [archivoUtils.js](../backend/archivoUtils.js) gestionan usuarios, sesión, roles, dominios, entradas del diario, debates, pistas del Velo, reflexiones a ciegas, normalización musical y caché de El Archivo.
- **Datos:** [database.js](../backend/database.js) conecta Mongoose con MongoDB; `userModel.js` usa el modelo persistente `User`, [diaryModel.js](../backend/diaryModel.js) define `DiaryEntry` con referencia a `User`, [debateModel.js](../backend/debateModel.js) define `Debate` con autor, portada opcional (`coverImageUrl`), flag de anonimato (`isAnonymous`) y reacciones como arrays de `ObjectId`, [veloTrackModel.js](../backend/veloTrackModel.js) define `VeloTrack` con una pista única por fecha, metadatos musicales y un array de reflexiones con `userId` y `text`, y [vinylModel.js](../backend/vinylModel.js) define `Vinyl` con la ficha musical, la clave de catálogo única y el repositorio de caché.
- **Datos de desarrollo:** [seedDebate.js](../backend/seedDebate.js) crea un debate inicial idempotente con portada musical. Reutiliza un administrador existente o crea un autor técnico si la base de datos todavía no tiene ninguno.
- **Servicios transversales:** [logger.js](../backend/logger.js) registra actividad y [mailer.js](../backend/mailer.js) prepara el correo de confirmación.

## Modelos de datos

Mongoose define las colecciones persistentes del MVP. Los repositorios encapsulan las consultas y los servicios de dominio no importan Express ni Mongoose.

- **`User`** ([userModel.js](../backend/userModel.js)): `email` único, contraseña hasheada con bcrypt, `role` (`usuario` por defecto), `status` y `verificationToken`.
- **`DiaryEntry`** ([diaryModel.js](../backend/diaryModel.js)): `userId` como `ObjectId` de `User`, `text`, `title` opcional y `createdAt` generado por el servidor. La consulta por `userId` sostiene el aislamiento del diario.
- **`Debate`** ([debateModel.js](../backend/debateModel.js)): `title` y `content` obligatorios, `coverImageUrl` opcional, `isAnonymous` booleano con `false` por defecto, `authorId` como `ObjectId` de `User` y `createdAt`. `reactions` es un subesquema con tres arrays de `ObjectId`: `profundo`, `melancolico` y `rompeEsquemas`.
- **`VeloTrack`** ([veloTrackModel.js](../backend/veloTrackModel.js)): `releaseDate` obligatoria y única, `audioUrl`, `title`, `artist`, `coverUrl` opcional y `createdAt`. `reflections` es un array de subdocumentos con `userId` como `ObjectId` de `User`, `text` y `createdAt`; la unicidad de `releaseDate` impide dos pistas para el mismo día.
- **`Vinyl`** ([vinylModel.js](../backend/vinylModel.js)): `title` y `artist` obligatorios, `album` y `coverUrl` opcionales, `genre` normalizado, `youtubeVideoId` opcional pero validado, `lastFmInfo` como subdocumento sin `_id`, `catalogKey` obligatoria y única, `createdAt`, `updatedAt` y `lastAccessedAt`. El repositorio encapsula la búsqueda por clave, el listado filtrado, el `upsert` atómico, la actualización por identificador y el registro del último acceso.

## Frontend

- **Presentación:** las páginas HTML de [backend/frontend/](../backend/frontend/) contienen las vistas pública, privada, de administración y de escucha ciega; [diario.html](../backend/frontend/diario.html) renderiza el historial “Ecos”, el formulario de escritura con título opcional y la vista de lectura de cada eco; [muro.html](../backend/frontend/muro.html) y [muro.js](../backend/frontend/js/muro.js) renderizan las tarjetas de debate, sus portadas, sus reacciones, el autor sin dominio de correo, el botón flotante con el lápiz y el diálogo de creación que solo existen para administradores; [velo.html](../backend/frontend/velo.html) y [velo.js](../backend/frontend/js/velo.js) implementan los estados ciego y revelado de la escucha diaria, el reproductor, el formulario de reflexión y el muro de voces. El diálogo del muro incluye la casilla “Publicar como anónimo”; en el formulario de creación, solo el textarea usa el scrollbar fino dorado del Diario, sin scroll propio en el contenedor del diálogo. Las reflexiones largas del muro se muestran colapsadas y “Leer más” abre un modal de lectura completa sobre un backdrop oscurecido. El Archivo se implementa en esta iteración exclusivamente en backend: no se añaden todavía páginas, componentes ni llamadas de `api.js` para sus cajones.
- **Comunicación:** [api.js](../backend/frontend/js/api.js) centraliza las peticiones de negocio, incluidas `crearEntradaDiario`, `listarDiario`, `eliminarEntradaDiario`, `crearDebate`, `eliminarDebate`, `listarDebates`, `reaccionarDebate`, `obtenerVeloDelDia`, `reflexionarVelo`, `crearPistaVelo`, `listarPistasVelo` y `actualizarPistaVelo`, y [auth.js](../backend/frontend/js/auth.js) añade el token, comprueba la sesión y cierra sesión.

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

En El Velo, `server.js` compone `VeloRepository` y `createVeloService` inyectando `userModel`, y después crea `createVeloRouter` con el servicio, `authMiddleware` e `isAdminMiddleware`. `GET /api/velo/today` resuelve primero el `ObjectId` del usuario y busca la pista cuya `releaseDate` coincide con el día actual. Si el `userId` no aparece en `reflections`, la respuesta contiene exclusivamente `audioUrl`; si ya participó, devuelve los metadatos y todas las reflexiones. `POST /api/velo/today/reflect` valida y recorta el texto, comprueba que no exista una reflexión previa del mismo usuario y añade el subdocumento con una actualización atómica que filtra por `reflections.userId: { $ne: userId }`. La participación repetida responde `409`. Las reflexiones se devuelven con `text`, `userId` e `isMine`, calculado en el router, pero nunca con el correo.

La fecha diaria se calcula con `Intl.DateTimeFormat` en `Europe/Madrid` y se normaliza a medianoche UTC antes de guardarla. El modelo declara `releaseDate` como único, de modo que no puede haber dos pistas para el mismo día. Los endpoints administrativos `POST /api/velo/tracks`, `GET /api/velo/tracks` y `PUT /api/velo/tracks/:id` exigen sesión y rol `admin`; el listado añade el estado `past`, `today` o `future`, y la edición bloquea las pistas pasadas para preservar el histórico. Un intento de duplicar fecha responde `409`.

En el frontend, `velo.html` mantiene dos estados excluyentes. El estado ciego solo monta el reproductor y el textarea; no inserta título, artista ni portada en el DOM. `velo.js` usa `api.obtenerVeloDelDia()` al cargar y `api.reflexionarVelo(text)` al enviar. Cuando la API responde con la pista revelada, se renderizan la portada, los metadatos, el reproductor y el muro de reflexiones con `textContent`; la reflexión propia se marca como “Tu reflexión” y las demás se numeran como “Voz 01”, “Voz 02”, etc. El reproductor usa `<audio controls>` para archivos directos y transforma los enlaces conocidos de YouTube, Spotify, SoundCloud, Vimeo y Bandcamp en iframes embebibles que no muestran los metadatos antes de tiempo.

La administración de la cola vive en `admin.html` y `admin.js`: el formulario permite programar una pista para hoy o para una fecha futura, la tabla muestra fecha, título, artista, número de reflexiones y estado, y el botón “Editar” rellena el mismo formulario para actualizar una pista no pasada. `api.js` centraliza las llamadas `crearPistaVelo`, `listarPistasVelo` y `actualizarPistaVelo`.

El login de `index.html` y el callback de Google redirigen a `muro.html`. El registro intenta iniciar sesión automáticamente para entrar al muro; si la cuenta sigue pendiente de verificación, muestra el aviso y no crea una sesión ficticia.

El seed se ejecuta con `node backend/seedDebate.js` desde la raíz o con `npm run seed` desde `backend`. Conecta directamente con Mongoose, busca un debate por título para no duplicarlo, completa la portada si el debate ya existía sin ella y resuelve el autor con `SEED_AUTHOR_EMAIL`, con el primer administrador o con un autor técnico `seed@querencia.local`. No imprime credenciales y cierra la conexión al terminar.

## El Archivo — arquitectura de la discoteca interactiva

### Composición y frontera

`server.js` compone `VinylRepository` y `createArchivoService` sin que el servicio importe Express ni Mongoose. Después construye `createArchivoRouter` con el servicio y `authMiddleware`. El router solo conoce el contrato del servicio, y el servicio solo conoce el contrato del repositorio y un `fetchImpl` inyectable. Esta separación permite probar la lógica de caché con dobles de red y de base de datos, sin levantar MongoDB ni consumir APIs reales.

La frontera HTTP queda fijada en `/api/archivo`. Las tres rutas aplican autenticación mediante `router.use(authMiddleware)`: la búsqueda externa no queda expuesta a visitantes anónimos y los cajones y el detalle conservan el mismo nivel de acceso que El Velo. La autorización de roles no interviene porque El Archivo es una función de consulta y escucha, no de administración.

### Modelo `Vinyl` y repositorio

El esquema `Vinyl` declara dos campos obligatorios de identidad visible (`title` y `artist`), un campo de publicación (`album`), una portada externa (`coverUrl`), un género normalizado (`genre`), el identificador de reproducción (`youtubeVideoId`), un subdocumento `lastFmInfo` y una clave de catálogo (`catalogKey`). El subdocumento `lastFmInfo` usa `_id: false` porque pertenece al vinilo y no necesita identidad propia:

| Campo de `lastFmInfo` | Contenido |
|---|---|
| `mbid` | Identificador MusicBrainz devuelto por Last.fm. |
| `url` | URL canónica de la ficha en Last.fm, validada como `http` o `https`. |
| `listeners` | Número de oyentes, normalizado a entero no negativo. |
| `playcount` | Número de reproducciones, normalizado a entero no negativo. |
| `duration` | Duración en segundos, o `null` si no se conoce. |
| `published` | Fecha editorial de la ficha de Last.fm. |
| `summary` | Resumen biográfico o descriptivo sin HTML. |
| `tags` | Etiquetas normalizadas y limitadas. |
| `album` | Álbum de referencia. |
| `fetchedAt` | Momento de la última extracción externa; alimenta el TTL. |

`catalogKey` se calcula con `buildCatalogKey(artist, title)` en [archivoUtils.js](../backend/archivoUtils.js). La función elimina tildes y signos, convierte a minúsculas, separa palabras con guiones y compone `artista::titulo`. El índice único del campo impide duplicados aunque dos peticiones lleguen simultáneamente. El hook `pre('validate')` recalcula la clave a partir de los campos visibles para que un documento creado directamente con `new Vinyl(...)` tampoco pueda quedar sin clave.

`VinylRepository` encapsula las operaciones de persistencia: `findByCatalogKey`, `findById`, `findAll`, `create`, `upsertByCatalogKey`, `updateById` y `touchById`. El `upsert` usa `findOneAndUpdate` con `$set`, `$setOnInsert`, `upsert: true` y `runValidators: true`. El `updatedAt` se renueva en cada escritura, mientras que `createdAt` solo se fija en la inserción. Las actualizaciones de refresco conservan la clave original del documento para no crear una segunda ficha si Last.fm devuelve una variante tipográfica del título.

### Servicio externo y adaptadores

`archivoService.js` define un servicio inyectable con `createArchivoService`. La inyección de `fetchImpl`, `now`, `logger`, las claves y los endpoints permite reproducir escenarios de error sin red. El servicio no persiste ni responde HTTP: normaliza, decide, delega y devuelve un resultado de dominio.

El adaptador de Last.fm construye una URL sobre `LASTFM_API_URL`, añade `method`, `api_key`, `format=json` y los parámetros de cada operación. La búsqueda usa `track.search` con un máximo de cinco candidatos; la selección puntúa coincidencias exactas de artista y título y conserva el orden de relevancia cuando no hay coincidencia exacta. La ficha se completa con `track.getInfo`, que aporta álbum, etiquetas, resumen, duración y portada. Si `track.getInfo` falla pero la búsqueda devolvió un candidato, el servicio continúa con los datos de búsqueda y registra el incidente. Si no hay ningún candidato, devuelve un error de dominio de tipo “no encontrado”.

El adaptador de YouTube tiene dos niveles. El primero es YouTube Data API: si `YOUTUBE_API_KEY` existe, consulta `search` con `part=snippet`, `type=video`, `videoCategoryId=10` y `maxResults=1`, y valida que el identificador tenga once caracteres. El segundo es un fallback de scraping sobre `https://www.youtube.com/results?search_query=...` que solo se ejecuta si `YOUTUBE_SCRAPING_ENABLED` no está desactivado. El fallback busca un `videoId` o un enlace `/watch?v=` en el HTML. Cualquier fallo de YouTube se registra y se traduce en `youtubeVideoId: null`; no invalida la ficha cultural ni impide guardar el vinilo.

Los errores del servicio se clasifican para que el router pueda responder con precisión: `ArchivoValidationError` para entradas inválidas, `ArchivoNotFoundError` para discos inexistentes, `ArchivoConfigurationError` para claves ausentes o rechazadas, `ArchivoTimeoutError` para abortos por tiempo y `ArchivoUpstreamError` para fallos de red, estados HTTP no satisfactorios o respuestas malformadas. El router traduce estas clases a `400`, `404`, `503`, `504` y `502`, respectivamente.

### Flujo de caché

El flujo se diseña como cache-aside con escritura de refresco:

1. Normalización de la entrada y cálculo de la clave cuando el cliente envía artista y título.
2. Lectura de MongoDB. Si la ficha está vigente, se devuelve sin consultar Last.fm y se actualiza `lastAccessedAt`. Si falta el audio, se intenta resolver con YouTube como máximo una vez al día para no consumir cuota en cada búsqueda.
3. Si la ficha está caducada, se llama a `track.getInfo` y, si el audio aún no existe, a YouTube. La actualización se hace por `_id`, no por `catalogKey`, para evitar duplicados si cambia la grafía canónica.
4. Si el refresco falla, se devuelve la ficha anterior con `stale: true`. La lectura sigue disponible aunque Last.fm esté caído o la cuota esté agotada.
5. Si no hay ficha, se resuelve el candidato en Last.fm, se completa con `track.getInfo`, se intenta YouTube y se ejecuta `upsertByCatalogKey`.
6. Si el `upsert` choca con el índice único porque otra petición ganó la carrera, el servicio vuelve a leer por `catalogKey` y devuelve la ficha existente. La operación es idempotente desde el punto de vista del cliente.

La vigencia se calcula con `lastFmInfo.fetchedAt` y, si falta, con `updatedAt` o `createdAt`. El TTL por defecto es de treinta días. La decisión de usar un TTL largo se justifica porque los metadatos musicales cambian poco y porque el coste de una ficha obsoleta es menor que el de agotar una cuota gratuita. El detalle completo de la justificación económica está en [decisiones.md](decisiones.md).

### Cajones y contrato de respuesta

El servicio `getDrawers` obtiene los vinilos filtrados por género o artista y construye la agrupación en memoria con un `Map`. La respuesta conserva la forma `{ agrupacion, total, cajones }`; cada cajón contiene `clave`, `etiqueta`, `total` y `vinilos`. La clave es un slug estable, la etiqueta es el valor visible y los vinilos se ordenan por artista y título. La agrupación por género usa el campo normalizado, de modo que Last.fm puede devolver etiquetas como “flamenco”, “copla” o “bulerías” y todas ellas se presentan bajo el cajón “Flamenco” cuando el mapa de géneros las reconoce.

El detalle de un disco devuelve la ficha completa, incluida `lastFmInfo` y `catalogKey`, más `playable`, un booleano derivado de la presencia de `youtubeVideoId`. La búsqueda devuelve `{ disco, cached, created, stale }`. El estado HTTP es `201` cuando se inserta una ficha y `200` cuando se reutiliza una existente, aunque el cuerpo conserva los tres indicadores para que el cliente pueda mostrar el origen del dato.

### Variables y operación

La configuración vive en `backend/.env` y se documenta en `backend/.env.example`. Las claves `LASTFM_API_KEY` y `YOUTUBE_API_KEY` no se envían al navegador ni se guardan en MongoDB. `ARCHIVO_CACHE_TTL_DAYS` y `ARCHIVO_HTTP_TIMEOUT_MS` permiten ajustar la política sin modificar código. `LASTFM_API_URL`, `YOUTUBE_API_URL` y `YOUTUBE_SEARCH_URL` existen para pruebas controladas y para adaptar el servicio a un proxy o a un entorno de integración.

## Endpoints

`server.js` monta cuatro routers de dominio bajo `/api/diario`, `/api/debates`, `/api/velo` y `/api/archivo`. Las rutas de autenticación, usuarios y administración siguen definidas directamente en `server.js`.

### Autenticación, usuarios y administración

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
| GET | `/api/users` | Administrador con sesión |
| DELETE | `/api/users/:email` | Administrador con sesión |
| POST | `/api/prueba/dominio` | Cualquiera |

### Diario

| Método | Ruta | Quién puede |
|---|---|---|
| POST | `/api/diario` | Usuario con sesión; crea una entrada propia con título opcional |
| GET | `/api/diario` | Usuario con sesión; lista solo sus entradas |
| DELETE | `/api/diario/:id` | Usuario con sesión; elimina solo un eco propio |

### Muro

| Método | Ruta | Quién puede |
|---|---|---|
| POST | `/api/debates` | Administrador con sesión; crea un debate con portada opcional y anonimato opcional |
| GET | `/api/debates` | Público; con token válido añade `reactedByMe`; cada reacción incluye `label` y el debate incluye `coverImageUrl` e `isAnonymous`; `authorEmail` es `null` si es anónimo |
| DELETE | `/api/debates/:id` | Administrador con sesión; elimina un debate |
| POST | `/api/debates/:id/react` | Usuario con sesión; alterna su reacción y devuelve `label`, `count` y `reactedByMe` |

### El Velo

| Método | Ruta | Quién puede |
|---|---|---|
| GET | `/api/velo/today` | Usuario con sesión; devuelve solo `audioUrl` si no ha reflexionado, o la pista revelada con las reflexiones si ya participó; `404` si no hay pista hoy |
| POST | `/api/velo/today/reflect` | Usuario con sesión; guarda una reflexión de 1 a 5000 caracteres y devuelve la pista revelada; `409` si ya había participado |
| POST | `/api/velo/tracks` | Administrador con sesión; programa una pista única para una fecha de hoy o futura |
| GET | `/api/velo/tracks` | Administrador con sesión; lista la cola con estado y número de reflexiones |
| PUT | `/api/velo/tracks/:id` | Administrador con sesión; edita una pista de hoy o futura; las pasadas son inmutables |

### El Archivo

| Método | Ruta | Quién puede |
|---|---|---|
| GET | `/api/archivo/cajones` | Usuario con sesión; agrupa por `genero` (por defecto) o `artista`; admite filtros `genero` y `artista`; devuelve `{ agrupacion, total, cajones }` |
| GET | `/api/archivo/disco/:id` | Usuario con sesión; devuelve la ficha completa con `lastFmInfo`, `catalogKey` y `playable`; `400` si el identificador no es válido y `404` si no existe |
| POST | `/api/archivo/buscar` | Usuario con sesión; recibe `{ query }` o `{ artist, title }`; responde `201` si crea la ficha y `200` si reutiliza la caché, con `{ disco, cached, created, stale }`; `400`, `502`, `503` o `504` ante entradas o proveedores no disponibles |
