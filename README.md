# UITD Editor

Editor visual para modelar diagramas UITDL (User Interface Transition Diagram Language) con validación semántica, importación y exportación.

## Requisitos

- Node.js 20+ (recomendado)
- npm

## Comandos

Ejecuta desde la raíz del proyecto:

- `npm run dev`: inicia el servidor de desarrollo con HMR.
- `npm run build`: compila TypeScript y genera `dist/`.
- `npm run lint`: ejecuta ESLint.
- `npm run preview`: sirve la build de producción localmente.
- `npm run validate:uitd -- archivo.uitd`: valida un archivo UITDL con el validador oficial fijado en el proyecto.

## Validador UITDL

Este proyecto usa el paquete oficial `uitdl-validator` como dependencia de desarrollo fijada en el repositorio.

El comando `npm run validate:uitd` ejecuta el binario local `uitd-validate`, sin depender de rutas absolutas ni de otro repositorio vecino.

Tambien puede usarse por `stdin` cuando el contenido UITDL aun no existe como archivo.

La exportacion UITDL desde la interfaz valida primero el texto generado con ese mismo validador oficial. Los errores bloquean la descarga; las advertencias piden confirmacion.

Ejemplos:

- `npm run validate:uitd -- ejemplo.uitd`
- `npm run validate:uitd -- ejemplo.uitd --json`
- `Get-Content ejemplo.uitd | npm run validate:uitd --`

## Documentación

- Documentación técnica completa: `DOCUMENTACION_APP.md`
- Guía de estilo para documentación: `GUIA_ESTILO_DOCS.md`

## Estructura rápida

- `src/components/Canvas/`: lienzo, capas SVG, menús y diálogos.
- `src/state/`: store de Zustand y slices.
- `src/validation/`: validación del diagrama.
- `src/import/uitdl/`: lexer, parser y validación de AST UITDL.
- `src/export/uitdl.ts`: exportación a UITDL.

## Notas

- No hay framework de tests automatizados configurado actualmente.
- Revisa `firebase.json` y `.firebaserc` antes de cambios de despliegue.
