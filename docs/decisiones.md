---
type: Decisiones
title: Decisiones técnicas detectadas
description: Decisiones observables en el código, el README y el historial.
timestamp: 2026-11-01
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

**Qué se decidió:** persistir los debates en el modelo `Debate` con `title` (obligatorio, recortado, máximo 120 caracteres), `content` (obligatorio, recortado, máximo 5000 caracteres), `authorId` como `ObjectId` de `User`, `createdAt` generado por el servidor y un objeto `reactions` con seis claves fijas: `rompeEsquemas`, `profundo`, `melancolico`, `intimo`, `inquietante` y `tecnologico`. Cada clave es un array de `ObjectId` de usuarios, nunca un contador numérico.

**Por qué:** los arrays permiten saber qué usuarios han reaccionado y evitan votos infinitos. El toggle se resuelve con dos operaciones atómicas: `$pull` si el usuario ya había votado y `$addToSet` si no había votado. Si un usuario vuelve a pulsar la misma reacción, se le retira el voto.

**Estado:** vigente.

## D-15 — Contrato y permisos del muro de debates

**Qué se decidió:** `POST /api/debates` exige `authMiddleware` y `adminMiddleware`, recibe `{ title, content }` y responde `201`. `GET /api/debates` es público para respetar la lectura abierta del muro; si la petición incluye un token válido, calcula `reactedByMe` para el usuario y, si no lo incluye, devuelve ese campo en `false`. `POST /api/debates/:id/react` exige `authMiddleware`, recibe `{ reaction }` y devuelve `{ _id, reactions }` con el estado actualizado. Los errores se traducen a `400`, `401`, `403`, `404` o `500` según corresponda. No hay edición ni borrado de debates en este MVP.

**Por qué:** la creación queda reservada a administración sin crear roles nuevos, mientras que la lectura puede ser anónima o personalizada sin duplicar endpoints. El frontend envía el token para que los botones conserven su estado `active` tras recargar.

**Estado:** vigente.

## D-16 — Integración dinámica del muro en el frontend

**Qué se decidió:** `muro.html` deja de contener debates estáticos y carga las tarjetas desde `GET /api/debates` mediante `api.listarDebates()`. Las reacciones se envían con `api.reaccionarDebate(id, reaction)`, que añade el token mediante `fetchAutenticado`. El renderizado reutiliza las clases existentes (`debate-grid`, `debate-card`, `album-cover-wrapper`, `album-cover`, `debate-meta`, `debate-title`, `debate-text`, `reactions-container`, `reaction-tag`, `count` y `active`), conserva el placeholder de portada y el efecto de aura, y usa `textContent` para no inyectar HTML no confiable.

**Por qué:** mantiene intacta la maquetación y los estilos de scroll existentes, centraliza la comunicación en `api.js` y evita que un título o contenido malicioso se interprete como HTML.

**Estado:** vigente.
