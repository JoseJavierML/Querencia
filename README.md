# Querencia

SaaS de reflexión y debate musical diseñado para ir más allá de la escucha superficial. El MVP se organiza en cuatro experiencias complementarias:

- **Diario Íntimo:** un espacio privado donde cada usuario escribe y conserva sus escuchas. Las entradas están aisladas por usuario: nadie más puede listarlas ni borrarlas.
- **Muro de Debates:** el espacio público de reflexión musical. Los administradores publican hilos con portada opcional y anonimato; la comunidad los lee y reacciona con tres etiquetas semánticas: Profundo, Melancólico y Rompe esquemas.
- **El Velo:** una escucha ciega diaria. El usuario recibe solo el audio de la pista del día y, hasta que envía su reflexión, no ve título, artista ni portada. Después se revela la ficha completa y el muro de voces de la comunidad. Los administradores programan la cola desde el panel.
- **El Archivo:** una discoteca interactiva organizada en cajones de vinilos. El usuario busca una obra, el backend enriquece los metadatos con Last.fm, resuelve el audio con YouTube y conserva el resultado en MongoDB para que las siguientes consultas no vuelvan a consultar Last.fm y reaprovechen el audio ya resuelto.

El Sprint 2 sigue en curso. Los cuatro módulos del MVP cuentan con backend, modelo y pruebas, y los cuatro están integrados en el frontend: Diario, Muro, El Velo y El Archivo. El Archivo incorpora ya su vista de cajones, la ficha detallada con Last.fm y un tocadiscos con arrastre nativo. Queda pendiente la verificación manual del flujo completo en navegador con una sesión real. La suite automatizada de Jest cubre modelos, servicios y routers. La documentación de progreso, requisitos, arquitectura y decisiones vive en [docs/index.md](docs/index.md).

Desarrollado para la asignatura Procesos de Ingeniería del Software (Curso 2026-2027).

## Tecnologías Elegidas (Justificación)
- **Backend (Node.js & Express):** Proporciona un entorno ligero y rápido para construir la API REST requerida, permitiendo mantener un ecosistema unificado en JavaScript.
- **Frontend (Vanilla JS / HTML):** Asegura una estricta separación de la capa de presentación sin la sobrecarga de compilación de *frameworks* complejos en la etapa inicial.
- **Metadatos y audio (Last.fm + YouTube):** Last.fm aporta la ficha cultural del vinilo y YouTube resuelve la reproducción sin asumir el coste de un catálogo musical propietario. MongoDB actúa como caché persistente para reducir llamadas y proteger las cuotas gratuitas.
- **Pruebas (Jest):** Facilita la creación de pruebas unitarias automatizadas con aserciones claras y se integra nativamente con herramientas de CI.
- **CI/CD (GitHub Actions & Google App Engine):** GitHub Actions automatiza la ejecución de los tests en cada *pull request*, mientras que Google App Engine facilita el despliegue continuo de la rama principal a una URL pública.

## Instrucciones de Ejecución

### 1. Ejecutar el proyecto en local
Para levantar el servidor y servir el frontend en tu máquina, ejecuta:
```bash
cd backend
npm install
npm start
```
La aplicación estará disponible en `http://localhost:3000`.

### 2. Ejecutar las pruebas automatizadas
Para ejecutar las pruebas unitarias de la capa lógica (que incluyen comprobaciones de error, no solo el "camino feliz"), utiliza el siguiente comando:
```bash
cd backend
npm test
```

## API del Diario Íntimo

