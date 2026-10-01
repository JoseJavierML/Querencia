# Querencia

SaaS de reflexión y debate musical diseñado para ir más allá de la escucha superficial. La plataforma combina un diario de escucha privado con foros de debate donde la comunidad evalúa las obras musicales utilizando "Reacciones del Alma" (acordes emocionales) en lugar de interacciones tradicionales.

Desarrollado para la asignatura Procesos de Ingeniería del Software (Curso 2026-2027).

## Tecnologías Elegidas (Justificación)
- **Backend (Node.js & Express):** Proporciona un entorno ligero y rápido para construir la API REST requerida, permitiendo mantener un ecosistema unificado en JavaScript.
- **Frontend (Vanilla JS / HTML):** Asegura una estricta separación de la capa de presentación sin la sobrecarga de compilación de *frameworks* complejos en la etapa inicial.
- **Pruebas (Jest):** Facilita la creación de pruebas unitarias automatizadas con aserciones claras y se integra nativamente con herramientas de CI.
- **CI/CD (GitHub Actions & Render):** GitHub Actions automatiza la ejecución de los tests en cada *pull request*, mientras que Render facilita el despliegue continuo de la rama principal a una URL pública.

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

## Estado Actual (Sprint 1)
- [x] **Hito 1:** Esqueleto, backend (lógica en memoria), API, pruebas automatizadas, pipeline de Integración Continua (CI) y Despliegue Continuo (CD).
- [ ] **Hito 2:** Interfaz frontend, registro e inicio de sesión, mantenimiento de sesión.
- [ ] **Hito 3:** Persistencia real en base de datos y validación de roles.
- [ ] **Hito 4:** Autenticación OAuth externa y confirmación por correo.
