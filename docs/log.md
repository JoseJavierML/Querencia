# Cronología

## 2026-11-05 — Actualización documental intermedia del Sprint 2

Rama `docs/progreso-sprint2`. Se actualiza la documentación de progreso sin cambiar el código de producción. `sprint-2.md` deja de ser un stub y registra los PBIs ya integrados de Diario (aislamiento por usuario), Muro (roles, UI administrativa, modal de lectura y reacciones semánticas) y El Velo (escucha ciega y cola administrativa), además del trabajo abierto. `requisitos.md` incorpora las filas de El Velo y del rol `editor` como decisión YAGNI, y actualiza la suite a 11 suites y 169 tests. `arquitectura.md` añade una sección de modelos de Mongoose (`Debate` y `VeloTrack`) y reorganiza los endpoints por dominio. `decisiones.md` registra D-23 (YAGNI del rol editor), D-24 (portadas por URL externa sin multipart) y D-25 (anonimato administrativo con `isAnonymous`), y corrige el estado de D-05 y D-07. `README.md` presenta las tres experiencias del MVP y su estado actual; `index.md` y `procesos.md` se alinean con el Sprint 2.

La suite se mantiene en **11 suites y 169 tests pasados** (`npm test -- --runInBand`); esta actualización no modifica el código de producción.

## 2026-11-05 — El Velo (escucha ciega diaria) y cola musical administrativa

Rama `feature/velo-escucha-ciega`. Se añade El Velo, una pista diaria que permanece oculta hasta que el usuario envía su reflexión. El modelo `VeloTrack` guarda `releaseDate`, `audioUrl`, `title`, `artist`, `coverUrl` y un array de reflexiones con `userId`, `text` y `createdAt`; `releaseDate` es único y se normaliza a medianoche UTC a partir del día calculado en `Europe/Madrid`. De este modo solo puede existir una pista por fecha y el “día actual” no depende de la zona horaria del proceso.

El backend incorpora `GET /api/velo/today` y `POST /api/velo/today/reflect` con `authMiddleware`. Mientras el usuario no haya participado, el primer endpoint devuelve exclusivamente `{ audioUrl }`; cuando ya existe una reflexión suya, devuelve los metadatos y todas las voces. La segunda ruta recorta el texto, exige entre 1 y 5000 caracteres, impide un segundo envío con `409` y registra la reflexión con una actualización atómica que filtra por `reflections.userId: { $ne: userId }`. El muro de voces usa `text`, `userId` e `isMine`, sin exponer correos.

La administración de la cola se resuelve con `POST /api/velo/tracks`, `GET /api/velo/tracks` y `PUT /api/velo/tracks/:id`, todos protegidos por `authMiddleware` e `isAdminMiddleware`. El listado devuelve el estado `past`, `today` o `future` y el número de reflexiones; la edición bloquea las pistas pasadas y devuelve `409` si la nueva fecha ya está ocupada. `admin.html` y `admin.js` añaden la sección “La Cola del Velo”, con formulario de alta, edición y tabla de estados.

El frontend añade `velo.html` y `velo.js`. El estado ciego solo monta el reproductor y el textarea; no inserta título, artista ni portada. El estado revelado muestra la portada, los metadatos, el reproductor y el muro de reflexiones, con la propia marcada como “Tu reflexión” y las demás numeradas como “Voz 01”, “Voz 02”, etc. El reproductor usa `<audio controls>` para archivos directos y transforma enlaces conocidos de YouTube, Spotify, SoundCloud, Vimeo y Bandcamp en iframes embebibles. `api.js` centraliza `obtenerVeloDelDia`, `reflexionarVelo`, `crearPistaVelo`, `listarPistasVelo` y `actualizarPistaVelo`. La navegación de muro, diario y administración incorpora el enlace a El Velo.

La suite queda en **11 suites y 169 tests pasados** (`npm test -- --runInBand`), con pruebas nuevas de esquema, repositorio, servicio, contrato HTTP, capado de la respuesta y permisos administrativos.

## 2026-11-02 — Modal de lectura profunda y avisos temporales

