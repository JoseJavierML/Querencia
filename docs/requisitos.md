---
type: Requisitos
title: Requisitos del MVP (Sprint 2 en curso)
description: Evaluación de los requisitos frente a la especificación y al repositorio, con el progreso del Sprint 2.
timestamp: 2026-11-05
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
| RF-MVP-Diario | Diario íntimo: crear, listar y borrar entradas propias con título opcional | hecho | `POST`, `GET` y `DELETE /api/diario` protegidos por `authMiddleware`; `diaryModel.js`, `diaryService.js` y `diaryRouter.js`; título opcional de máximo 50 caracteres; 40 pruebas unitarias con dobles. |
| RF-MVP-Diario-Frontend | Integración frontend del diario: guardado, historial “Ecos”, lectura y borrado | hecho | `diario.html` muestra el título o un extracto de 40 caracteres, abre el eco completo y permite eliminarlo; `api.js` centraliza `crearEntradaDiario(text, title)`, `listarDiario` y `eliminarEntradaDiario`. |
| RF-MVP-Muro | Muro de debates: crear y borrar (solo administradores), listar y reaccionar con toggle | hecho | `debateModel.js`, `debateService.js`, `debateRouter.js`; `POST /api/debates` y `DELETE /api/debates/:id` con `authMiddleware` e `isAdminMiddleware`; `GET /api/debates`; `POST /api/debates/:id/react`; tres reacciones (`profundo`, `melancolico`, `rompeEsquemas`) como arrays de `ObjectId` y etiquetas exactas en `debateConstants.js`; `coverImageUrl` opcional con validación `http`/`https`; `isAnonymous` booleano con `authorEmail: null` cuando es anónimo. En el momento de la integración del muro la suite tenía 8 suites y 117 tests; la suite completa actual es de 11 suites y 169 tests. |
| RF-MVP-Muro-Frontend | Integración frontend del muro: tarjetas dinámicas, portadas, autor recortado, borrado y reacciones autenticadas | hecho | `muro.html` carga `GET /api/debates` mediante `api.listarDebates()`, envía reacciones con `api.reaccionarDebate(id, reaction)` y borra con `api.eliminarDebate(id)`; renderiza `coverImageUrl` con placeholder de respaldo, muestra el autor sin dominio o “Publicado por Anónimo” y conserva las clases CSS, el efecto de aura, el canvas y los estilos de scroll. |
| RF-MVP-Muro-Lectura | Reflexiones largas colapsadas y modal de lectura profunda | hecho | `crearTarjeta` recorta con `...` el contenido de más de 250 caracteres y añade “Leer más”; la tarjeta y el botón abren `readingModal`, que muestra el texto completo con estética glassmorphism y acentos dorados. Se cierra con “X”, backdrop o `Escape` y restaura el scroll previo. Los clics en reacciones y papelera no abren la lectura. |
| RF-MVP-Muro-Notificaciones | Avisos del muro con desvanecimiento automático | hecho | `mostrarEstado` usa la clase `is-visible` y `setTimeout` de 3,5 s más una transición de 350 ms; carga, error de carga y muro vacío son persistentes. |
| RF-MVP-Muro-Admin | Botón flotante y diálogo de administración para crear reflexiones | hecho | `muro.js` construye el FAB con el lápiz del Diario, el diálogo y las papeleras solo si `obtenerUsuarioActual()` devuelve rol `admin`; para un oyente no hay nodos de administración en el DOM. El diálogo incluye la casilla “Publicar como anónimo”, el contenedor no tiene scroll propio y solo el textarea usa el scrollbar dorado. `api.crearDebate(title, content, coverImageUrl, isAnonymous)` envía `POST /api/debates` y el backend responde `403` si el rol no es administrador. |
| RF-MVP-Muro-Autor | Autor visible sin dominio de correo y anonimato opcional | hecho | El router devuelve el autor sin dominio y, si `isAnonymous` es `true`, fuerza `authorEmail: null`; `muro.js` muestra el nombre recortado o “Publicado por Anónimo” y el diálogo administrativo permite marcar la casilla. |
| RF-MVP-Roles | Gestión de roles `usuario` y `admin`; `editor` documentado pero no implementado | hecho | `userModel.js` usa `usuario` por defecto y `adminMiddleware.js` solo autoriza `role === 'admin'`. El rol `editor` se documenta como intención futura, pero no se asigna ni se comprueba en el MVP (YAGNI). |
| RF-MVP-Auth-Redirect | Redirección posterior al login y al registro | hecho | El login de `index.html` y el callback de Google redirigen a `muro.html`; el registro intenta iniciar sesión automáticamente y, si la cuenta queda pendiente de verificación, muestra el aviso sin crear una sesión ficticia. |
| RF-MVP-Muro-Seed | Script de datos de prueba para el muro | hecho | `backend/seedDebate.js` y `npm run seed`: crea un debate sobre el duende, Camarón y el consumo musical con portada flamenca, es idempotente por título, completa la portada si faltaba y resuelve un autor administrador o un autor técnico. |
| RF-MVP-Velo | El Velo: pista diaria, respuesta ciega y revelación tras la reflexión | hecho | `veloTrackModel.js`, `veloService.js` y `veloRouter.js`; `GET /api/velo/today` devuelve exclusivamente `audioUrl` sin participación y la pista completa con reflexiones después; `POST /api/velo/today/reflect` valida y recorta un texto de 1 a 5000 caracteres, guarda una única reflexión por usuario y responde `409` ante un segundo envío; `releaseDate` es única y se normaliza a medianoche UTC. |
| RF-MVP-Velo-Frontend | Estados ciego y revelado, reproductor y muro de voces de El Velo | hecho | `velo.html` y `velo.js`; el estado ciego solo monta el reproductor y el textarea, sin insertar título, artista ni portada; el revelado muestra portada, metadatos, fecha, reproductor y reflexiones con la propia marcada como “Tu reflexión” y las demás como “Voz NN”. Los audios directos usan `<audio controls>` y los enlaces de YouTube, Spotify, SoundCloud, Vimeo y Bandcamp se convierten en iframes embebibles. |
| RF-MVP-Velo-Admin | Panel de encolado de pistas de El Velo para administradores | hecho | `admin.html` y `admin.js` incorporan “La Cola del Velo”; `POST`, `GET` y `PUT /api/velo/tracks` exigen `authMiddleware` e `isAdminMiddleware`; el listado devuelve estado `past`, `today` o `future` y número de reflexiones; la edición bloquea pistas pasadas y responde `409` si la fecha ya está ocupada. |
| RNF-01 | Persistencia en una base de datos real | hecho | Mongoose conecta con MongoDB y `User` persiste los usuarios. |
| RNF-02 | Secretos fuera del código y .env.example | hecho | `.env.example` declara los nombres y el workflow usa secretos de GitHub. |
| RNF-03 | Hash seguro de contraseñas | hecho | `bcrypt.hash` y `bcrypt.compare` en `userModel.js`. |
| RNF-04 | Rutas protegidas por sesión y rol | hecho | `authMiddleware` e `isAdminMiddleware` protegen las rutas privadas. |
| RNF-05 | Despliegue en cloud con URL pública | parcial | Hay workflow y configuración de App Engine; la URL pública operativa queda por verificar. |
| RNF-06 | Pruebas unitarias de la lógica (5 o más) | hecho | `backend npm test -- --runInBand`: 11 suites, 169 tests pasados. |
| RNF-07 | Manejo de errores con feedback al usuario | hecho | Las rutas devuelven mensajes y `api.js` propaga errores al frontend. |
| RNF-08 | Registro de actividad (log) | hecho | Winston y Morgan se configuran en `logger.js` y `server.js`. |
| PRO-01 | Flujo de trabajo GitHub Flow | Por verificar | El historial muestra ramas y merges; revisar Pull requests de GitHub porque `gh` no está autenticado. |
| PRO-02 | Integración continua | hecho | [ci.yml](../.github/workflows/ci.yml) ejecuta `npm ci` y `npm test` en PR y en `main`. |
| PRO-03 | Despliegue continuo | parcial | El workflow despliega después de CI en `push` a `main`; la ejecución real queda por verificar. |

