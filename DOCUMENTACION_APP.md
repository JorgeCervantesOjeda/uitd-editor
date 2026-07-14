# Documentación funcional y técnica de UITD Editor

## 1. Alcance

UITD Editor modela diagramas UITDL mediante dos representaciones relacionadas:

- un diagrama visual editable en SVG;
- texto UITDL validado y aplicable explícitamente al diagrama.

La aplicación también puede derivar dos artefactos de presentación:

- un recorrido HTML interactivo;
- código D2 editable y un SVG renderizado con ELK o Dagre.

Estos artefactos ayudan a inspeccionar y comunicar el modelo. No sustituyen la validación sintáctica y semántica de UITDL.

## 2. Tecnologías

- React 19 y TypeScript.
- Zustand para el estado global del diagrama.
- Vite para desarrollo y compilación.
- Vitest y Testing Library para pruebas.
- Monaco Editor para UITDL y D2.
- `uitdl-validator` como validador oficial fijado en el proyecto.
- `@terrastruct/d2` para compilar y renderizar D2.
- DOMPurify para sanear SVG generado desde D2 editable.

## 3. Arquitectura

### 3.1 Entrada y composición

- `src/App.tsx`: compone el editor textual y el espacio de trabajo visual.
- `src/components/Canvas/Canvas.tsx`: coordina el lienzo y sus interacciones.
- `src/components/UITDLTextPanel/UITDLTextPanel.tsx`: coordina la experiencia textual.

El panel textual y el lienzo pueden sincronizarse de tres formas:

- recarga explícita desde el diagrama;
- aplicación explícita con **Apply to diagram**;
- sincronización en vivo en un solo sentido configurable.

La sincronización en vivo nunca opera en ambos sentidos a la vez.

### 3.2 Modelo visual

Las entidades principales están en `src/model/types.ts`:

- `NodeBox`: una `UI`, con UIID visible, título, posición, dimensiones y posible `parentId`.
- `ActionLabel`: acción disponible en una interfaz, con verbo y complemento.
- `ConditionLabel`: guard asociado a una acción.
- `Edge`: conexión tipada entre interfaz, acción o condición.

Una transición visual se representa conceptualmente como:

```text
UI de origen -> acción -> guard opcional -> UI de destino
```

### 3.3 Estado e historial

- `src/state/store.ts`: construye el store Zustand.
- `src/state/slices/`: separa creación, edición, selección, nesting, historial, portapapeles, cámara y otras operaciones.

Aplicar texto UITDL usa `captureDelta` para que la sustitución del modelo visual forme parte del historial reversible.

## 4. Editor visual

El lienzo permite:

- crear y editar interfaces, acciones y condiciones;
- conectar transiciones y cambiar destinos;
- seleccionar, copiar, cortar, pegar y eliminar;
- alinear y distribuir elementos;
- insertar interfaces dentro de otras;
- ejecutar la simulación de fuerzas;
- cambiar colores y fondo del lienzo;
- importar o guardar el proyecto visual;
- importar y exportar UITDL;
- exportar selecciones como SVG o JPG.

El panel de validación visual muestra errores y advertencias. Sus elementos se pueden seleccionar para localizar la entidad afectada y copiar como reporte de texto.

## 5. Editor textual UITDL

### 5.1 Apertura

El botón **Edit UITDL text** abre un panel lateral. En pantallas pequeñas ocupa el área disponible.

Al abrirlo:

1. se exporta el diagrama visual actual a UITDL;
2. se intenta recuperar el borrador de `localStorage`;
3. si el borrador difiere, se muestra que hay cambios pendientes.

La clave de persistencia del borrador es:

```text
uitd-editor/uitdl-text-draft
```

Si `localStorage` no está disponible, la aplicación conserva el borrador sólo en memoria y registra causa, fallback e impacto.

### 5.2 Funciones de Monaco

El editor configura:

- resaltado de palabras clave, números y cadenas;
- snippets para modelos, UIs, fragmentos, transiciones, guards y acciones;
- autocompletado contextual de UIIDs en `DRAW`;
- referencias de transición limitadas a las instancias disponibles en el `DRAW` del fragmento actual;
- sugerencias de verbo y complemento tomadas de las acciones declaradas por la UI de origen;
- hover sobre UIIDs con nombre y acciones declaradas;
- folding estructural con controles siempre visibles;
- minimapa y sugerencias dentro de cadenas;
- formateo nativo de documento mediante la misma implementación que usa **Format**;
- ajuste de línea;
- marcadores de error y advertencia;
- navegación desde un diagnóstico hasta su línea y columna.