La expansión en línea del muro se sustituye por un modal de lectura profunda. Las tarjetas de más de 250 caracteres conservan el recorte con `...` y el botón “Leer más”; al pulsarlo, o al hacer clic en la tarjeta, se abre un diálogo centrado de 720 px como máximo sobre un backdrop oscurecido. El modal usa fondo translúcido con `backdrop-filter`, bordes y acentos dorados, muestra título, autor, fecha y contenido completo con `textContent`, se cierra con la “X”, el backdrop o `Escape` y restaura el scroll previo. Los clics en reacciones y papelera no abren la lectura.

Los avisos de `mostrarEstado` incorporan una transición CSS de opacidad y desplazamiento y un `setTimeout` de 3,5 segundos para desaparecer. Los estados de carga, error de carga y muro vacío se mantienen visibles. Cada nueva llamada cancela los temporizadores anteriores.

## 2026-11-01 — Scrollbar del formulario, autor anónimo y redirección al muro

Se pule el diálogo de creación del muro. En el formulario, solo el `<textarea>` usa el scrollbar fino dorado del Diario (`scrollbar-width`, `::-webkit-scrollbar`, track transparente sobre el fondo oscuro y thumb dorado), de modo que desaparece la barra blanca nativa. El contenedor `.admin-dialog` deja de limitar su altura y de tener `overflow-y`; no introduce scroll propio. Las reflexiones de más de 250 caracteres se muestran colapsadas con `...` y “Leer más”, y la tarjeta o el control alternan el texto completo con “Mostrar menos”. Este comportamiento se sustituyó después por el modal de lectura profunda.

El modelo `Debate` incorpora `isAnonymous` como booleano con `false` por defecto. El servicio solo acepta booleanos y normaliza la ausencia del campo; el router devuelve el flag y fuerza `authorEmail: null` cuando la reflexión es anónima. En el muro, el autor no anónimo se muestra sin el dominio del correo (`admin@querencia.es` → `admin`) y el anónimo como “Publicado por Anónimo”. El diálogo de administración añade una casilla “Publicar como anónimo” con checkbox personalizado en dorado.

El login de `index.html` y el callback de Google redirigen ahora a `muro.html`. El registro intenta iniciar sesión automáticamente para entrar al muro; si la cuenta sigue pendiente de verificación, muestra el aviso correspondiente sin crear una sesión ficticia.

La suite queda en **8 suites y 117 tests pasados** (`npm test -- --runInBand`), con pruebas nuevas para el flag de anonimato en modelo, servicio y router, incluida la ocultación de `authorEmail`.

## 2026-11-01 — Rediseño UX del muro, borrado y portadas por URL

Sobre la rama `feature/RF-MVP-muro-admin-seed` se retira el botón de creación del flujo normal del muro. En su lugar, `muro.js` construye un botón flotante fijo en la esquina inferior derecha con el mismo icono de lápiz del Diario y un diálogo modal para publicar. Ambos nodos, junto con la papelera de cada tarjeta, solo se insertan en el DOM cuando `obtenerUsuarioActual()` devuelve rol `admin`; un oyente no tiene ningún punto de entrada de administración.

El backend incorpora `DELETE /api/debates/:id` con `authMiddleware` e `isAdminMiddleware`. `DebateRepository.deleteById` valida el `ObjectId` y usa `findByIdAndDelete`; el servicio traduce la ausencia del debate a `DebateNotFoundError` y el router responde `200` con `{ deleted: true, _id }` o `404`. El frontend añade `api.eliminarDebate(id)`, muestra una papelera por tarjeta solo a administradores y recarga el muro tras confirmar el borrado.

El modelo `Debate` incorpora `coverImageUrl` opcional, recortado y limitado a 2048 caracteres. El servicio exige `http` o `https`, el formulario del diálogo incluye un campo de URL y la tarjeta renderiza esa imagen como portada, con el placeholder existente como respaldo si falta o falla. El seed incluye una portada de Camarón de la Isla y Paco de Lucía, completa la portada si el debate ya existía sin ella y carga `backend/.env` por ruta absoluta para poder ejecutarse desde la raíz.

La suite queda en **8 suites y 111 tests pasados** (`npm test -- --runInBand`), con pruebas nuevas para el campo de portada, el borrado en modelo, servicio y router, y los permisos del endpoint.

