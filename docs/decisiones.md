---
type: Decisiones
title: Decisiones técnicas detectadas
description: Decisiones observables en el código, el README y el historial, con las incorporaciones del Sprint 2.
timestamp: 2026-11-06
---

# Decisiones

## D-01 — Backend con Node.js y Express

**Qué se decidió:** usar Node.js y Express para la API REST.

**Por qué:** el [README](../README.md) indica que proporciona un entorno ligero y un ecosistema unificado en JavaScript.

**Estado:** vigente.

## D-02 — Frontend sin framework

**Qué se decidió:** usar HTML y JavaScript vanilla para la presentación.

**Por qué:** el [README](../README.md) indica que mantiene separada la presentación sin añadir una compilación de framework en la etapa inicial.

**Estado:** vigente.

## D-03 — Hash de contraseñas con bcrypt

**Qué se decidió:** almacenar contraseñas mediante un hash de bcrypt.

**Por qué:** el código usa `bcrypt.hash` al crear usuarios y `bcrypt.compare` al iniciar sesión.

**Estado:** vigente.

## D-04 — Sustitución de memoria por MongoDB

**Qué se decidió:** sustituir la implementación inicial en memoria por persistencia en MongoDB.

**Por qué:** el historial contiene el commit `04039b0` de configuración de la base de datos y el modelo actual usa Mongoose.

**Estado:** vigente. La especificación indicaba que el cambio debía conservar la capa lógica; la equivalencia completa queda por verificar.

## D-05 — Sesiones mediante tokens JWT stateless

**Qué se decidió:** utilizar tokens JWT stateless validados criptográficamente en el backend y almacenados en el `localStorage` del cliente (`querencia_user` y `querencia_token`), abandonando cualquier gestión de sesión en la memoria de Node.js.

**Por qué:** Google App Engine utiliza un entorno efímero y autoescalable. Si almacenamos la sesión en la memoria de un proceso de Node.js, las sesiones de los usuarios se perderían cada vez que el servidor se reinicia, se suspende por inactividad o levanta una instancia nueva. Un JWT permite que cualquier instancia valide al usuario sin depender de una memoria local.

**Estado:** decisión vigente, pendiente de conciliar con la implementación. `authMiddleware.js` todavía guarda las sesiones en un `Map` en memoria del proceso mediante `generateToken` y `deleteToken`; la validación JWT stateless descrita aquí queda como deuda técnica registrada en el Sprint 2.

## D-06 — CI y despliegue desde GitHub Actions

**Qué se decidió:** ejecutar pruebas en PR y en `main`, y desplegar después de las pruebas en `push` a `main`.

**Por qué:** está definido en [ci.yml](../.github/workflows/ci.yml).

**Estado:** vigente.

## D-07 — Cambio de destino de despliegue documentado

**Qué se decidió:** el workflow actual despliega en Google App Engine.

**Por qué:** `ci.yml` reconstruye `app.yaml` y ejecuta `gcloud app deploy`; el historial contiene `27b848b` con el cambio hacia GCP. El README ya documenta App Engine como destino.

**Estado:** vigente en el workflow; la disponibilidad de la URL pública sigue **Por verificar**.

## D-08 — Diario privado por usuario

**Qué se decidió:** `GET /api/diario` devuelve únicamente las entradas del usuario autenticado. El `userId` de cada entrada se resuelve a partir del email que viaja en la sesión y se almacena como `ObjectId` con referencia al modelo `User`.

**Por qué:** el diario es íntimo y privado; cada usuario debe poder leer solo sus propias entradas y MongoDB garantiza la integridad referencial mediante el `ObjectId`.

**Estado:** vigente.

## D-09 — Fecha generada por el servidor y contrato de la API

**Qué se decidió:** la fecha de la entrada se genera automáticamente en el backend en formato ISO mediante Mongoose (`createdAt`) y nunca la envía el cliente. El payload de la API usa nomenclatura en inglés: `POST /api/diario` recibe `{ text, title? }`, `DELETE /api/diario/:id` no recibe cuerpo y las respuestas de las entradas incluyen `_id`, `text`, `title`, `createdAt` y `userId`.

**Por qué:** evitar que un usuario manipule fechas falsas desde el navegador y mantener un contrato de API homogéneo en inglés.

**Estado:** vigente.

## D-10 — Validación del texto del diario

**Qué se decidió:** `text` es obligatorio, se recorta con `trim` y debe tener entre 1 y 5000 caracteres. Un texto inválido devuelve `400`.

