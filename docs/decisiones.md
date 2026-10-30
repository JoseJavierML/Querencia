---
type: Decisiones
title: Decisiones técnicas detectadas
description: Decisiones observables en el código, el README y el historial.
timestamp: 2026-10-30
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
