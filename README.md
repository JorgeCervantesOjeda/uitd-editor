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
- `npm run validate:uitd -- archivo.uitd`: valida un archivo UITDL con el validador compartido.

## Validador UITDL

Este proyecto delega `npm run validate:uitd` al validador compartido externo.

Ruta usada por defecto:

- `C:\Users\usuario\ownCloud2\UITD text language\uitd-editor\scripts\validate-uitd.js`

Si el validador está en otra ubicación, configura una de estas variables de entorno antes de ejecutar el comando:

- `UITDL_VALIDATE_SCRIPT`
- `UITDL_VALIDATOR_SCRIPT`

Ejemplos:

- `npm run validate:uitd -- ejemplo.uitd`
- `npm run validate:uitd -- ejemplo.uitd --json`

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