**Por qué:** evitar entradas vacías y saturar la base de datos con contenido desmesurado en el MVP.

**Estado:** vigente.

## D-11 — Consumo de la API con rutas relativas

**Qué se decidió:** el frontend consume la API mediante `fetch` a rutas relativas que empiezan por `/api`, sin URL absoluta ni configuración de CORS en el cliente.

**Por qué:** el mismo código funciona en local y en el despliegue sin cambiar la URL base; `express.static` sirve el frontend desde el mismo origen y se evita depender de CORS o de variables de entorno en el navegador.

**Estado:** vigente.

## D-12 — Título opcional en las entradas del diario

**Qué se decidió:** `title` es opcional, se recorta con `trim`, tiene un máximo estricto de 50 caracteres y vale `''` cuando no se envía. En el historial se muestra el título y, si está vacío, un extracto de los primeros 40 caracteres del texto.

**Por qué:** permite identificar cada eco de forma rápida sin obligar al usuario a titularlo, y mantiene la barra lateral compacta cuando no hay título.

**Estado:** vigente.

## D-13 — Borrado de ecos con verificación de propiedad

**Qué se decidió:** `DELETE /api/diario/:id` elimina la entrada mediante `findOneAndDelete({ _id: id, userId })`, de modo que la consulta solo encuentra ecos del usuario autenticado. Si el eco no existe o es de otro usuario, el servicio lanza `DiaryEntryNotFoundError` y la API responde `404`; sin sesión, responde `401`.

**Por qué:** impedir borrados cruzados entre usuarios y no revelar si existe una entrada ajena.

**Estado:** vigente.

## D-14 — Modelo `Debate` con reacciones del alma basadas en `ObjectId`

**Qué se decidió:** persistir los debates en el modelo `Debate` con `title` (obligatorio, recortado, máximo 120 caracteres), `content` (obligatorio, recortado, máximo 5000 caracteres), `coverImageUrl` (opcional, recortado, máximo 2048 caracteres y por defecto `null`), `isAnonymous` (booleano, por defecto `false`), `authorId` como `ObjectId` de `User`, `createdAt` generado por el servidor y un objeto `reactions` con tres claves fijas: `profundo`, `melancolico` y `rompeEsquemas`. Las etiquetas visibles son “Profundo”, “Melancólico” y “Rompe esquemas”, y viven junto a las claves en `REACTION_DEFINITIONS`. Cada clave es un array de `ObjectId` de usuarios, nunca un contador numérico. Las claves retiradas `intimo`, `inquietante` y `tecnologico` dejan de formar parte del subesquema; no se ejecuta una migración destructiva y la API solo expone las tres reacciones vigentes.

**Por qué:** los arrays permiten saber qué usuarios han reaccionado y evitan votos infinitos. El toggle se resuelve con dos operaciones atómicas: `$pull` si el usuario ya había votado y `$addToSet` si no había votado. Si un usuario vuelve a pulsar la misma reacción, se le retira el voto. Mantener claves estables sin acentos ni espacios evita problemas en MongoDB y permite cambiar la etiqueta visible sin migrar datos.

**Estado:** vigente.

## D-15 — Contrato y permisos del muro de debates

**Qué se decidió:** `POST /api/debates` exige `authMiddleware` y `adminMiddleware`, recibe `{ title, content, coverImageUrl, isAnonymous }` y responde `201`. Cuando `isAnonymous` es `true`, la respuesta devuelve `authorEmail: null` para no filtrar el correo del autor. `GET /api/debates` es público para respetar la lectura abierta del muro; si la petición incluye un token válido, calcula `reactedByMe` para el usuario y, si no lo incluye, devuelve ese campo en `false`. `POST /api/debates/:id/react` exige `authMiddleware`, recibe `{ reaction }` y devuelve `{ _id, reactions }` con el estado actualizado. `DELETE /api/debates/:id` exige `authMiddleware` y `adminMiddleware`, y responde `200` con `{ deleted: true, _id }`. Los errores se traducen a `400`, `401`, `403`, `404` o `500` según corresponda. No hay edición de debates en este MVP.

**Por qué:** la creación y el borrado quedan reservados a administración sin crear roles nuevos, mientras que la lectura puede ser anónima o personalizada sin duplicar endpoints. El frontend envía el token para que los botones conserven su estado `active` tras recargar.

**Estado:** vigente.

## D-16 — Integración dinámica del muro en el frontend