El diario es privado: cada usuario autenticado solo puede crear, listar y eliminar sus propias entradas. Todas las peticiones requieren la cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/diario` | `{ "text": "...", "title": "..." }` | `201` con `{ "_id", "text", "title", "createdAt", "userId" }` |
| GET | `/api/diario` | — | `200` con las entradas propias, de la más reciente a la más antigua |
| DELETE | `/api/diario/:id` | — | `200` con `{ "message": "Eco eliminado correctamente" }`; `404` si el eco no existe o es de otro usuario |

- `text` es obligatorio, se recorta con `trim` y admite entre 1 y 5000 caracteres.
- `title` es opcional, se recorta con `trim`, admite como máximo 50 caracteres y vale `''` si no se envía.
- En el historial del frontend se muestra el título o, si está vacío, un extracto de los primeros 40 caracteres del texto.
- `createdAt` lo genera el servidor; el cliente no puede enviarlo.
- `userId` es el `ObjectId` del usuario autenticado y referencia al modelo `User`.
- El borrado incluye el `userId` en la consulta: un usuario no puede eliminar ecos ajenos.
- `DIARY_MAX_TEXT_LENGTH` permite reducir el límite de caracteres; si no se define, se usan 5000.

Ejemplo de creación de una entrada:

```bash
curl -X POST http://localhost:3000/api/diario \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Primera escucha del día","title":"Mañana"}'
```

## Muro de Debates

El muro es el espacio público de reflexión de Querencia. Cualquier visitante puede leer las reflexiones publicadas; para reaccionar es necesario iniciar sesión. Las reacciones no usan iconos ni emojis: son etiquetas semánticas y filosóficas que se activan y desactivan con un clic. Cada reflexión puede llevar una portada propia mediante una URL de imagen. El autor se muestra sin el dominio del correo y, si la reflexión es anónima, aparece como “Publicado por Anónimo”.

| Reacción | Clave interna | Comportamiento |
|---|---|---|
| Profundo | `profundo` | Alterna el voto del usuario |
| Melancólico | `melancolico` | Alterna el voto del usuario |
| Rompe esquemas | `rompeEsquemas` | Alterna el voto del usuario |

Cada reacción se guarda en MongoDB como un array de `ObjectId` de usuarios, no como un contador. Si el usuario vuelve a pulsar la misma reacción, su voto se retira. La API devuelve `count`, `reactedByMe` y `label` para que la interfaz muestre siempre el texto exacto.

### Roles

| Rol | Estado | Permisos en el muro |
|---|---|---|
| `oyente` | Implementado en backend como `usuario`; la interfaz lo muestra como “Oyente” | Leer y reaccionar |
| `editor` | No implementado en este MVP; reservado para trabajo futuro | Sin permisos ni UI propia |
| `admin` | Implementado | Crear y eliminar reflexiones, leer y reaccionar |

La creación y el borrado de reflexiones están reservados a `admin`. En `muro.js`, el botón flotante con el lápiz y el diálogo de creación solo se insertan en el DOM cuando la sesión tiene rol `admin`; para un `oyente` no existen. El icono de la papelera de cada tarjeta también se genera únicamente para administradores. El diálogo incluye una casilla “Publicar como anónimo” que envía `isAnonymous: true`; en ese caso la API no expone el correo del autor. El textarea usa el scrollbar fino dorado del Diario, mientras que el contenedor del diálogo no define scroll propio. La autorización real no depende del navegador: `POST /api/debates` y `DELETE /api/debates/:id` exigen `authMiddleware` e `isAdminMiddleware`, y devuelven `403` a cualquier usuario que no sea administrador.

Las reflexiones de más de 250 caracteres aparecen colapsadas con puntos suspensivos y un control “Leer más”. Al pulsarlo, o al hacer clic en la tarjeta, se abre un modal de lectura profunda centrado sobre un fondo oscurecido. El modal muestra la reflexión completa con el mismo lenguaje visual del muro —tonos oscuros, acentos dorados y glassmorphism—, se cierra con la “X”, con el fondo o con `Escape`, y devuelve al mismo punto de scroll. Los clics en reacciones y en la papelera no abren la lectura.

Los avisos del muro, como “Reflexión publicada” o “Reflexión eliminada”, se desvanecen automáticamente a los 3,5 segundos. Los mensajes de carga, error de carga y muro vacío se mantienen visibles hasta que cambia el estado.

### API del Muro

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/debates` | `{ "title": "...", "content": "...", "coverImageUrl": "https://...", "isAnonymous": false }` | `201` con la reflexión creada; solo administradores |
| GET | `/api/debates` | — | `200` con las reflexiones, de la más reciente a la más antigua; público, con `reactedByMe` si hay token |
| POST | `/api/debates/:id/react` | `{ "reaction": "profundo" }` | `200` con `{ "_id", "reactions" }`; requiere sesión |
| DELETE | `/api/debates/:id` | — | `200` con `{ "deleted": true, "_id": "..." }`; solo administradores |