Los diagnósticos se recalculan al cambiar el texto mediante `validateWithOfficialValidator`.

### 5.3 Acciones disponibles

- **Open .uitd**: abrir `.uitd`, `.uitdl` o texto plano.
- **Save .uitd**: descargar el borrador actual.
- **Format**: normalizar saltos estructurales e indentación.
- **Load example**: cargar un portal de reportes validado, con navegación reutilizable y guards.
- **Copy all**: copiar todo el texto con fallback observable.
- **Preview HTML**: abrir el recorrido interactivo si no hay errores.
- **Generate D2**: derivar código D2 si no hay errores.
- **Reload from diagram**: descartar el borrador y volver a exportar el lienzo.
- **Apply to diagram**: importar el texto validado al store visual y ejecutar el ajuste simulado del layout.
- **Live from canvas**: regenerar el texto UITDL desde cada cambio visual y dejar el editor en sólo lectura.
- **Live to canvas**: aplicar texto UITDL válido al canvas mediante reconciliación incremental.

Abrir otro archivo, cargar el ejemplo o recargar desde el diagrama pide confirmación si existe un borrador pendiente.

Los modos **Live from canvas** y **Live to canvas** son mutuamente excluyentes. Activar uno desactiva el otro.

### 5.4 Formateador

`src/components/UITDLTextPanel/formatUITDL.ts`:

- indenta bloques con cuatro espacios;
- coloca llaves y sentencias en líneas coherentes;
- normaliza espacios fuera de cadenas;
- conserva puntuación y espacios dentro de cadenas entre comillas;
- agrega un salto de línea final.

El formateador organiza texto; no corrige errores semánticos.

### 5.5 Aplicación al diagrama

**Apply to diagram** sólo se habilita cuando:

- no hay errores del validador oficial;
- el texto difiere de la última versión aplicada;
- no existe otra aplicación en curso.

El proceso:

1. muestra estado visible;
2. espera a que el navegador pinte ese estado;
3. importa el UITDL;
4. reemplaza nodos, acciones, condiciones, aristas y títulos de fragmento;
5. reajusta los contenedores incluidos;
6. selecciona temporalmente todos los elementos y muestra el progreso de simulación;
7. ejecuta el mismo ajuste por fuerzas usado al importar UITDL desde el lienzo visual;
8. limpia la selección y centra el diagrama al terminar;
9. conserva la importación como una operación en el historial.

La simulación puede interrumpirse explícitamente para conservar la disposición alcanzada. Si se detiene por estancamiento o por el límite de iteraciones, la interfaz mantiene el diagrama resultante e informa la causa.

Las advertencias no bloquean la aplicación, pero permanecen reportadas.

### 5.6 Sincronización incremental UITDL -> canvas

**Live to canvas** actualiza el canvas desde el texto UITDL después de una pausa breve de edición. La actualización no usa diálogos bloqueantes.

Reglas principales:

- si el texto tiene errores, no se modifica el canvas;
- el canvas conserva el último estado válido aplicado;
- si sólo existen advertencias, la actualización puede continuar;
- una acción declarada en `UI ... actions { ... }` no crea un óvalo por sí sola;
- las acciones se materializan visualmente sólo cuando aparecen en una `TRANSITION`;
- las acciones declaradas y no usadas permanecen como advertencia;
- se conserva la identidad visual de entidades equivalentes cuando es posible.

La reconciliación usa claves semánticas estables:

- UI: `UIID`;
- acción visual: `from UIID + verb + complement`, sólo si aparece en transición;
- condición: `from UIID + verb + complement + condition`;
- transición: `from ref + to ref + verb + complement + condition`;
- containment: relación `parent UIID -> child UIID` derivada de `DRAW`.

Antes de aplicar cualquier diff detectado, la interfaz:

1. selecciona lo que va a cambiar cuando ya existe en el canvas;
2. centra la cámara en esa selección;
3. ajusta zoom para ver toda el área seleccionada;
4. espera a que el cambio visual sea efectivo;
5. aplica el diff incremental;
6. selecciona el resultado final afectado;
7. centra y ajusta zoom si hace falta;
8. ejecuta simulación limitada sobre la selección resultante.

