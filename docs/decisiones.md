---
type: Decisiones
title: Decisiones técnicas detectadas
description: Decisiones observables en el código, el README y el historial.
timestamp: 2026-11-02
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

## D-05 — Sesiones mediante tokens en memoria del proceso

**Qué se decidió:** gUtilizar tokens JWT stateless validados criptográficamente en el backend y almacenados en el localStorage del cliente (querencia_user y querencia_token), abandonando cualquier gestión de sesión en la memoria de Node.js.

**Por qué:** es lo que implementan `authMiddleware.js`, `api.js` y `auth.js`. : Google App Engine utiliza un entorno efímero y auto-escalable. Si almacenamos la sesión en la memoria de un proceso de Node.js, las sesiones de los usuarios se perderían cada vez que el servidor se reinicia, se suspende por inactividad o levanta una instancia nueva. Un JWT permite que cualquier instancia valide al usuario sin depender de una memoria local.

**Estado:** vigente.

## D-06 — CI y despliegue desde GitHub Actions

**Qué se decidió:** ejecutar pruebas en PR y en `main`, y desplegar después de las pruebas en `push` a `main`.

**Por qué:** está definido en [ci.yml](../.github/workflows/ci.yml).

**Estado:** vigente.

## D-07 — Cambio de destino de despliegue documentado

**Qué se decidió:** el workflow actual despliega en Google App Engine.

**Por qué:** `ci.yml` reconstruye `app.yaml` y ejecuta `gcloud app deploy`; el historial contiene `27b848b` con el cambio hacia GCP. El README aún menciona Render.

**Estado:** vigente en el workflow; la documentación pública del destino queda **Por verificar**.

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

**Qué se decidió:** el frontend consumirá la API mediante `fetch` a rutas relativas que empiezan por `/api`, sin URL absoluta ni configuración de CORS en el cliente.

**Por qué:** TODO (alumno)

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
