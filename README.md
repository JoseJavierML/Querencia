# Querencia

SaaS de reflexión y debate musical diseñado para ir más allá de la escucha superficial. La plataforma combina un diario de escucha privado con foros de debate donde la comunidad evalúa las obras musicales utilizando "Reacciones del Alma" (acordes emocionales) en lugar de interacciones tradicionales.

Desarrollado para la asignatura Procesos de Ingeniería del Software (Curso 2026-2027).

## Tecnologías Elegidas (Justificación)
- **Backend (Node.js & Express):** Proporciona un entorno ligero y rápido para construir la API REST requerida, permitiendo mantener un ecosistema unificado en JavaScript.
- **Frontend (Vanilla JS / HTML):** Asegura una estricta separación de la capa de presentación sin la sobrecarga de compilación de *frameworks* complejos en la etapa inicial.
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

Las reflexiones de más de 250 caracteres aparecen colapsadas con puntos suspensivos y un control “Leer más”. Al pulsar la tarjeta o el control, el texto se expande y el enlace cambia a “Mostrar menos”; un nuevo clic lo vuelve a colapsar. Los clics en reacciones y en la papelera no alteran el estado del texto.

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

## Estado Actual (Sprint 1)
- [x] **Hito 1:** Esqueleto, backend (lógica en memoria), API, pruebas automatizadas, pipeline de Integración Continua (CI) y Despliegue Continuo (CD).
- [x] **Hito 2:** Interfaz frontend, registro e inicio de sesión, mantenimiento de sesión.
- [X] **Hito 3:** Persistencia real en base de datos y validación de roles.
- [X] **Hito 4:** Autenticación OAuth externa y confirmación por correo.

## Estado Actual (Sprint 2)
- [x] **RF-MVP-Diario:** backend del diario íntimo con esquema `DiaryEntry`, endpoints protegidos y pruebas unitarias con dobles.
- [x] **RF-MVP-Diario-Frontend:** guardado, historial “Ecos”, título opcional, lectura completa y borrado de ecos propios.
- [x] **RF-MVP-Muro:** backend del muro con reacciones `Profundo`, `Melancólico` y `Rompe esquemas`, toggle sin doble voto y creación reservada a administradores.
- [x] **RF-MVP-Muro-Frontend:** tarjetas dinámicas, reacciones autenticadas, portadas por URL y borrado visible solo para administradores.
- [x] **RF-MVP-Muro-Admin-UX:** botón flotante con lápiz y diálogo de creación que solo se renderizan para administradores.
- [x] **RF-MVP-Muro-Autor:** autor sin dominio de correo, casilla de anonimato y ocultación del correo en la API.
- [x] **RF-MVP-Muro-Lectura:** reflexiones de más de 250 caracteres colapsadas con “Leer más” y expansión desde la tarjeta o el control.
- [x] **RF-MVP-Auth-Redirect:** login y callback de Google redirigen al muro; el registro intenta iniciar sesión automáticamente.
- [x] **RF-MVP-Muro-Seed:** script `seedDebate.js` con un hilo inicial idempotente, portada musical y comando `npm run seed`.