- `title` es obligatorio, se recorta y admite hasta 120 caracteres.
- `content` es obligatorio, se recorta y admite hasta 5000 caracteres.
- `coverImageUrl` es opcional, se recorta y admite hasta 2048 caracteres. Solo se aceptan URLs `http` o `https`; si se omite, la tarjeta usa la portada por defecto.
- `isAnonymous` es opcional y booleano; por defecto vale `false`. Si es `true`, `authorEmail` se devuelve como `null` y el muro muestra “Publicado por Anónimo”.
- Las reacciones válidas son `profundo`, `melancolico` y `rompeEsquemas`.
- `createdAt` lo genera el servidor.
- No hay edición de reflexiones en este MVP. El borrado queda reservado a administradores.

### Redirección tras autenticación

El inicio de sesión desde `index.html` redirige a `muro.html`, igual que el callback de Google. Tras un registro, el frontend intenta iniciar sesión automáticamente y, si la cuenta ya está activa, entra al muro; si sigue pendiente de verificación, muestra el aviso correspondiente. `cerrarSesion()` vuelve a `index.html`.

### Datos de prueba

El script `backend/seedDebate.js` crea una reflexión inicial sobre el duende, Camarón de la Isla y el consumo musical inmediato, con una portada de Camarón y Paco de Lucía. Es idempotente: si el título ya existe, no crea un duplicado y completa la portada si faltaba.

```bash
node backend/seedDebate.js
```

También puede ejecutarse con `cd backend && npm run seed`. El script requiere `MONGO_URI` en `backend/.env`. Para elegir el autor, usa `SEED_AUTHOR_EMAIL`; si no se define, reutiliza el primer usuario con rol `admin`. Si no hay ningún administrador, crea un autor técnico `seed@querencia.local` con rol `admin`, estado activo y una contraseña aleatoria que no se imprime. Ese autor es solo para datos de desarrollo y no está pensado para iniciar sesión.

## El Velo — Escucha Ciega Diaria

El Velo propone una escucha sin prejuicios. Cada día hay una única pista programada y, hasta que el usuario envía su reflexión, la API solo devuelve la URL del audio: ni título, ni artista, ni portada. Al enviarla, se revelan los metadatos y el muro completo de reflexiones de la comunidad.

La página `backend/frontend/velo.html` tiene dos estados:

- **Ciego:** reproductor y textarea. No se muestra ningún metadato de la pista.
- **Revelado:** portada, título, artista, fecha, reproductor y muro de reflexiones. La reflexión propia se marca como “Tu reflexión”; las demás se muestran como “Voz 01”, “Voz 02”, etc., sin exponer correos.

El reproductor admite tanto archivos de audio directos como enlaces embebibles de YouTube, Spotify, SoundCloud, Vimeo y Bandcamp. Los enlaces directos usan `<audio controls>` y los embebibles se convierten a su URL de inserción.

### API de El Velo

