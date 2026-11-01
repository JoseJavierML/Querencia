# Cronología

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