Cuando el cambio crea elementos que aún no existen en el canvas, la selección previa puede no tener entidades visibles. En ese caso, el feedback principal ocurre inmediatamente después de aplicar el diff, seleccionando y centrando los elementos creados o su contexto.

La simulación limitada no valida la semántica; sólo ajusta posiciones del área afectada. Cambios de nesting reajustan contenedores y ancestros.

## 6. UITDL soportado

La forma raíz recomendada es:

```uitdl
UITD "Título" {
    UI 1 "Inicio" actions {
        clicks "Continuar";
    }
    UI 2 "Fin" actions {}
    FRAGMENT "Flujo" {
        DRAW { 1, 2 };
        TRANSITION from 1 to 2 if user clicks "Continuar";
    }
}
```

### 6.1 Acciones

Los verbos soportados son:

```text
clicks, submits, selects, types, toggles,
uploads, downloads, saves, deletes, waits
```

Las acciones de una `UI` describen interacciones de la persona usuaria, no procesos internos automáticos.

### 6.2 Guards

`AND "Condición"` representa un guard evaluable antes o durante el disparo de la transición. No debe describir efectos posteriores, persistencia ni trabajo interno.

Ejemplo:

```uitdl
TRANSITION from 1 to 2 if user clicks "Continuar" AND "sesión activa";
```

### 6.3 Inclusión y referencias contenidas

La sintaxis recomendada de nesting en `DRAW` usa corchetes:

```uitdl
DRAW { 7[1] };
```

Esto declara que `UI 7` contiene `UI 1`. Cuando el estado actual es `7`, están disponibles las acciones directas de `7` y las heredadas de `1`.

Una referencia contenida en `TRANSITION` usa paréntesis:

```uitdl
TRANSITION from 7(1) to 2 if user clicks "Salir";
```

`7(1)` identifica la instancia dibujada de `UI 1` dentro de `UI 7`. El estado subyacente sigue siendo `UI 1`.

### 6.4 WIDTH

`WIDTH` es metadato visual, no comportamiento:

- `WIDTH n;` en un fragmento define el ancho predeterminado de sus etiquetas;
- `WIDTH n` en una transición reemplaza el valor del fragmento;
- `n` debe ser entero positivo;
- el ajuste no divide palabras.

## 7. Recorrido HTML interactivo

`InteractivePreview.tsx` y `interactivePreviewModel.ts` construyen una vista navegable desde texto UITDL validado.

La vista representa la composición de la aplicación:

- la interfaz actual como contenedor principal;
- cada interfaz incluida como una tarjeta insertada dentro de su contenedor;
- las acciones dentro de la interfaz que las declara, incluidas las acciones heredadas visibles mediante inserción;
- guards asociados en un diálogo modal que sólo aparece al activar su acción;
- los colores de UI, acción y condición del elemento equivalente en el canvas visual;
- destinos disponibles para cada guard;
- última transición recorrida.

La correspondencia cromática usa el `displayId` de la UI y las etiquetas de acción y condición. Cuando el texto todavía no existe en el canvas, la vista previa usa exactamente la paleta predeterminada del canvas para cada tipo de elemento.

### 7.1 Estado inicial

UITDL no declara un estado inicial. La herramienta selecciona inicialmente la primera `UI` declarada y muestra este supuesto. La persona puede seleccionar cualquier interfaz desde el control **Current UI**.

### 7.2 Guards

La herramienta no evalúa guards automáticamente porque no dispone del contexto de ejecución de la aplicación modelada. Cada acción aparece dentro de su UI de origen. Una acción sin condición ejecuta inmediatamente su única transición. Una acción condicionada abre un diálogo modal y siempre exige seleccionar una condición, incluso cuando sólo existe una.

Para que la navegación sea determinista, una misma acción de una interfaz no puede mezclar transiciones condicionadas y sin condición. Tampoco puede conducir a más de un destino para una misma condición ni para la rama sin condición. El editor reporta estas ambigüedades como errores de validación; repetir exactamente una transición en fragmentos distintos sí está permitido.

Cada fragmento debe formar un único componente conectado mediante transiciones o relaciones de inclusión. Una UI aislada en `DRAW` se reporta como error antes de aplicar el texto; debe eliminarse de ese fragmento o conectarse de forma semánticamente válida.

### 7.3 Alcance

El recorrido demuestra que la estructura validada puede navegarse según las transiciones modeladas. No demuestra que una aplicación real implemente esas interfaces o condiciones.

## 8. Generación y edición D2

