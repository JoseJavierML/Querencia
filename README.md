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

El diario es privado: cada usuario autenticado solo puede crear y listar sus propias entradas. Todas las peticiones requieren la cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/diario` | `{ "text": "..." }` | `201` con `{ "_id", "text", "createdAt", "userId" }` |
| GET | `/api/diario` | — | `200` con las entradas propias, de la más reciente a la más antigua |

- `text` es obligatorio, se recorta con `trim` y admite entre 1 y 5000 caracteres.
- `createdAt` lo genera el servidor; el cliente no puede enviarlo.
- `userId` es el `ObjectId` del usuario autenticado y referencia al modelo `User`.
- `DIARY_MAX_TEXT_LENGTH` permite reducir el límite de caracteres; si no se define, se usan 5000.

Ejemplo de creación de una entrada:

```bash
curl -X POST http://localhost:3000/api/diario \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Primera escucha del día"}'
```

## Estado Actual (Sprint 1)
- [x] **Hito 1:** Esqueleto, backend (lógica en memoria), API, pruebas automatizadas, pipeline de Integración Continua (CI) y Despliegue Continuo (CD).
- [x] **Hito 2:** Interfaz frontend, registro e inicio de sesión, mantenimiento de sesión.
- [X] **Hito 3:** Persistencia real en base de datos y validación de roles.
- [X] **Hito 4:** Autenticación OAuth externa y confirmación por correo.

## Estado Actual (Sprint 2)
- [x] **RF-MVP-Diario:** backend del diario íntimo con esquema `DiaryEntry`, endpoints protegidos y pruebas unitarias con dobles.