## 2026-11-01 — UI de administración, reacciones semánticas y seed del muro

Rama `feature/RF-MVP-muro-admin-seed`. El muro pasa de seis reacciones a tres etiquetas semánticas exactas: `profundo` (“Profundo”), `melancolico` (“Melancólico”) y `rompeEsquemas` (“Rompe esquemas”). `debateConstants.js` centraliza claves y etiquetas; `debateRouter.js` devuelve `label`, `count` y `reactedByMe`; el modelo mantiene cada reacción como un array de `ObjectId` y el toggle sigue resolviéndose con `$pull` y `$addToSet`. Las claves retiradas `intimo`, `inquietante` y `tecnologico` dejan de exponerse y no se ejecuta una migración destructiva.

En el frontend, `muro.js` construye el botón “Crear nueva reflexión” y su formulario solo cuando `obtenerUsuarioActual()` devuelve rol `admin`; para un oyente no existen nodos del panel en el DOM. El formulario usa `api.crearDebate(title, content)` y el backend mantiene la autorización real con `authMiddleware` e `isAdminMiddleware`. `muro.html` solo añade los estilos del panel, con glassmorphism oscuro y acentos dorados, sin iconos ni emojis.

Se añade `seedDebate.js` y el comando `npm run seed`. El seed crea un debate sobre el duende, Camarón de la Isla y el consumo musical inmediato, es idempotente por título y resuelve el autor con `SEED_AUTHOR_EMAIL`, el primer administrador o un autor técnico si la base está vacía. Se registran las decisiones D-17 y D-18 y se actualizan D-14 y D-16. La suite queda en **8 suites y 97 tests pasados** (`npm test -- --runInBand`).

## 2026-11-01 — MVP del Muro de Debates (RF-MVP-Muro)

Rama `feature/RF-MVP-muro-debates`. Se añade el modelo `Debate` con título, contenido, autor, fecha generada por el servidor y seis reacciones del alma (`rompeEsquemas`, `profundo`, `melancolico`, `intimo`, `inquietante`, `tecnologico`) almacenadas como arrays de `ObjectId` de `User`. El repositorio resuelve el toggle con `$pull` y `$addToSet`, de modo que cada usuario puede votar o retirar su voto sin duplicados. Se incorporan `POST /api/debates` con `authMiddleware` e `isAdminMiddleware`, `GET /api/debates` público con autenticación opcional y `POST /api/debates/:id/react` protegido. Se registran las decisiones D-14, D-15 y D-16.

En el frontend, `muro.html` elimina las tarjetas estáticas y carga el muro desde la API mediante `api.listarDebates()`; `muro.js` renderiza las tarjetas con las clases CSS existentes, conserva el placeholder de portada y el efecto de aura, y conecta cada reacción con `api.reaccionarDebate(id, reaction)`, enviando el token de `localStorage`. Se mantienen intactos el diseño, el canvas y los estilos de scroll. La suite queda en **8 suites y 93 tests pasados** (`npm test -- --runInBand`), 43 de ellos nuevos para el muro.

## 2026-11-01 — Icono de nueva entrada en la vista de lectura

Se sustituye el botón de texto “← Volver” del Diario Íntimo por un botón circular con icono de lápiz, situado junto a la papelera en la esquina superior derecha de la lectura. Ambos comparten la clase `reading-action` y, por tanto, el mismo tamaño, hover y foco; el lápiz usa el dorado de la web y la papelera conserva el rojo reservado a la acción destructiva. El botón conserva el `id="backToEditorBtn"`, de modo que el manejador existente sigue funcionando; además, limpia el título y el texto antes de devolver al editor. No se modifican IDs estructurales ni la lógica de borrado.

## 2026-11-01 — Corrección de scroll en el Diario Íntimo

Se ajusta el CSS de `diario.html` para que la lista “Tus Ecos” tenga scroll independiente con `flex: 1`, `min-height: 0` y `overflow-y: auto`, sin desplazar el resto de la interfaz. El `<textarea>` del editor y la vista de lectura también limitan su altura y gestionan su propio scroll. Se unifica un estilo de scrollbar fino en tono dorado para la lista, la lectura y el editor. No se modifican IDs, clases estructurales ni el JavaScript.

