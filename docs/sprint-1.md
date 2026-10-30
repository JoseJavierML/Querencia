---
type: Sprint
title: Sprint 1
description: Hitos y retrospectiva del primer sprint según la especificación y el repositorio.
timestamp: 2026-10-30
---

# Sprint 1

La especificación define un sprint de un mes con cuatro hitos orientativos. El trabajo del tablero se puede consultar en [DoneTonic](https://app.donetonic.com/workspaces/1/projects/1/backlog); este documento no reproduce sus tareas.

## Hito 1: Esqueleto y backend

**Objetivo de la especificación:** repositorio y flujo con ramas y pull requests; CI y despliegue desde el inicio; lógica de usuarios, pruebas unitarias y API.

**Qué se hizo:** `server.js` expone la API; el modelo y la lógica de usuarios tienen pruebas; [ci.yml](../.github/workflows/ci.yml) define CI/CD. La ejecución local observada dio 2 suites y 10 tests pasados.

**PR y etiqueta:** el historial muestra merges con mensajes de PR, pero no se puede confirmar su correspondencia en GitHub sin `gh`. No hay etiqueta Git local. **Por verificar**.

**Desviaciones del flujo:** **Por verificar** en Pull requests de GitHub.

## Hito 2: Frontend y sesión

**Objetivo de la especificación:** separar presentación y comunicación; implementar registro, login, logout, sesión entre recargas y rutas protegidas.

**Qué se hizo:** las páginas están en `backend/frontend`; `api.js` y `auth.js` centralizan la comunicación; `server.js` expone registro, login, logout y sesión; los middleware protegen las rutas privadas.

**PR y etiqueta:** el historial contiene ramas y merges relacionados, pero la confirmación de PR requiere GitHub. No hay etiqueta Git local. **Por verificar**.

**Desviaciones del flujo:** **Por verificar** en Pull requests de GitHub.

## Hito 3: Persistencia y roles

**Objetivo de la especificación:** base de datos real, secretos fuera del código, roles y administrador, y registro de actividad.

**Qué se hizo:** Mongoose y MongoDB aparecen en `database.js` y `userModel.js`; `.env.example` contiene nombres de variables; `adminMiddleware.js` protege las rutas administrativas; Winston y Morgan registran actividad.

**PR y etiqueta:** el historial contiene commits de persistencia, roles, panel y logs, pero la confirmación de PR requiere GitHub. No hay etiqueta Git local. **Por verificar**.

**Desviaciones del flujo:** no se ha encontrado endpoint para crear el primer administrador y falta un endpoint administrativo para consultar si un usuario está activo.

## Hito 4: Servicios externos y cierre

**Objetivo de la especificación:** OAuth, confirmación por correo, manejo de errores, README completo y revisión final.

**Qué se hizo:** Passport implementa OAuth de Google; `mailer.js` prepara el correo y `server.js` procesa la confirmación; las rutas y `api.js` devuelven y muestran errores; el README documenta ejecución, pruebas y estado del sprint.

**PR y etiqueta:** el historial contiene commits de OAuth, correo y despliegue, pero la confirmación de PR requiere GitHub. No hay etiqueta Git local. **Por verificar**.

**Desviaciones del flujo:** el README menciona Render y el workflow actual usa App Engine. La URL pública y el envío real de correo quedan **Por verificar**.

## Retrospectiva

### Hechos

- El historial principal llega al merge `9ba45d1` del 2026-10-19.
- El repositorio local no tiene etiquetas Git.
- La prueba local observada pasó 10 tests en 2 suites.
- El workflow define jobs separados de prueba y despliegue.

### Qué funcionó

La aplicación estricta de GitHub Flow y el pipeline CI/CD. Cuando nos encontramos con el Error 503 en Google App Engine (causado por la escritura de archivos de Winston en un sistema de solo lectura), pudimos aislar el problema rápidamente en la rama hotfix/logger-appengine, refactorizar la salida a la consola estándar y desplegar en main sin detener el resto del desarrollo del equipo.

### Qué cambiaría

Mejorar el aislamiento de la manipulación del DOM mediante JavaScript. Al integrar la cabecera dinámica de usuario, el script auth.js inyectó componentes que destruyeron temporalmente el diseño CSS original (Glassmorphism) y rompió la vista index.html. Para el Sprint 2, evaluaremos el impacto en la interfaz antes de hacer manipulaciones globales del DOM, como hicimos finalmente en feature/auth-header-ui-fix.