`uitdlToD2.ts` traduce UITDL validado a D2 determinista.

Conserva:

- título del modelo;
- fragmentos;
- interfaces dibujadas;
- nesting;
- referencias contenidas de transición;
- verbos y complementos;
- guards;
- precedencia de `WIDTH`.

El editor D2 es independiente. Modificar D2 no modifica UITDL ni el diagrama visual. **Regenerate** descarta las ediciones D2 y deriva de nuevo desde UITDL.

Acciones disponibles:

- seleccionar ELK o Dagre;
- renderizar;
- regenerar desde UITDL;
- copiar D2;
- descargar `diagram.d2`;
- descargar `diagram.d2.svg` después de renderizar.

## 9. Renderizado ELK y Dagre

`renderD2.ts` usa el paquete oficial `@terrastruct/d2`:

```text
UITDL validado -> D2 -> compile(layout) -> render -> saneamiento -> SVG
```

### 9.1 Seguridad

El D2 es editable, por lo que su SVG se trata como contenido no confiable. Antes de insertarlo en el DOM se sanea con DOMPurify y perfiles SVG. Si el resultado no contiene un SVG utilizable, la operación falla de forma visible.

### 9.2 Errores

No existe fallback automático entre ELK y Dagre. Un error conserva el último SVG exitoso, registra causa, motor, fallback e impacto, y muestra el mensaje en el panel.

### 9.3 Rendimiento

El runtime WebAssembly oficial de D2 genera un bloque diferido cercano a 37 MB sin comprimir. Se carga sólo cuando se solicita el primer render. La carga inicial de la aplicación permanece alrededor de 460 KB sin comprimir en la compilación verificada para esta rama.

La primera renderización puede tardar más por la descarga e inicialización del runtime; la interfaz muestra progreso antes de comenzar.

### 9.4 Interpretación correcta

Un SVG renderizado demuestra que D2 pudo compilar y presentar el artefacto. No demuestra que el modelo UITDL sea semánticamente correcto; por eso la generación D2 se habilita únicamente desde texto sin errores del validador.

## 10. Temas

El panel textual ofrece temas claro y oscuro. La elección afecta:

- panel principal;
- Monaco UITDL;
- diagnósticos;
- recorrido HTML;
- panel y Monaco D2.

La preferencia se guarda en:

```text
uitd-editor/text-theme
```

El valor predeterminado es claro para conservar la apariencia histórica. Si la persistencia falla, el tema continúa activo mientras el panel permanezca abierto y el fallback se registra.

El tema textual no modifica el fondo oscuro configurable del lienzo; son preferencias independientes.

## 11. Importación, exportación y archivos

### 11.1 Proyecto visual

El menú **File** administra el formato serializado del editor visual, incluidas posiciones y propiedades propias del lienzo.

### 11.2 UITDL

La importación UITDL valida antes de reconstruir el modelo. La exportación visual a UITDL:

- bloquea errores;
- solicita confirmación ante advertencias;
- descarga `diagram.uitd`.

La descarga desde el panel textual guarda exactamente el borrador actual, que puede contener advertencias o errores. Esto permite conservar trabajo incompleto sin aplicarlo al diagrama.

### 11.3 Imágenes

El lienzo exporta SVG y JPG de la selección. El panel D2 exporta el SVG producido por el motor seleccionado.

## 12. Validación

### 12.1 Texto UITDL

`src/import/uitdl/officialValidator.ts` convierte los marcadores oficiales en `ParseIssue` con severidad y ubicación.

Errores:

- bloquean **Apply to diagram**;
- bloquean **Preview HTML**;
- bloquean **Generate D2**.

Advertencias:

- se muestran;
- no bloquean estas acciones.

### 12.2 Diagrama visual

`src/validation/diagramValidation.ts` comprueba, entre otros aspectos:

- integridad de endpoints;
- pertenencia de acciones y condiciones;
- UIID y títulos;
- transiciones duplicadas o conflictivas;
- correspondencia entre acciones y transiciones;
- entradas y salidas efectivas;
- alcance heredado por inclusión.

Una interfaz contenedora puede tener salida efectiva mediante una interfaz contenida. La alcanzabilidad también considera relaciones de contención documentadas por el modelo.

## 13. Feedback y accesibilidad

Las operaciones que pueden tardar muestran estado antes de iniciar:

- aplicación de UITDL;
- simulación posterior a una importación UITDL;
- apertura y formato;
- renderizado D2;
- preparación de descargas.