Todas las rutas de lectura y participación requieren `Authorization: Bearer <token>`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/velo/today` | — | `200` con `{ "audioUrl": "..." }` si el usuario no ha participado; `200` con la pista y las reflexiones si ya participó; `404` si no hay pista hoy |
| POST | `/api/velo/today/reflect` | `{ "text": "..." }` | `200` con la pista revelada y todas las reflexiones; `400` si el texto no es válido; `409` si ya se había enviado una reflexión |
| POST | `/api/velo/tracks` | `{ "releaseDate": "2026-11-06", "audioUrl": "https://...", "title": "...", "artist": "...", "coverUrl": "https://..." }` | `201` con la pista creada; solo administradores |
| GET | `/api/velo/tracks` | — | `200` con la cola ordenada por fecha, su estado (`past`, `today`, `future`) y el número de reflexiones; solo administradores |
| PUT | `/api/velo/tracks/:id` | Cualquier subconjunto de los campos anteriores | `200` con la pista actualizada; solo administradores; las pistas pasadas son inmutables |

- `releaseDate` se normaliza a medianoche UTC a partir de la fecha administrativa. El “día actual” se calcula en `Europe/Madrid` y solo puede existir una pista por fecha gracias a un índice único.
- `audioUrl`, `title` y `artist` son obligatorios. `coverUrl` es opcional. Las URLs deben empezar por `http` o `https`.
- La reflexión se recorta, es obligatoria y admite entre 1 y 5000 caracteres. No se puede editar ni enviar dos veces para la misma pista.
- Las reflexiones se devuelven con `text`, `userId` e `isMine`; el frontend no muestra los correos.
- La autorización real está en el servidor: `POST` y `PUT` de `/api/velo/tracks` exigen `authMiddleware` e `isAdminMiddleware`, y devuelven `403` a cualquier usuario que no sea administrador.

### Administración de la cola

`backend/frontend/admin.html` incorpora la sección “La Cola del Velo”. Desde ella se puede programar una pista para hoy o para un día futuro, consultar la cola completa, ver cuántas reflexiones ha recibido cada pista y editar las que todavía no han pasado. El formulario reutiliza la estética del panel: glassmorphism oscuro, acentos dorados y tipografías literarias, sin emojis.

## El Archivo — Discoteca Interactiva

El Archivo convierte el catálogo musical de la plataforma en una experiencia de consulta y escucha. Cada vinilo se presenta como una ficha persistente que reúne título, artista, álbum, portada, género, etiquetas de Last.fm y el identificador del vídeo de YouTube que permite reproducirlo. La unidad de navegación no es una lista plana, sino un conjunto de cajones: agrupaciones por género o por artista que conservan la metáfora física de una discoteca y permiten recorrer el fondo musical sin depender de una búsqueda inmediata.

La vista [backend/frontend/archivo.html](backend/frontend/archivo.html), apoyada en [backend/frontend/js/archivo.js](backend/frontend/js/archivo.js), presenta la colección como una estantería de cajones. Las portadas se superponen dentro de cada cajón y la colección puede agruparse por género o por artista. Un clic simple abre la ficha del disco; arrastrar una portada hasta el tocadiscos fijo inicia la reproducción. La navegación de Muro, Diario, El Velo y el panel de administración incorpora ya el enlace a El Archivo.

### La discoteca en el navegador

- **Cajones (T4).** Al cargar la página se consulta `GET /api/archivo/cajones` mediante `api.listarCajonesArchivo(agrupacion)`. Cada cajón muestra su etiqueta, su número de discos y una fila de portadas superpuestas con sombras, `z-index` y transformaciones. El conmutador «Por género» / «Por artista» repite la consulta con `?agrupar=genero` o `?agrupar=artista`. La fila puede recorrerse horizontalmente cuando el cajón contiene muchos vinilos.
- **Ficha detallada (T5).** Un clic simple, sin arrastre, abre un diálogo con la carátula a un lado y la información de Last.fm al otro. La ficha se solicita con `GET /api/archivo/disco/:id` mediante `api.obtenerDiscoArchivo(id)` y muestra título, artista, álbum, género, sinopsis, etiquetas, oyentes, reproducciones, duración, fecha de publicación y enlace a Last.fm. El modal se cierra con la «X», el fondo o `Escape`, devuelve el foco a la portada de origen y permite reintentar si la consulta falla.
- **Tocadiscos y arrastre (T6).** Los vinilos son `draggable="true"`. Los eventos nativos `dragstart`, `dragover`, `drop` y `dragend` transportan el identificador y el `youtubeVideoId` del disco. Al soltarlo sobre el plato se carga la YouTube Iframe API en un reproductor oculto, se inicia el vídeo y el disco gira con `@keyframes spin`. El tocadiscos permanece fijo en la esquina inferior derecha, permite pausar y reanudar, y avisa cuando un vinilo no tiene audio disponible.
- **Estética y accesibilidad.** La vista mantiene el fondo oscuro, el glassmorphism, los acentos dorados y las tipografías con remates de Querencia, sin emojis. Las portadas son botones accesibles por teclado, el modal atrapa el foco mientras está abierto y los datos de Last.fm se insertan con `textContent`.

### Modelo de datos

El modelo `Vinyl` vive en [backend/vinylModel.js](backend/vinylModel.js) y se apoya en `VinylRepository` para encapsular las consultas. Sus campos principales son:

| Campo | Tipo | Función |
|---|---|---|
| `title` | `String` | Título de la obra, obligatorio, recortado y limitado a 200 caracteres. |
| `artist` | `String` | Intérprete o autor, obligatorio, recortado y limitado a 200 caracteres. |
| `album` | `String` | Álbum o publicación de referencia, opcional. |
| `coverUrl` | `String` | Portada externa validada; se admite una URL `http` o `https` de hasta 2048 caracteres. |
| `genre` | `String` | Género normalizado para construir los cajones; por defecto “Sin clasificar”. |
| `youtubeVideoId` | `String` | Identificador de once caracteres del vídeo de YouTube; puede ser nulo si el audio no se resuelve. |
| `lastFmInfo` | `Object` | Ficha cultural normalizada: `mbid`, URL de Last.fm, oyentes, reproducciones, duración, publicación, resumen, etiquetas, álbum y fecha de extracción. |
| `catalogKey` | `String` | Clave estable y única generada a partir de artista y título normalizados. |
| `createdAt`, `updatedAt` | `Date` | Trazabilidad de la creación y de la última actualización. |
| `lastAccessedAt` | `Date` | Último acceso al detalle del disco, útil para futuras políticas de depuración. |

La unicidad se apoya en `catalogKey`, no en el título visible. De este modo, “Camarón de la Isla” y “camaron de la isla” producen la misma clave y no generan fichas duplicadas. El campo `youtubeVideoId` se valida con una expresión regular de once caracteres y se mantiene opcional para que un fallo temporal de YouTube no impida conservar la ficha cultural del vinilo.

### Flujo de búsqueda y caché

1. El cliente envía una consulta libre (`query`) o un par `artist` y `title`. El servicio valida y normaliza los textos.
2. Si dispone de artista y título, calcula `catalogKey` y consulta MongoDB antes de llamar a ninguna API externa.
3. Si la ficha existe y su `lastFmInfo.fetchedAt` está dentro del TTL configurado, se devuelve sin consultar Last.fm y se actualiza `lastAccessedAt`. Si todavía no tiene `youtubeVideoId`, se intenta completar el audio como máximo una vez al día para no consumir cuota en cada búsqueda.
4. Si la ficha existe pero está caducada, se intenta refrescar con Last.fm. Si el proveedor falla, se conserva la copia anterior y se marca la respuesta como `stale`; el catálogo sigue siendo legible aunque la API externa no esté disponible.
5. Si no existe, se consulta `track.search` de Last.fm, se elige el candidato más próximo y se completa la ficha con `track.getInfo`.
6. El audio se resuelve primero mediante YouTube Data API, si `YOUTUBE_API_KEY` está configurada. Si no hay clave, se supera la cuota o la API falla, se intenta el fallback de búsqueda sobre la página pública de YouTube, siempre que `YOUTUBE_SCRAPING_ENABLED` esté activo.
7. El documento se guarda con `findOneAndUpdate` y `upsert` sobre `catalogKey`, de forma atómica e idempotente. Si dos peticiones compiten por el mismo disco, el índice único impide duplicados y la segunda reutiliza el documento creado por la primera.
8. La respuesta indica si el resultado vino de caché (`cached`), si se creó (`created`) y si se sirvió una copia obsoleta (`stale`).

El TTL se controla con `ARCHIVO_CACHE_TTL_DAYS` y vale 30 días por defecto. El tiempo máximo de espera de cada llamada externa se controla con `ARCHIVO_HTTP_TIMEOUT_MS` y vale 8000 milisegundos por defecto. Ninguna clave de API se envía al navegador ni se persiste en MongoDB.

### API de El Archivo

Todas las rutas exigen la cabecera `Authorization: Bearer <token>` y se montan bajo `/api/archivo`.

| Método | Ruta | Cuerpo o parámetros | Respuesta |
|---|---|---|---|
| GET | `/api/archivo/cajones` | `?agrupar=genero` o `?agrupar=artista`; también `?genero=...` y `?artista=...` | `200` con `{ agrupacion, total, cajones }`. Cada cajón contiene `clave`, `etiqueta`, `total` y `vinilos`. |
| GET | `/api/archivo/disco/:id` | Identificador `ObjectId` | `200` con la ficha completa; `400` si el identificador no es válido; `404` si no existe. |
| POST | `/api/archivo/buscar` | `{ "query": "..." }` o `{ "artist": "...", "title": "..." }` | `201` si crea la ficha; `200` si reutiliza la caché; `400` si la entrada no es válida; `502`, `503` o `504` si falla un proveedor externo. |

La respuesta de búsqueda tiene la forma `{ disco, cached, created, stale }`. El campo `disco` contiene la ficha completa, incluida `lastFmInfo`; `cached` indica que se reutilizó un documento; `created` indica que se insertó uno nuevo; `stale` indica que se devolvió una copia caducada porque el refresco externo no fue posible.

Los cajones se construyen en el servicio, no en el cliente. La agrupación por género usa el campo normalizado `genre`; la agrupación por artista usa `artist`. Dentro de cada cajón los vinilos se ordenan por artista y título, y los cajones se ordenan por su etiqueta visible en español. Esta decisión mantiene el contrato estable si en el futuro se añade paginación o filtros adicionales.

### Variables de entorno

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---|---|---|
| `LASTFM_API_KEY` | Sí para consultas externas | — | Clave de Last.fm. Sin ella solo se pueden servir fichas ya cacheadas. |
| `LASTFM_API_URL` | No | `https://ws.audioscrobbler.com/2.0/` | Endpoint de Last.fm. |
| `YOUTUBE_API_KEY` | No | — | Clave de YouTube Data API. Si falta, se usa el fallback de scraping. |
| `YOUTUBE_API_URL` | No | `https://www.googleapis.com/youtube/v3/search` | Endpoint de búsqueda de YouTube Data API. |
| `YOUTUBE_SEARCH_URL` | No | `https://www.youtube.com/results` | Página utilizada por el fallback de scraping. |
| `YOUTUBE_SCRAPING_ENABLED` | No | `true` | Permite desactivar el fallback de scraping. |
| `ARCHIVO_CACHE_TTL_DAYS` | No | `30` | Días de vigencia de la ficha antes de intentar refrescarla. |
| `ARCHIVO_HTTP_TIMEOUT_MS` | No | `8000` | Tiempo máximo de espera de cada llamada externa. |

