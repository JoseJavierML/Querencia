---
type: Sprint
title: Sprint 2
description: Progreso de ejecución del Sprint 2, con los PBIs del MVP y la épica de El Archivo cerrada.
timestamp: 2026-11-06
---

# Sprint 2

## Estado general

El Sprint 2 sigue en curso, pero la épica **La Discoteca Interactiva (El Archivo)** queda cerrada funcionalmente. Esta página recoge el estado tras completar sus siete tareas: los PBIs de Diario, Muro, El Velo y El Archivo están implementados e integrados en la rama de trabajo `feature/archivo-frontend`, y la Tarea 7 conecta los vinilos cacheados con el Muro, el Diario y El Velo mediante un selector compartido y un tocadiscos global. El Archivo incorpora su backend, el modelo, la caché, el contrato HTTP, el frontend de cajones, la ficha detallada, el tocadiscos propio y la reproducción transversal. Queda pendiente la verificación manual del flujo completo en navegador con una sesión real. El sprint no está cerrado y quedan abiertos los requisitos heredados del Sprint 1 y las verificaciones de correo, despliegue y proceso.

## Objetivo

Consolidar el MVP funcional de Querencia: un diario íntimo privado, un muro de debates con roles y reacciones semánticas, El Velo como escucha ciega diaria y El Archivo como discoteca interactiva con caché musical. El objetivo incluye mantener la suite automatizada, la documentación y el flujo de ramas al día.

## PBIs completados

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

### El Archivo

- **RF-MVP-Archivo-Busqueda.** `POST /api/archivo/buscar` acepta una consulta libre o un par artista-título, consulta Last.fm (`track.search` y `track.getInfo`), resuelve el audio con YouTube y responde `{ disco, cached, created, stale }` con `201` si crea la ficha y `200` si reutiliza la caché.
- **RF-MVP-Archivo-Cache.** El modelo `Vinyl` usa una `catalogKey` única calculada desde artista y título; `VinylRepository.upsertByCatalogKey` escribe con `findOneAndUpdate` y `upsert` atómicos. El TTL se controla con `ARCHIVO_CACHE_TTL_DAYS` y una ficha caducada se sirve como `stale` si Last.fm no responde.
- **RF-MVP-Archivo-Cajones.** `GET /api/archivo/cajones` agrupa por género o artista y devuelve `{ agrupacion, total, cajones }`; cada cajón incluye `clave`, `etiqueta`, `total` y `vinilos`.
- **RF-MVP-Archivo-Detalle.** `GET /api/archivo/disco/:id` devuelve la ficha completa con `lastFmInfo`, `catalogKey` y `playable`, y actualiza `lastAccessedAt`; los identificadores inválidos responden `400` y los inexistentes `404`.
- **RF-MVP-Archivo-Frontend.** `archivo.html` y `archivo.js` presentan la colección como cajones agrupables por género o artista. La vista consume `GET /api/archivo/cajones` mediante `api.listarCajonesArchivo(agrupacion)`, superpone las portadas con sombras, `z-index` y transformaciones, y ofrece estados de carga, vacío, error y reintento. La navegación de Muro, Diario, El Velo y el panel de administración incorpora el enlace a El Archivo.
- **RF-MVP-Archivo-Detalle-Frontend.** Un clic simple abre un modal con la carátula y la ficha de Last.fm. `api.obtenerDiscoArchivo(id)` consulta `GET /api/archivo/disco/:id` y la interfaz muestra título, artista, álbum, género, sinopsis, etiquetas, oyentes, reproducciones, duración, publicación y enlace externo. El modal se cierra con la «X», el fondo o `Escape`, restaura el foco y permite reintentar la consulta.
- **RF-MVP-Archivo-Reproduccion.** Los vinilos usan `draggable="true"` y los eventos nativos `dragstart`, `dragover`, `drop` y `dragend`. Al soltar un disco en el plato, `archivo.js` extrae su `youtubeVideoId`, carga la YouTube Iframe API en un reproductor oculto, inicia la reproducción y activa la animación `@keyframes spin`. El tocadiscos fijo permite pausar, reanudar y avisa cuando el vinilo no tiene audio.
- **Tarea 7 — Vinculación transversal.** `Debate`, `DiaryEntry` y `VeloTrack` incorporan un `vinylId` opcional con referencia a `Vinyl`. Las consultas de lectura pueblan la ficha pública del vinilo y las respuestas HTTP añaden `vinyl` y `vinylId` solo cuando existe vínculo, de modo que los contratos anteriores sin vinilo no cambian. En el Muro y en El Velo el enlace lo decide el administrador; en el Diario cada usuario puede adjuntar un vinilo a su propio eco.
- **Tarea 7 — Selector compartido.** `js/vinylPicker.js` construye un buscador de vinilos cacheados que reutiliza `GET /api/archivo/cajones?agrupar=artista` y filtra en cliente por título, artista, álbum o género. El selector se integra en el diálogo administrativo del Muro, en el formulario de la cola del Velo y en el formulario del Diario. `js/vinilos.css` centraliza los estilos del selector, del mini-vinilo y del tocadiscos.
- **Tarea 7 — Mini-reproductor global.** `js/vinylPlayer.js` renderiza un mini-vinilo estético en las tarjetas y el modal del Muro, en la lectura del Diario y en el estado revelado de El Velo. El mini-vinilo se puede pulsar o arrastrar hasta un dock fijo que carga la YouTube Iframe API bajo demanda, reproduce el `youtubeVideoId` del vinilo y permite pausar, reanudar y cerrar la escucha. Los vinilos sin audio muestran un aviso y no bloquean la publicación.
- **Estado de la épica.** La funcionalidad de El Archivo queda cerrada con la Tarea 7. No se añaden suites nuevas de interfaz; la verificación manual en navegador con MongoDB, una sesión real y audios de YouTube disponibles sigue siendo el paso pendiente antes de dar la épica por validada en producción.

## Verificación

- Suite automatizada: las suites de Diario, Muro, El Velo y El Archivo usan dobles de repositorio, autenticación y red. La última ejecución registrada antes de El Archivo fue de **11 suites y 169 tests pasados** con `npm test -- --runInBand`; la ejecución de las nuevas suites y de los ajustes de la Tarea 7 queda pendiente de confirmación local. La Tarea 7 no añade suites nuevas de interfaz.
- Sin pruebas automatizadas nuevas de interfaz: la verificación del frontend de El Archivo y de los vinilos transversales se apoya en la revisión manual del DOM, de los eventos de arrastre y de la reproducción en un navegador real.
- Revisión manual pendiente: flujo completo en navegador con MongoDB y una sesión real, cajones y ficha de El Archivo, arrastre al tocadiscos, reproducción de YouTube, selector y mini-vinilos en Muro, Diario y El Velo, y verificación de la URL pública.

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