Los mensajes permanecen hasta que cambia la condición o la persona los descarta; no desaparecen mediante temporizadores.

Los modales:

- declaran `role="dialog"` y `aria-modal="true"`;
- contienen el foco;
- se cierran con Escape;
- devuelven el foco al control previo.

## 14. Portapapeles

La copia usa primero `navigator.clipboard.writeText`. Si falla o no está disponible, intenta un `textarea` temporal con `document.execCommand("copy")`.

Los fallos no son silenciosos: se registran causa, fallback e impacto y se muestra un estado de error. El navegador puede rechazar la copia cuando la pestaña no tiene foco o carece de permiso.

## 15. Pruebas

Ejecutar:

```powershell
npm run test
```

La suite cubre actualmente:

- importación y construcción UITDL;
- exportación y títulos de fragmentos;
- validación visual;
- flujo de archivos;
- simulación de fuerzas;
- formato de reportes;
- formateador UITDL;
- validez del ejemplo incluido;
- recorrido interactivo e inclusión;
- traducción a D2;
- compilación D2 con ELK y Dagre.

En el cierre de esta implementación se verificaron 10 archivos de prueba y 25 pruebas. Esta cifra es una observación de la rama actual, no una garantía fija para versiones futuras.

## 16. Comandos de desarrollo

```powershell
npm run dev
npm run lint
npm run test
npm run build
npm run preview
npm run validate:uitd -- archivo.uitd
```

Antes de hacer commit:

1. ejecutar `npm run lint`;
2. ejecutar `npm run test`;
3. ejecutar `npm run build`;
4. revisar que no haya cambios no relacionados.

## 17. Estructura relevante

```text
src/
  components/
    Canvas/                  Editor visual
    UITDLTextPanel/          Editor textual, recorrido y D2
  export/uitdl.ts            Visual -> UITDL
  import/uitdl/              Lexer, parser, validador y constructor
  model/                     Tipos del diagrama
  state/                     Store y slices
  validation/                Reglas semánticas visuales
  test/setup.ts              Preparación de Vitest
  types/                     Declaraciones de paquetes
```

## 18. Sincronización incremental UITDL -> canvas

### 18.1 Un solo sentido de actualización en vivo

La aplicación permite sólo un sentido de actualización en vivo a la vez:

- `canvas -> UITDL`;
- `UITDL -> canvas`.

Nunca están activos simultáneamente. Activar un sentido desactiva el otro para evitar ciclos de actualización, sobrescrituras de texto y comportamiento ambiguo.

### 18.2 Validación antes de modificar el canvas

El texto UITDL se valida antes de tocar el canvas:

- si existen errores, no se actualiza el canvas;
- el canvas conserva el último estado válido aplicado;
- los errores permanecen visibles en el panel de diagnósticos;
- si sólo existen advertencias, la actualización puede continuar;
- una acción declarada y no usada genera una advertencia simple, no un error.

No se usan diálogos bloqueantes durante la edición en vivo. Los estados se muestran como feedback persistente y contextual.

### 18.3 Acciones declaradas

Una acción declarada en `UI ... actions { ... }` no genera cambios visuales por sí sola:

- no crea óvalo en el canvas;
- no modifica el layout;
- queda disponible para validación, autocompletado y diagnósticos;
- sólo se materializa visualmente cuando aparece en una `TRANSITION`;
- si está declarada pero no usada, se mantiene como advertencia.

### 18.4 Modelo incremental

El flujo implementado es:

1. Parsear el UITDL válido a un modelo intermedio.
2. Comparar el modelo nuevo contra el último modelo válido aplicado.
3. Calcular altas, bajas, renombres, reconexiones, cambios de condición y cambios de nesting.
4. Aplicar sólo el diff necesario.
5. Conservar IDs, posiciones, colores, selección e historial cuando la entidad siga siendo equivalente.

No se reconstruye todo el canvas para cada edición válida cuando existen entidades equivalentes. La reconciliación conserva IDs, posiciones y colores siempre que encuentra una clave semántica estable equivalente.

### 18.5 Identidad estable

La reconciliación incremental usa claves semánticas estables:

- UI: `UIID`;
- acción visual: `from UIID + verb + complement`, sólo si aparece en transición;
- condición: `from UIID + verb + complement + condition`;
- transición: `from ref + to ref + verb + complement + condition`;
- containment: relación `parent UIID -> child UIID` derivada de `DRAW`.

