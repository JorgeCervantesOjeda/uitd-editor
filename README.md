# UITD Editor

Aplicación web para crear, editar, validar, recorrer y exportar modelos UITDL (User Interface Transition Diagram Language) mediante un lienzo visual y un editor textual sincronizable.

## Capacidades principales

- Edición visual de interfaces, acciones, condiciones, transiciones, fragmentos y nesting.
- Edición textual UITDL con Monaco, resaltado, autocompletado y diagnósticos por línea.
- Aplicación explícita del texto validado al diagrama visual, con soporte de deshacer.
- Apertura, formato y descarga de archivos `.uitd`.
- Ejemplo UITDL validado y recuperación automática del borrador textual.
- Recorrido HTML interactivo de estados y transiciones, incluida la herencia por inclusión.
- Generación y edición de D2.
- Renderizado D2 con ELK o Dagre y descarga del SVG saneado.
- Temas claro y oscuro persistentes para las herramientas textuales.
- Importación y exportación del proyecto visual, UITDL, SVG y JPG.

## Requisitos

- Node.js 20 o posterior.
- npm.

## Inicio rápido

```powershell
npm install
npm run dev
```

Abre la dirección que muestre Vite. En la aplicación, selecciona **Edit UITDL text** para abrir las herramientas textuales.

## Comandos

- `npm run dev`: iniciar el servidor de desarrollo con HMR.
- `npm run build`: comprobar TypeScript y generar `dist/`.
- `npm run test`: ejecutar las pruebas con Vitest.
- `npm run lint`: comprobar ESLint y texto mal codificado.
- `npm run preview`: servir localmente la compilación de producción.
- `npm run validate:uitd -- archivo.uitd`: validar UITDL con la versión fijada del validador oficial.

Ejemplos de validación:

```powershell
npm run validate:uitd -- ejemplo.uitd
npm run validate:uitd -- ejemplo.uitd --json
Get-Content ejemplo.uitd | npm run validate:uitd --
```

## Flujo textual recomendado

1. Abrir **Edit UITDL text**.
2. Escribir, abrir o cargar un ejemplo.
3. Resolver los errores indicados por Monaco y el panel de diagnósticos.
4. Usar **Preview HTML** para recorrer el comportamiento o **Generate D2** para generar una presentación alternativa.
5. Seleccionar **Apply to diagram** para sustituir el modelo visual mediante una operación reversible.
6. Guardar el archivo `.uitd` o exportar desde el lienzo.

La previsualización y el renderizado no demuestran corrección semántica. La validación es el criterio que bloquea la aplicación de texto inválido.

## Documentación

- [Documentación funcional y técnica](DOCUMENTACION_APP.md)
- [Guía editorial](GUIA_ESTILO_DOCS.md)
- [Instrucciones del repositorio](AGENTS.md)

## Estructura rápida

- `src/components/Canvas/`: lienzo, capas SVG, menús y diálogos.
- `src/components/UITDLTextPanel/`: editor textual, recorrido interactivo y herramientas D2.
- `src/import/uitdl/`: lexer, parser, validador oficial y construcción del modelo.
- `src/export/uitdl.ts`: serialización visual a UITDL.
- `src/state/`: store Zustand y slices.
- `src/validation/`: validación semántica del diagrama visual.

## Consideraciones

- El borrador UITDL y el tema textual se guardan en `localStorage`.
- La API del portapapeles depende de los permisos y del foco del navegador; los fallos se muestran y registran.
- El compilador oficial D2 se carga sólo al renderizar. Su bloque diferido es grande debido al runtime WebAssembly, pero no forma parte de la carga inicial.
- Revisa `firebase.json` y `.firebaserc` antes de cualquier despliegue.
