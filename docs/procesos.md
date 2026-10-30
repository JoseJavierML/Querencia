---
type: Proceso
title: Flujo de trabajo, CI y despliegue
description: Proceso observable en el historial y en el workflow de GitHub Actions.
timestamp: 2026-10-30
---

# Procesos

## Flujo de trabajo

El historial local muestra ramas de funcionalidad, documentación y corrección integradas mediante commits de merge en `main`. No hay etiquetas Git en el repositorio local. La confirmación de que cada integración pasó por un pull request requiere revisar Pull requests de GitHub: **Por verificar**, porque `gh` no estaba autenticado.

## Integración continua

En [ci.yml](../.github/workflows/ci.yml), los eventos `pull_request` contra `main` y `push` a `main` ejecutan un job con Ubuntu y Node.js 22. El job instala dependencias con `npm ci` dentro de `backend` y ejecuta `npm test`. La comprobación local equivalente observada fue: **2 suites pasadas, 10 tests pasados, 0 snapshots**.

## Despliegue continuo

El job `deploy` depende de `test` y solo se ejecuta en `push` a `main`. Reconstruye `backend/app.yaml`, autentica en Google Cloud y ejecuta `gcloud app deploy`. La ejecución real del workflow y la disponibilidad de la URL pública quedan **Por verificar**.

## Variables de entorno

Los nombres declarados en [backend/.env.example](../backend/.env.example) son `PORT`, `MONGO_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_USER`, `EMAIL_PASS` y `ALLOWED_DOMAINS`. No se documentan sus valores.
