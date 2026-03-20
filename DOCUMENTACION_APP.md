# Documentación de UITD Editor

## 1. Descripción general

UITD Editor es una aplicación web para modelar diagramas UITDL (User Interface Transition Diagram Language) en un lienzo visual.
Permite crear UIs, acciones, condiciones y transiciones, validar reglas semánticas del modelo e importar/exportar representaciones UITDL.

Stack principal:
- React 19
- TypeScript
- Zustand (estado global)
- Vite (build/dev server)

## 2. Estructura del proyecto

Carpetas clave:
- `src/components/Canvas/`: lienzo principal, capas SVG, menus, dialogs y barra superior.
- `src/state/`: store de Zustand y slices de interacción/edición.
- `src/validation/diagramValidation.ts`: validador del grafo del editor.
- `src/import/uitdl/`: lexer, parser, integración con el validador oficial UITDL y construcción de modelo importado.
- `src/export/uitdl.ts`: serialización del modelo a UITDL.
- `src/model/`: tipos base (`NodeBox`, `ActionLabel`, `ConditionLabel`, `Edge`, etc.).
- `src/layout/`: utilidades de medicion y layout.
- `public/`: assets estaticos.
- `dist/`: salida de producción.

Entrada de la app:
- `src/App.tsx`: renderiza `Canvas`.
- `src/components/Canvas/Canvas.tsx`: orquesta render, interacciones y dialogs de edicion.

## 3. Modelo de datos

Entidades principales:
- UI: `NodeBox` con `id`, `title`, `displayId` (UIID), posición, dimensiones y `parentId` opcional para contención.
- Action: `ActionLabel` asociada a una UI (`originNodeId`) con `verb` y `complement`.
- Condition: `ConditionLabel` asociada a una acción (`originActionId`).
- Edge: arista tipada entre `node`, `action` o `condition`.

Relación conceptual de transición:
- UI -> Action -> (opcional Condition) -> UI destino.

## 4. Flujo funcional

1. El usuario edita el diagrama en el lienzo SVG.
2. El estado vive en Zustand (`src/state/store.ts` + slices).
3. La vista de Canvas renderiza por capas (nodos, aristas, labels, overlays).
4. La validación produce issues (`error`/`warning`) para el panel de diagnóstico.
5. El modelo puede exportarse a UITDL o reconstruirse desde importación UITDL.
6. La exportación a UITDL valida el texto generado con el validador oficial antes de descargarlo.

## 5. Validación del diagrama

Archivo principal:
- `src/validation/diagramValidation.ts`

Tipos de chequeos:
- integridad de endpoints de aristas;
- ownership correcto de acciones/condiciones;
- consistencia de UIID y títulos;
- duplicados y conflictos de transiciones;
- uso de acciones declaradas;
- cobertura de entradas/salidas de UIs.

Reglas de cobertura actuales (incluyendo contención):
- Una UI no cae en `UI_NO_OUTGOING` si puede salir por transiciones de alguna UI contenida (descendiente).
- Una UI no cae en `UI_UNREACHABLE` si puede ser alcanzada por transiciones hacia alguna UI contenedora (ancestro).

## 6. Importación y exportación UITDL

Importación:
- `src/import/uitdl/lexer.ts`
- `src/import/uitdl/parser.ts`
- `src/import/uitdl/officialValidator.ts`
- `src/import/uitdl/build.ts`

Exportación:
- `src/export/uitdl.ts`
- `src/components/Canvas/TopToolbar/menus/ExportMenu.tsx`

Objetivo:
- mantener correspondencia entre modelo visual y representación textual UITDL.
- bloquear exportaciones con errores de UITDL y confirmar advertencias antes de descargar.

## 7. Comandos de desarrollo

Desde la raiz del repo:

- `npm run dev`: inicia Vite con HMR.
- `npm run build`: compila TypeScript y genera build de producción.
- `npm run lint`: ejecuta ESLint.
- `npm run preview`: sirve la build localmente.

## 8. Convenciones de trabajo

- Componentes React en `PascalCase.tsx`.
- Hooks con prefijo `use`.
- Slices de estado en `src/state/slices/*.slice.ts`.
- Mantener consistencia de estilo por archivo y validar con `npm run lint`.

## 9. Despliegue y configuración

Archivos relacionados:
- `firebase.json`
- `.firebaserc`

Recomendaciones:
- no commitear secretos;
- revisar configuracion de hosting antes de desplegar.