**Qué se decidió:** `muro.html` deja de contener debates estáticos y carga las tarjetas desde `GET /api/debates` mediante `api.listarDebates()`. Las reacciones se envían con `api.reaccionarDebate(id, reaction)`, las nuevas reflexiones con `api.crearDebate(title, content, coverImageUrl, isAnonymous)` y el borrado con `api.eliminarDebate(id)`; todas añaden el token mediante `fetchAutenticado`. El autor se muestra sin el dominio del correo y, si `isAnonymous` es `true`, como “Publicado por Anónimo”. El renderizado reutiliza las clases existentes (`debate-grid`, `debate-card`, `album-cover-wrapper`, `album-cover`, `debate-meta`, `debate-title`, `debate-text`, `reactions-container`, `reaction-tag`, `count` y `active`), usa `coverImageUrl` como imagen principal con el placeholder como respaldo y el efecto de aura, usa el `label` que devuelve la API y emplea `textContent` para no inyectar HTML no confiable.

**Por qué:** mantiene intacta la maquetación y los estilos de scroll existentes, centraliza la comunicación en `api.js` y evita que un título o contenido malicioso se interprete como HTML.

**Estado:** vigente.

## D-17 — Botón flotante de administración y autorización en servidor

**Qué se decidió:** `muro.js` construye un botón flotante fijo en la esquina inferior derecha, con el mismo icono de lápiz del Diario, y un diálogo modal de creación solo cuando `obtenerUsuarioActual()` devuelve `rol === 'admin'`. El botón no forma parte del flujo normal de la página ni del HTML estático. El diálogo incluye una casilla “Publicar como anónimo” con estilo propio y solo el textarea usa el scrollbar fino dorado del Diario; el contenedor del diálogo no añade `max-height` ni `overflow-y`. Para un oyente no se inserta ningún nodo del botón, del diálogo ni de las papeleras de las tarjetas en el DOM; `muro.html` solo aporta los estilos. La autorización real sigue en `POST /api/debates` y `DELETE /api/debates/:id` mediante `authMiddleware` e `isAdminMiddleware`, de modo que manipular `localStorage` solo produce un `403`.

**Por qué:** se evita dejar markup oculto o formularios inactivos para usuarios sin permiso, se mantiene el flujo de lectura limpio y no se confía en una comprobación de rol hecha en el navegador. El backend sigue siendo la única frontera de autorización.

**Estado:** vigente.

## D-18 — Seed idempotente para el muro

**Qué se decidió:** `seedDebate.js` crea un debate inicial sobre el duende, Camarón de la Isla y el consumo musical inmediato, con una portada de Camarón y Paco de Lucía. Busca el título antes de insertar para no duplicar datos y, si el debate ya existe sin portada, la completa. Carga `backend/.env` por ruta absoluta para que el script funcione desde la raíz del repositorio. Resuelve el autor con `SEED_AUTHOR_EMAIL`, con el primer usuario `admin` o, si no existe ninguno, con un autor técnico `seed@querencia.local` de rol `admin`, estado activo y contraseña aleatoria hasheada que no se imprime. La conexión se cierra al terminar.

**Por qué:** permite disponer de contenido inicial en una base vacía sin exigir una configuración manual previa, sin repetir el debate en ejecuciones sucesivas y sin exponer credenciales de una cuenta que no está pensada para iniciar sesión.

**Estado:** vigente.

## D-19 — Anonimato opcional y formato del autor en el muro

**Qué se decidió:** `Debate` incorpora `isAnonymous` como booleano con `false` por defecto. El servicio solo acepta booleanos y normaliza la ausencia del campo a `false`. El router devuelve `isAnonymous` en cada debate y, cuando es `true`, fuerza `authorEmail: null`; el frontend muestra “Publicado por Anónimo”. En los debates no anónimos, el autor visible es la parte local del correo (`admin@querencia.es` se muestra como `admin`). La casilla “Publicar como anónimo” solo existe en el diálogo de administración.

**Por qué:** el anonimato debe ser real también en la respuesta HTTP, no solo un cambio visual. Ocultar el dominio reduce ruido en la tarjeta sin perder la referencia del autor. Mantener el flag como booleano evita estados ambiguos y no requiere migración para los debates existentes, que pasan a valer `false`.

**Estado:** vigente.

## D-20 — Redirección posterior a la autenticación

**Qué se decidió:** el formulario de login de `index.html` y el callback de Google redirigen a `muro.html`, no a `diario.html`. Tras un registro correcto, el frontend intenta iniciar sesión con las mismas credenciales y, si la cuenta ya está activa, entra al muro. Si el backend la mantiene pendiente de verificación, se muestra el aviso y no se crea una sesión ficticia. El login usa `skipAuthRedirect` para que un `401` de credenciales no borre la sesión ni recargue la landing antes de mostrar el error.