### Ejemplo de uso

```bash
curl -X POST http://localhost:3000/api/archivo/buscar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"artist":"Camarón de la Isla","title":"La leyenda del tiempo"}'
```

La primera llamada consulta Last.fm y YouTube y guarda la ficha. Una segunda llamada con el mismo artista y título, dentro del TTL, devuelve el documento cacheado sin volver a consultar Last.fm; si la ficha ya contiene un `youtubeVideoId`, tampoco consume YouTube. Si el audio no se pudo resolver, el servicio reintenta la búsqueda como máximo una vez al día. Cuando existe `youtubeVideoId`, el tocadiscos de `archivo.html` construye la reproducción con YouTube Iframe API usando ese identificador.

### Límites y criterios de diseño

- El scraping de YouTube es un mecanismo de respaldo, no la vía principal. Su estructura HTML puede cambiar y por eso la aplicación prioriza la API oficial y degrada a `youtubeVideoId: null` cuando no hay una resolución fiable.
- La caché evita rate-limits y reduce el coste de las APIs, pero no sustituye una política de cuotas por usuario. La autenticación obligatoria del endpoint de búsqueda es la primera barrera contra el abuso, y una ficha sin audio solo reintenta YouTube una vez al día.
- Los metadatos culturales se guardan normalizados y con el resumen de Last.fm sin HTML; el frontend los renderiza con `textContent` para no introducir contenido no confiable.
- La subida física de carátulas no forma parte de esta iteración. Igual que en el Muro y en El Velo, la portada se referencia mediante URL externa.