Estas claves son una convención de reconciliación interna. No cambian la semántica UITDL.

### 18.6 Secuencia visual para cualquier cambio

Para cualquier cambio UITDL -> canvas, la interfaz intenta mostrar primero el área afectada y después modificarla:

1. Detectar qué cambiará antes de modificar el canvas.
2. Seleccionar todo lo que va a cambiar.
3. Centrar el canvas en esa selección.
4. Ajustar el zoom para que se vea todo lo seleccionado.
5. Esperar a que esa visualización sea efectiva.
6. Aplicar el diff.
7. Seleccionar el resultado final afectado.
8. Centrar o ajustar zoom nuevamente si hace falta.

Esta secuencia aplica a altas, bajas, renombres, reconexiones, cambios de condición, cambios de nesting, cambios de `DRAW` y cambios de fragmentos. Si todos los elementos afectados son nuevos y todavía no existen, la selección y el centrado ocurren inmediatamente después de aplicar el diff.

### 18.7 Simulación y layout

La simulación se limita a lo afectado:

- no mover todo el diagrama para cambios pequeños;
- simular nuevas UIs, acciones, condiciones y transiciones junto con sus vecinos inmediatos;
- para cambios de nesting, reajustar el contenedor y sus ancestros;
- para cambios masivos, usar una ruta especial más conservadora.

La simulación sigue siendo una heurística de layout. No valida la semántica del modelo.

### 18.8 Historial

Cada aplicación válida desde UITDL se agrupa como una entrada de historial:

- usa debounce para evitar una entrada de undo por cada tecla;
- no registra estados inválidos;
- agrupa el diff completo aplicado después de una pausa válida de edición.

### 18.9 Valoración UX

La UX se diseñó con estas condiciones:

- no tocar el canvas cuando hay errores;
- conservar posiciones y estilos de entidades equivalentes;
- mostrar primero dónde ocurrirá el cambio;
- seleccionar y centrar lo afectado;
- ajustar zoom para ver toda la selección;
- aplicar sólo cambios incrementales;
- simular sólo el área afectada.

La experiencia se degrada si los cambios textuales reestructuran masivamente el diagrama, porque la selección previa puede abarcar un área amplia. Aun así, el canvas no cambia mientras el texto tiene errores.

## 19. Limitaciones conocidas

- UITDL no declara un estado inicial; el recorrido usa la primera `UI` y permite cambiarla.
- Los guards se muestran, pero no se evalúan automáticamente.
- El formato D2 es un artefacto derivado de presentación; no existe conversión D2 -> UITDL.
- La edición D2 no sincroniza cambios al diagrama visual.
- El runtime D2 diferido es grande.
- La copia puede ser bloqueada por permisos o falta de foco.
- No se ha establecido que un render correcto implique validez semántica.
- La sincronización incremental UITDL -> canvas conserva identidad por claves semánticas. Cambios que alteran radicalmente esas claves pueden crear entidades nuevas en lugar de reconocer continuidad visual.

## 20. Archivos incorporados para las herramientas textuales

- `UITDLTextPanel.tsx`: estado, validación, archivos, aplicación y temas.
- `uitdlLanguage.ts`: registro de proveedores Monaco UITDL.
- `uitdlLanguageContext.ts`: análisis tolerante para autocompletado y hover durante la edición incompleta.
- `formatUITDL.ts`: formato textual.
- `exampleUITDL.ts`: ejemplo validado.
- `textClipboard.ts`: copia y fallback.
- `InteractivePreview.tsx`: interfaz del recorrido.
- `interactivePreviewModel.ts`: semántica navegable e inclusión.
- `uitdlToD2.ts`: traducción determinista.
- `D2CodePanel.tsx`: edición, renderizado y descargas D2.
- `renderD2.ts`: compilación, motor y saneamiento SVG.
- `UITDLTextPanel.css`: disposición, responsive y temas.

## 21. Historial de incorporación

Los bloques se integraron en commits separados:

- `2ca75bd`: editor textual validado.
- `f37d751`: archivos y formateador.
- `a1c79c8`: ejemplo y acciones de productividad.
- `cc32bf6`: recorrido UITDL interactivo.
- `d6d5927`: generación D2 editable.
- `0d4bc9c`: renderizado ELK/Dagre.
- `67feb80`: temas persistentes.

Este historial ayuda a revisar cambios por capacidad; la documentación describe el estado combinado de la rama.