**Por qué:** el muro es la entrada principal de la plataforma. El registro no puede garantizar una sesión válida porque `UserModel` exige verificar el correo; intentar el login automático cubre el caso de cuentas activas y deja explícito el caso pendiente sin debilitar la verificación.

**Estado:** vigente.

## D-21 — Lectura profunda en modal para reflexiones largas

**Qué se decidió:** las tarjetas cuyo `content` supera los 250 caracteres se muestran con un recorte de 250 caracteres y puntos suspensivos, acompañadas de un botón “Leer más”. La tarjeta y el botón abren un modal centrado con backdrop oscurecido, borde y acentos dorados, fondo translúcido con `backdrop-filter` y ancho máximo de 720 px. El modal muestra título, autor, fecha y contenido completo con `textContent`, sin interpretar HTML, y se cierra con la “X”, el backdrop o `Escape`. Al abrir guarda `window.scrollY`, bloquea el scroll del documento y lo restaura al cerrar para volver al mismo punto del muro. Los clics sobre `.reactions-container` y `.debate-delete` se excluyen para no interferir con reacciones ni borrados.

**Por qué:** expandir el texto dentro de la tarjeta deformaba la cuadrícula y obligaba a desplazar el muro. El modal concentra la lectura completa sin alterar la altura de las tarjetas y conserva la estética del proyecto. La restauración del scroll evita perder la posición de lectura.

**Estado:** vigente.

## D-22 — Avisos temporales con desvanecimiento

**Qué se decidió:** `mostrarEstado` aplica la clase `is-visible` para animar opacidad y desplazamiento, y programa un `setTimeout` de 3,5 segundos para retirar los avisos de publicación, borrado o error. Tras 350 ms de transición, el elemento recibe `hidden`. Los mensajes de carga, error de carga y muro vacío se marcan como persistentes y no se autodescartan. Cada nueva llamada cancela los temporizadores anteriores.

**Por qué:** los avisos ya no se acumulan indefinidamente en la pantalla, pero los estados estructurales del muro siguen visibles mientras sean relevantes.

**Estado:** vigente.

## D-23 — Rol `editor` documentado pero no implementado (YAGNI)

**Qué se decidió:** reconocer en la documentación la posibilidad futura de un rol `editor`, pero no implementarlo en el MVP. El código solo distingue `usuario` (mostrado como “Oyente”) y `admin`; `adminMiddleware.js` autoriza exclusivamente `req.user.role === 'admin'`. No existe una interfaz, una ruta ni una asignación de rol `editor` en la API.

**Por qué:** no hay un caso de uso aprobado que requiera un rol intermedio entre oyente y administrador. Aplicar YAGNI evita permisos sin probar, condicionales adicionales y una UI que no aporta valor al MVP. Documentar la intención conserva la idea para una iteración futura sin convertirla en deuda de código.

**Estado:** vigente. `editor` no se asigna ni se comprueba en el código actual.

## D-24 — Portadas mediante URL externa en lugar de subida multipart

**Qué se decidió:** `Debate.coverImageUrl` y `VeloTrack.coverUrl` almacenan una URL `http` o `https`, recortada y limitada a 2048 caracteres. No se implementa subida física de archivos, `multipart/form-data`, `multer` ni almacenamiento propio de imágenes. El frontend usa la URL como origen de la imagen y muestra el placeholder correspondiente si falta o falla.

**Por qué:** el MVP solo necesita mostrar una portada, no gestionarla. Depender de una URL externa evita administrar binarios, permisos, cuotas, carpetas y limpieza, mantiene el backend ligero y no exige un volumen persistente en App Engine. Si en el futuro se requiere subida física, se podrá añadir un servicio de almacenamiento manteniendo la URL como contrato de la API.

**Estado:** vigente.

## D-25 — Anonimato de las publicaciones administrativas con `isAnonymous`

**Qué se decidió:** el diálogo de creación del muro, disponible solo para `admin`, ofrece la casilla “Publicar como anónimo” y envía `isAnonymous`. El backend lo persiste como booleano con `false` por defecto, lo devuelve en cada debate y, cuando es `true`, fuerza `authorEmail: null`. El frontend muestra “Publicado por Anónimo” y no recibe el correo del autor.

