# Cronología

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