## Estado Actual (Sprint 1)
- [x] **Hito 1:** Esqueleto, backend (lógica en memoria), API, pruebas automatizadas, pipeline de Integración Continua (CI) y Despliegue Continuo (CD).
- [x] **Hito 2:** Interfaz frontend, registro e inicio de sesión, mantenimiento de sesión.
- [X] **Hito 3:** Persistencia real en base de datos y validación de roles.
- [X] **Hito 4:** Autenticación OAuth externa y confirmación por correo.

## Estado Actual (Sprint 2)

El Sprint 2 sigue en curso. Esta lista refleja los PBIs ya completados e integrados, no el cierre del sprint.

- [x] **RF-MVP-Diario:** backend del diario íntimo con esquema `DiaryEntry`, endpoints protegidos, aislamiento por usuario y pruebas unitarias con dobles.
- [x] **RF-MVP-Diario-Frontend:** guardado, historial “Ecos”, título opcional, lectura completa y borrado de ecos propios.
- [x] **RF-MVP-Muro:** backend del muro con reacciones `Profundo`, `Melancólico` y `Rompe esquemas`, toggle sin doble voto y creación reservada a administradores.
- [x] **RF-MVP-Muro-Frontend:** tarjetas dinámicas, reacciones autenticadas, portadas por URL y borrado visible solo para administradores.
- [x] **RF-MVP-Muro-Admin:** botón flotante con lápiz y diálogo de creación que solo se renderizan para administradores.
- [x] **RF-MVP-Muro-Autor:** autor sin dominio de correo, casilla de anonimato y ocultación del correo en la API.
- [x] **RF-MVP-Muro-Lectura:** reflexiones de más de 250 caracteres colapsadas con “Leer más”, modal de lectura completa y retorno al mismo punto del muro.
- [x] **RF-MVP-Muro-Notificaciones:** avisos del muro con desvanecimiento automático y transición suave.
- [x] **RF-MVP-Auth-Redirect:** login y callback de Google redirigen al muro; el registro intenta iniciar sesión automáticamente.
- [x] **RF-MVP-Muro-Seed:** script `seedDebate.js` con un hilo inicial idempotente, portada musical y comando `npm run seed`.
- [x] **RF-MVP-Velo:** escucha ciega diaria con `VeloTrack`, respuesta capada hasta la reflexión, revelación de metadatos y muro de reflexiones; pruebas de modelo, servicio y router.
- [x] **RF-MVP-Velo-Frontend:** estados ciego y revelado en `velo.html` y `velo.js`, reproductor para audio directo y plataformas embebibles, y muro de voces sin correos.
- [x] **RF-MVP-Velo-Admin:** panel “La Cola del Velo” en `admin.html` y `admin.js`, con alta, listado por estado, edición y bloqueo de pistas pasadas.
- [x] **RF-MVP-Archivo:** backend de El Archivo con modelo `Vinyl`, caché en MongoDB, búsqueda en Last.fm, resolución de audio en YouTube y endpoints de cajones, detalle y búsqueda.
- [x] **RF-MVP-Archivo-Cache:** upsert atómico por `catalogKey`, TTL configurable, reutilización de fichas y degradación a copia `stale` cuando Last.fm no responde.
- [x] **RF-MVP-Archivo-Docs:** documentación académica del modelo, el servicio, el flujo de caché, los requisitos y las decisiones económicas y técnicas.
- [x] **RF-MVP-Archivo-Frontend:** vista `archivo.html` con cajones agrupables por género o artista, portadas superpuestas y navegación integrada en el resto de la aplicación.
- [x] **RF-MVP-Archivo-Detalle-Frontend:** modal de ficha con carátula, sinopsis, etiquetas y métricas de Last.fm, estados de carga y error, cierre con `Escape` y retorno del foco.
- [x] **RF-MVP-Archivo-Reproduccion:** tocadiscos fijo con arrastre nativo, reproductor oculto de YouTube Iframe API, animación de giro, pausa y reanudación.
- [ ] **Pendiente de cierre:** verificación manual del flujo completo en navegador con una sesión real, correo real, URL pública y requisitos heredados del Sprint 1.