**Por qué:** permite que el administrador publique sin exponer su identidad, algo útil para hilos de prueba o contenidos que deben leerse sin sesgo de autor. El anonimato se aplica en la respuesta HTTP, no solo en la vista, para que el dato no se filtre. Se limita al formulario administrativo porque en el MVP solo `admin` puede publicar; no se crea un sistema de identidad anónima separado ni se permite elegir autor.

**Estado:** vigente. Ver también D-19, que detalla el contrato y la normalización del campo.

## D-26 — Last.fm para los metadatos y YouTube para el audio

**Qué se decidió:** El Archivo separa la ficha cultural del vinilo de su reproducción. Last.fm aporta título, artista, álbum, portada, etiquetas, oyentes, reproducciones, duración, resumen y enlace canónico; YouTube aporta el identificador del vídeo que permite escuchar la obra. El modelo `Vinyl` guarda ambas dimensiones en un único documento, pero las resuelve con adaptadores independientes. Las tres rutas de El Archivo exigen `authMiddleware`, de modo que solo un usuario autenticado puede provocar llamadas externas.

**Por qué:** ninguna de las dos fuentes cubre por sí sola la experiencia completa. Last.fm es una fuente cultural madura y con una API gratuita adecuada para un proyecto académico, pero no ofrece reproducción musical completa; YouTube permite escuchar la obra, pero sus metadatos no están pensados como catálogo. Separar ambas responsabilidades permite sustituir un proveedor sin rehacer el otro, mantener la ficha aunque el audio no se resuelva y proteger las cuotas gratuitas detrás de la autenticación. No se almacena audio ni se descargan vídeos: solo se persiste el identificador de once caracteres.

**Estado:** vigente. La integración visual y la reproducción mediante YouTube Iframe API quedan pendientes.

## D-27 — MongoDB como caché persistente de El Archivo

**Qué se decidió:** cada disco se persiste en la colección de `Vinyl` y se identifica por una `catalogKey` única construida a partir del artista y el título normalizados. Antes de llamar a Last.fm, el servicio busca por esa clave. La ficha se considera vigente mientras `lastFmInfo.fetchedAt` esté dentro de `ARCHIVO_CACHE_TTL_DAYS`, que vale treinta días por defecto. La escritura se hace con `findOneAndUpdate` y `upsert` atómicos; si el refresco de una ficha caducada falla, se devuelve la copia anterior con `stale: true`.

**Por qué:** las APIs gratuitas imponen límites de peticiones y el mismo disco puede buscarse muchas veces. Una caché persistente reduce el consumo, acelera la respuesta y mantiene el catálogo legible cuando el proveedor no está disponible. La clave normalizada evita duplicados por tildes, mayúsculas o signos; el índice único resuelve las carreras entre peticiones concurrentes; el TTL largo es proporcionado porque los metadatos musicales cambian poco. La caché no se usa como excusa para relajar la validación: las entradas siguen limitándose y las respuestas conservan los indicadores `cached`, `created` y `stale`. Los detalles del contrato están en [arquitectura.md](arquitectura.md).

**Estado:** vigente. `ARCHIVO_CACHE_TTL_DAYS` y `ARCHIVO_HTTP_TIMEOUT_MS` permiten ajustar la política sin tocar código.

## D-28 — YouTube Data API como vía principal y scraping como respaldo

**Qué se decidió:** la resolución del audio intenta primero YouTube Data API si `YOUTUBE_API_KEY` está configurada. La consulta usa `part=snippet`, `type=video`, `videoCategoryId=10`, `maxResults=1` y una cadena formada por artista, título, álbum y “official audio”. Si no hay clave, la cuota está agotada o la API falla, se intenta un fallback de búsqueda sobre la página pública de YouTube, condicionado a `YOUTUBE_SCRAPING_ENABLED`. El fallback busca un `videoId` o un enlace `/watch?v=` en el HTML. Cualquier fallo de YouTube se registra y se traduce en `youtubeVideoId: null`, sin impedir que la ficha cultural se guarde.

**Por qué:** la API oficial devuelve una estructura estable y verificable, pero consume cuota y exige una clave. El scraping no consume cuota, pero depende de un HTML cambiante y puede romperse sin aviso. Usar la API como vía principal y el scraping como respaldo ofrece continuidad operativa sin convertir una página no documentada en la única dependencia. Mantener `youtubeVideoId` opcional preserva el valor principal de El Archivo, que es el catálogo, y permite que un fallo temporal de audio se resuelva en una consulta posterior. El fallback se puede desactivar por configuración para cumplir con entornos que no permitan scraping.

**Estado:** vigente. `YOUTUBE_SCRAPING_ENABLED` vale `true` por defecto y puede desactivarse sin cambios de código.