## 2026-10-31 — Ampliación del Diario Íntimo: título, lectura y borrado

Rama `feature/RF-MVP-frontend-diario`. Se completa el PBI con `title` opcional de máximo 50 caracteres en `DiaryEntry` y en la API, lectura del eco completo al pulsarlo y borrado mediante `DELETE /api/diario/:id`. El repositorio ejecuta `findOneAndDelete({ _id, userId })`, por lo que solo elimina ecos del usuario autenticado; un eco inexistente o ajeno devuelve `404`. En el frontend, la barra lateral muestra el título o un extracto de 40 caracteres, y el formulario envía `{ text, title }` mediante `api.crearEntradaDiario`. Se añaden pruebas de modelo, servicio y router: 5 suites y 50 tests pasados, 40 de ellos del diario.

## 2026-10-31 — Frontend del Diario Íntimo (RF-MVP-Diario-Frontend)

Rama `feature/RF-MVP-frontend-diario`. Se registra la decisión D-11 sobre el consumo de la API con rutas relativas. `diario.html` carga el historial “Tus Ecos” con `api.listarDiario()` y guarda entradas con `api.crearEntradaDiario(text)`; `api.js` centraliza `POST/GET /api/diario` y reutiliza `fetchAutenticado`, que añade el token de `localStorage` y gestiona el `401`. Se comprueba la sintaxis de los módulos y la suite Jest sigue en 5 suites y 31 tests; la prueba funcional completa requiere una sesión real en el navegador.

## 2026-10-30 — Backend del Diario Íntimo (RF-MVP-Diario)

Rama `feature/RF-MVP-backend-diario`. Se registran las decisiones D-08, D-09 y D-10; se añade el esquema `DiaryEntry`, el servicio `diaryService`, los endpoints `POST/GET /api/diario` protegidos por `authMiddleware` y 21 pruebas unitarias con dobles de repositorios y autenticación. La suite completa queda en 5 suites y 31 tests pasados.

## 2026-10-19 — Corrección de la cabecera y del cierre de sesión

Commit `328caa0`, integrado en `main` por el merge `9ba45d1`. El mensaje indica que completa la cabecera dinámica y corrige la lógica de logout.

## 2026-10-18 — Corrección del logger para App Engine

Commit `c21ac1f`, integrado en `main` por el merge `56a6e38`. El mensaje indica que elimina la escritura en la carpeta `logs` para evitar un fallo en Google App Engine.

## 2026-10-18 — Dependencia de producción

Commit `832cc3f`, integrado en `main` por el merge `f3cee83`. El mensaje indica que añade `jsonwebtoken` para solucionar el despliegue en App Engine.

## 2026-10-17 — Estado de usuario en la cabecera

Commit `71f43c3`, integrado en `main` por el merge `8dd7a8e`. El mensaje indica que implementa el estado de usuario en la cabecera y el logout global.

## 2026-10-15 — Prueba técnica del Sprint 1

Commit `129fa70`, integrado en `main` por el merge `b50bd18`. Añade el endpoint y las pruebas de validación de dominio.

## 2026-10-10 — CI/CD y despliegue

Commit `27b848b`, integrado en `main` por el merge `9907494`. El mensaje indica que unifica el pipeline de pruebas y despliegue continuo hacia GCP.

## 2026-10-02 — Confirmación de cuenta por correo

Commits `91a0501` y `40d9447`, integrados en `main` por el merge `d2627f7`. Implementan la verificación por correo y actualizan sus pruebas.

## 2026-10-02 — OAuth de Google

Commits `8dcaaae` y `1f76998`, integrados en `main` por los merges `e426025` y `b960093`. Implementan la estrategia OAuth y el botón de inicio de sesión.

## 2026-09-25 — Inicio del repositorio

El historial muestra el commit inicial `7f69f68`. Los detalles de PR y la confirmación de integración se deben comprobar en la pestaña Pull requests de GitHub: **Por verificar**, porque `gh` no tenía una sesión autenticada.
