# Manual integral de UITD Editor para NotebookLM

## Ficha de esta fuente

- Producto: UITD Editor.
- Propósito: crear, editar, validar, simular, recorrer y exportar modelos UITDL.
- Audiencia: personas usuarias, analistas, diseñadores de interacción, docentes y personal técnico de apoyo.
- Estado documentado: aplicación web de la rama `codex/add-missing-uitd-language-features` al 1 de julio de 2026.
- Alcance: uso funcional de la aplicación, interpretación de sus resultados y resolución de problemas frecuentes.

Esta fuente explica la aplicación. El skill `uitdl-authoring` del notebook debe seguir siendo la fuente principal para gramática, semántica y buenas prácticas de autoría UITDL. Si una duda trata sobre qué botones existen o qué hace UITD Editor, usar este manual. Si trata sobre cómo modelar correctamente un flujo en UITDL, combinar este manual con `uitdl-authoring`.

## 1. Respuesta corta: ¿qué es UITD Editor?

UITD Editor es una aplicación web con dos formas complementarias de trabajar:

1. Un canvas visual para construir interfaces, acciones, condiciones, transiciones, inclusión y fragmentos.
2. Un editor textual Monaco para escribir UITDL, validarlo y aplicarlo explícitamente al canvas.

También genera dos artefactos derivados:

- una previsualización HTML interactiva para recorrer el modelo;
- código D2 editable y un SVG renderizado con ELK o Dagre.

La validación determina si el texto puede aplicarse. Una previsualización navegable o un SVG D2 correctamente renderizado no demuestran por sí solos que el modelo sea semánticamente correcto.

## 2. Conceptos esenciales

### 2.1 UI

Una `UI` representa un estado o interfaz de la aplicación modelada. En el canvas aparece como una caja rectangular. Tiene:

- un UIID numérico visible;
- un título;
- colores de relleno, borde y texto;
- posición y tamaño;
- opcionalmente, una relación de inclusión dentro de otra UI.

### 2.2 Acción

Una acción representa una interacción disponible para la persona usuaria en una UI. En el canvas aparece asociada a su UI de origen. Se define mediante un verbo permitido y un complemento, por ejemplo `clicks "Continuar"`.

### 2.3 Condición o guard

Una condición es una proposición que debe cumplirse para habilitar una transición. Corresponde a `AND "Condición"` en UITDL. No representa lo que ocurre después de la transición.

### 2.4 Transición

Una transición conecta una UI de origen con una UI de destino mediante una acción y, opcionalmente, una condición. Su representación conceptual en el canvas es:

```text
UI de origen -> acción -> condición opcional -> UI de destino
```

### 2.5 Fragmento

Un fragmento es una vista parcial y conectada del modelo. Agrupa UIs y transiciones que forman un subgrafo coherente. No debe contener UIs decorativas o desconectadas.

### 2.6 Inclusión o nesting

La inclusión indica que una UI aparece dentro de otra. La UI contenedora expone sus propias acciones y las de las UIs contenidas. La inclusión se usa para componentes reutilizables, como menús de navegación, o para extensiones reales de una interfaz.

## 3. Inicio rápido

### 3.1 Empezar desde el canvas

1. Hacer clic derecho sobre un área vacía.
2. Seleccionar **New node**.
3. Hacer doble clic sobre la nueva UI para editar UIID, título, ancho de ajuste y colores.
4. Hacer clic derecho sobre la UI y seleccionar **Add action**.
5. Editar la acción.
6. Hacer clic derecho sobre la acción y seleccionar **Go to target**.
7. Seleccionar la UI de destino.
8. Agregar una condición sólo cuando la transición dependa de un guard real.
9. Consultar el panel **Validation** y corregir los problemas.
10. Exportar UITDL o abrir el editor textual.

### 3.2 Empezar desde UITDL

1. Seleccionar **Edit UITDL text**.
2. Escribir el modelo, abrir un archivo o usar **Load example**.
3. Corregir errores del panel de diagnósticos.
4. Usar **Preview HTML** para recorrer el comportamiento.
5. Usar **Generate D2** para obtener una presentación alternativa.
6. Seleccionar **Apply to diagram** para sustituir el modelo visual.
7. Esperar o detener la simulación de layout.
8. Guardar el `.uitd` o exportar desde el canvas.

## 4. Uso completo del canvas visual

### 4.1 Crear elementos

- Clic derecho en el fondo: abre el menú del canvas.
- **New node**: crea una UI centrada en la posición del menú.
- Clic derecho en una UI: permite agregar una acción, editar o eliminar.
- Clic derecho en una acción: permite elegir destino, agregar condición, editar o eliminar.
- Clic derecho en una condición: permite cambiar destino, renombrar o eliminar.
- Doble clic sobre una UI o acción: abre su diálogo de edición.

### 4.2 Crear o cambiar una transición

Para una acción sin condición:

1. Clic derecho sobre la acción.
2. Elegir **Go to target**.
3. Seleccionar la UI de destino.

Para una acción condicionada:

1. Clic derecho sobre la acción.
2. Elegir **Add condition**.
3. Renombrar la condición para expresar el guard.
4. Clic derecho sobre la condición.
5. Elegir **Go to target**.
6. Seleccionar la UI de destino.

**Go to target** sobre una condición existente cambia su destino.

### 4.3 Selección

- Clic: seleccionar un elemento.
- `Shift + clic`: alternar un elemento dentro de la selección.
- Arrastrar sobre espacio vacío: selección rectangular.
- `Shift + arrastre` sobre espacio vacío: agregar a la selección rectangular.
- Las flechas permiten mover el foco entre elementos del diagrama.
- `Shift + flecha` extiende la selección accesible por teclado.

### 4.4 Mover y anidar

- Arrastrar una selección: moverla.
- Mantener `Shift` mientras se arrastra: movimiento fino.
- Arrastrar una UI sobre otra: insertarla como UI contenida.
- Los contenedores se reajustan para alojar a sus hijos.

La inclusión no debe usarse sólo porque dos UIs tengan relación temática. Debe corresponder a reutilización o extensión real.

### 4.5 Zoom y pan del canvas principal

- Rueda del mouse: acercar o alejar hacia el puntero.
- `Ctrl/Cmd + arrastre izquierdo`: desplazar la cámara.
- Arrastre con botón central: desplazar la cámara.
- El cursor cambia a mano abierta al mantener `Ctrl/Cmd` y a mano cerrada durante el pan.
- El zoom se limita para evitar escalas inutilizables.

### 4.6 Copiar, cortar y pegar

- `Ctrl/Cmd + C`: copiar selección.
- `Ctrl/Cmd + X`: cortar selección.
- `Ctrl/Cmd + V`: pegar cerca del centro visible.
- El botón **Copy** sólo se habilita cuando hay selección.
- **Paste** puede usarse desde la barra superior.

### 4.7 Eliminar

- `Delete` o `Backspace`: elimina la selección cuando el foco está en el diagrama.
- Clic derecho sobre un elemento y **Delete**: elimina el elemento seleccionado.
- **Utils > Delete all the diagram**: borra el proyecto visual completo.

Antes de eliminar, verificar si la selección incluye elementos anidados o dependientes.

### 4.8 Deshacer y rehacer

- `Ctrl/Cmd + Z`: deshacer.
- `Ctrl/Cmd + Y`: rehacer.
- `Ctrl/Cmd + Shift + Z`: rehacer.
- También están disponibles en **Edit**.

Aplicar UITDL al diagrama se registra como una operación reversible.

### 4.9 Alinear y distribuir

**Align** requiere al menos dos elementos seleccionados y ofrece:

- izquierda;
- centro horizontal;
- derecha;
- arriba;
- centro vertical;
- abajo.

**Distribute** requiere al menos tres elementos y ofrece distribución horizontal o vertical por centros.

### 4.10 Colores y fondo

En **Utils**:

- **Canvas dark background** cambia el fondo del canvas y el color de aristas sólo en pantalla.
- **Recolor selection by displayId** recolorea la selección por grupos de UIID visible.
- **Recolor ALL** recolorea globalmente por UIID visible.

Las instancias que representan la misma UI deben conservar una identidad cromática coherente.

### 4.11 Simulación de layout

En **Simulation**:

- **Adjust parameters** configura la simulación.
- **Run** ejecuta fuerzas sobre la selección relevante.
- **Stop** detiene la simulación actual.

La simulación es un método heurístico de layout. Ayuda a distribuir elementos; no valida la semántica del modelo.

Parámetros habituales:

- fuerza de resortes;
- distancia de equilibrio;
- repulsión;
- fricción;
- paso temporal;
- desplazamiento máximo;
- iteraciones y pasos por cuadro.

### 4.12 Panel Validation

El panel superior derecho muestra cantidades de errores y advertencias.

- Un error representa un problema que debe resolverse antes de ciertos flujos de exportación o aplicación.
- Una advertencia señala una situación que puede ser válida, pero requiere revisión.
- Seleccionar un diagnóstico centra o localiza la entidad relacionada cuando es posible.
- **Copy list** copia un reporte textual.

## 5. Menús de la barra superior

### 5.1 File

- **New**: iniciar un proyecto visual nuevo.
- **Open**: abrir un proyecto visual serializado.
- **Save**: guardar el proyecto visual con posiciones y metadatos del editor.
- **UITDL**: importar un archivo UITDL al canvas.

El formato de proyecto visual y UITDL no son equivalentes. El primero conserva detalles propios del editor; UITDL expresa el modelo.

### 5.2 Edit

- **Undo**.
- **Redo**.

### 5.3 Export

- SVG de la selección.
- JPG de la selección.
- UITDL del diagrama.

La exportación UITDL se cancela si existen errores. Si sólo hay advertencias, solicita confirmación.

### 5.4 Utils

- fondo oscuro del canvas;
- recolorear selección;
- recolorear todo;
- borrar todo el diagrama.

### 5.5 Simulation

- ajustar parámetros;
- ejecutar;
- detener.

### 5.6 Distribute y Align

Se habilitan únicamente cuando la selección contiene suficientes elementos.

## 6. Atajos de la interfaz visual

| Acción | Atajo |
|---|---|
| Ayuda | `Alt + H` |
| File | `Alt + F` |
| Edit | `Alt + E` |
| Copy | `Alt + C` o `Ctrl/Cmd + C` |
| Paste | `Alt + P` o `Ctrl/Cmd + V` |
| Export | `Alt + X` |
| Utils | `Alt + U` |
| Simulation | `Alt + S` |
| Distribute | `Alt + D` |
| Align | `Alt + A` |
| Validation | `Alt + V` |
| Deshacer | `Ctrl/Cmd + Z` |
| Rehacer | `Ctrl/Cmd + Y` o `Ctrl/Cmd + Shift + Z` |
| Cortar | `Ctrl/Cmd + X` |
| Eliminar selección | `Delete` o `Backspace` |
| Cerrar menús o cancelar conexión | `Escape` |
| Pan | `Ctrl/Cmd + arrastre` o botón central |
| Zoom | Rueda del mouse |

Los atajos globales no se ejecutan mientras se escribe en un campo, editor o selector.

## 7. Editor textual UITDL

### 7.1 Apertura y sincronización

**Edit UITDL text** abre el panel lateral. Al abrir:

1. se exporta el canvas actual a UITDL;
2. se busca un borrador guardado localmente;
3. se informa si el borrador recuperado tiene cambios pendientes.

Editar el texto no cambia automáticamente el canvas. La sincronización ocurre al seleccionar **Apply to diagram**.

### 7.2 Borrador y tema

El texto se guarda en `localStorage` con la clave:

```text
uitd-editor/uitdl-text-draft
```

El tema textual se guarda con:

```text
uitd-editor/text-theme
```

Si el navegador impide la persistencia, el trabajo permanece en memoria durante la sesión y la aplicación registra el fallback.

### 7.3 Herramientas Monaco

El editor ofrece:

- coloreado de sintaxis;
- snippets de UITD, UI, FRAGMENT, TRANSITION, acciones y guards;
- autocompletado contextual de UIIDs en `DRAW`, `from` y `to`;
- sugerencias automáticas al escribir un UIID;
- referencias de transición restringidas al `DRAW` del fragmento actual;
- sugerencias de verbos y complementos declarados en la UI de origen;
- información emergente sobre UIIDs;
- folding de bloques;
- minimapa;
- ajuste de línea;
- formato de documento;
- errores y advertencias por línea;
- navegación desde un diagnóstico a su ubicación.

### 7.4 Botones del panel textual

- **Open .uitd**: abrir `.uitd`, `.uitdl` o texto.
- **Save .uitd**: descargar exactamente el borrador actual.
- **Format**: normalizar indentación y estructura sin corregir semántica.
- **Load example**: cargar un ejemplo validado con navegación reutilizable y condiciones.
- **Copy all**: copiar el texto completo.
- **Preview HTML**: abrir la simulación interactiva si no hay errores.
- **Generate D2**: generar D2 si no hay errores.
- **Reload from diagram**: reemplazar el borrador por una nueva exportación del canvas.
- **Apply to diagram**: importar el borrador validado al modelo visual.

Abrir otro archivo, cargar el ejemplo o recargar desde el diagrama pide confirmación cuando existe trabajo pendiente.

### 7.5 Estados del documento

- **Synchronized**: texto y última versión aplicada coinciden.
- **Pending changes**: el texto cambió y aún no se aplicó.
- Errores o advertencias: se muestra el conteo junto al nombre del archivo.

## 8. Aplicar UITDL al diagrama

**Apply to diagram** se habilita cuando:

- no existen errores;
- el texto difiere de la última versión aplicada;
- no hay otra aplicación en curso.

El proceso:

1. muestra feedback visible;
2. importa UIs, acciones, condiciones, transiciones y fragmentos;
3. reajusta contenedores;
4. inicia la misma simulación de layout usada por la importación UITDL del canvas;
5. muestra progreso;
6. centra el resultado al finalizar;
7. registra el cambio en el historial.

Las advertencias no bloquean la aplicación. La simulación puede detenerse para conservar el estado alcanzado.

## 9. Reglas UITDL que afectan directamente a la aplicación

Esta sección resume sólo las reglas necesarias para entender mensajes y comportamientos. Para autoría completa, consultar `uitdl-authoring`.

### 9.1 Estructura mínima

```uitdl
UITD "Ejemplo" {
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

### 9.2 Verbos admitidos

```text
clicks, submits, selects, types, toggles,
uploads, downloads, saves, deletes, waits
```

### 9.3 Condiciones

Correcto:

```uitdl
TRANSITION from 1 to 2 if user clicks "Continuar" AND "sesión activa";
```

Incorrecto como guard:

```uitdl
TRANSITION from 1 to 2 if user clicks "Continuar" AND "se guarda el registro";
```

El segundo texto describe un efecto posterior, no una condición evaluable.

### 9.4 Inclusión

En `DRAW`, usar corchetes:

```uitdl
DRAW { 7[1] };
```

En una transición que apunta a la instancia contenida, usar paréntesis:

```uitdl
TRANSITION from 7(1) to 2 if user clicks "Salir";
```

### 9.5 WIDTH

`WIDTH` controla el ajuste visual de etiquetas. No modifica el comportamiento.

### 9.6 Conectividad del fragmento

Cada UI dibujada debe participar en una transición o inclusión necesaria para interpretar el fragmento. Una UI aislada dentro de `DRAW` provoca error.

### 9.7 Determinismo de acciones

Para una misma UI y acción:

- no mezclar transiciones condicionadas y sin condición;
- no definir más de un destino para la misma condición;
- no definir más de un destino para la rama sin condición;
- repetir exactamente una transición en fragmentos distintos puede ser válido como presentación.

## 10. Previsualización HTML interactiva

### 10.1 Qué muestra

- la UI actual;
- las UIs insertadas dentro de ella;
- acciones dentro de la UI que las declara;
- acciones heredadas mediante inclusión;
- colores equivalentes a los del canvas;
- la última transición recorrida.

### 10.2 Estado inicial

UITDL no define estado inicial. La previsualización usa la primera UI declarada y señala este supuesto. **Current UI** permite cambiar manualmente de estado.

### 10.3 Acciones y condiciones

- Una acción sin condición ejecuta inmediatamente su transición.
- Una acción condicionada abre un diálogo para elegir la condición.
- El diálogo aparece incluso si sólo existe una condición.
- La aplicación no evalúa condiciones automáticamente porque no conoce el contexto real del sistema modelado.

### 10.4 Qué demuestra y qué no

La previsualización demuestra que el modelo puede recorrerse según sus transiciones. No demuestra que una aplicación real implemente esos estados, acciones o guards.

## 11. D2

### 11.1 Generación

**Generate D2** produce código D2 determinista desde UITDL validado. Conserva:

- título;
- fragmentos;
- UIs;
- inclusión;
- referencias contenidas;
- acciones;
- condiciones;
- `WIDTH`;
- colores de relleno, borde y texto del canvas cuando existe correspondencia por UIID.

Si una UI aún no existe en el canvas, usa la paleta predeterminada del canvas.

### 11.2 Edición y regeneración

El código D2 es un artefacto independiente:

- editarlo no cambia UITDL;
- editarlo no cambia el canvas;
- **Regenerate** descarta las ediciones D2 y vuelve a generar desde UITDL.

### 11.3 Layout y render

- **ELK** y **Dagre** son motores alternativos.
- **Render diagram** compila y genera SVG.
- No hay fallback automático entre motores.
- Un error conserva el último SVG exitoso y muestra el problema.
- La primera renderización puede tardar por la carga del runtime WebAssembly de D2.

### 11.4 Ventana D2

- **Maximize** ocupa toda la ventana y prioriza el área del diagrama.
- **Restore** vuelve al tamaño normal.
- D2 maximizado permanece por encima del panel Validation.
- **Download .d2** descarga el código.
- **Download SVG** se habilita después de un render correcto.

### 11.5 Navegación del diagrama D2

La navegación replica el canvas principal:

- rueda: zoom hacia el punto del cursor;
- `Ctrl/Cmd + arrastre izquierdo`: pan;
- botón central + arrastre: pan;
- cursor de mano abierta/cerrada durante el pan;
- sin controles de zoom visibles.

El cálculo del zoom conserva el punto situado bajo el cursor. En la versión documentada, el rango configurado comienza en 25% y alcanza hasta 1200%.

### 11.6 Seguridad

El SVG generado desde D2 editable se considera contenido no confiable. Se sanea con DOMPurify antes de insertarse en la página.

## 12. Archivos y diferencias importantes

### 12.1 Proyecto visual

Conserva posiciones, cámara y propiedades específicas del editor. Es el formato apropiado para continuar trabajo visual exactamente donde se dejó.

### 12.2 UITDL

Conserva el modelo de interfaces y transiciones. Es el formato apropiado para intercambio, revisión semántica y herramientas compatibles.

### 12.3 D2

Es una presentación derivada y editable. No es una fuente sincronizable de regreso a UITDL.

### 12.4 SVG y JPG

Son salidas visuales. No conservan semántica editable del modelo.

## 13. Validación: errores frente a advertencias

### 13.1 Errores

Bloquean:

- **Apply to diagram**;
- **Preview HTML**;
- **Generate D2**;
- exportaciones UITDL que exigen un modelo válido.

Ejemplos:

- UIID duplicado o desconocido;
- referencia de transición no dibujada correctamente;
- fragmento desconectado;
- transición ambigua;
- sintaxis incompleta;
- nesting mal formado.

### 13.2 Advertencias

No bloquean normalmente, pero requieren revisión. Ejemplos:

- UI sin entrada o salida efectiva;
- acción declarada pero no utilizada;
- estructura posiblemente incompleta.

Una UI contenedora puede tener salida efectiva mediante una UI incluida.

## 14. Solución de problemas

### 14.1 Apply to diagram está deshabilitado

Comprobar:

1. ¿Hay errores?
2. ¿El texto cambió respecto a la versión aplicada?
3. ¿Hay una aplicación en curso?
4. ¿El documento tiene una estructura completa?

### 14.2 Preview HTML o Generate D2 están deshabilitados

Existe al menos un error de validación. Las advertencias por sí solas no deberían bloquearlos.

### 14.3 El autocompletado de UIID no aparece

- Verificar que el cursor esté en `DRAW`, `TRANSITION from` o `TRANSITION to`.
- En transiciones, la referencia debe estar disponible en el `DRAW` del fragmento actual.
- Probar `Ctrl + Espacio` para invocación manual.
- Confirmar que la UI esté definida antes de la referencia.

### 14.4 Una UI queda aislada o cambia el nombre del fragmento

No agregar UIs desconectadas a `DRAW`. Cada fragmento debe ser un subgrafo conectado y significativo. Dividir el modelo en otro fragmento si la UI pertenece a otro flujo.

### 14.5 La previsualización pide condición aunque sólo haya una

Es intencional. Toda acción condicionada exige selección explícita. Sólo las acciones sin condición navegan inmediatamente.

### 14.6 Una acción aparece duplicada o tiene destinos ambiguos

Revisar todas las transiciones de esa acción. No mezclar ramas con y sin condición ni repetir una condición con destinos diferentes.

### 14.7 Aplicar UITDL reorganiza el canvas

Es intencional. Después de importar, se ejecuta una simulación de layout. Puede detenerse para conservar el estado alcanzado.

### 14.8 El render D2 tarda mucho la primera vez

La primera ejecución carga e inicializa el runtime WebAssembly. Las ejecuciones posteriores suelen reutilizarlo.

### 14.9 ELK falla

- Revisar el mensaje visible.
- Validar que el D2 editado siga siendo correcto.
- Probar Dagre manualmente si se desea comparar.
- No se cambia de motor automáticamente.

### 14.10 El zoom D2 no sigue al puntero

La versión documentada calcula el anclaje desde la posición transformada real del SVG. Si el problema reaparece, verificar que el navegador no esté aplicando zoom de página y que se use la rueda sobre el área D2.

### 14.11 Restore queda detrás de Validation

La versión documentada eleva el contexto de capas del panel textual mientras D2 está abierto. `Restore` debe permanecer visible y recibir el clic.

### 14.12 No se puede copiar

El navegador puede bloquear el portapapeles por permisos o falta de foco. La aplicación intenta un método alternativo y muestra un error si ambos fallan.

### 14.13 El borrador reaparece al abrir el editor

Es la recuperación automática de `localStorage`. Usar **Reload from diagram** para descartarlo, aceptando la confirmación.

### 14.14 El fondo oscuro no aparece en la exportación

El fondo oscuro del canvas es una preferencia de pantalla. No necesariamente forma parte del artefacto exportado.

### 14.15 Delete no elimina

El foco debe estar en el diagrama y debe existir una selección. Los atajos se desactivan dentro de campos de texto y diálogos.

## 15. Preguntas frecuentes

### ¿El texto y el canvas se sincronizan automáticamente?

No. Se sincronizan explícitamente con **Apply to diagram** o mediante recarga desde el canvas.

### ¿Puedo guardar texto inválido?

Sí. **Save .uitd** descarga el borrador actual para no perder trabajo, aunque no pueda aplicarse.

### ¿Las advertencias impiden trabajar?

No normalmente. Deben revisarse, pero no equivalen a errores.

### ¿D2 puede modificar UITDL?

No.

### ¿El HTML interactivo ejecuta la aplicación real?

No. Recorre el modelo.

### ¿El editor sabe qué condiciones son verdaderas?

No. La persona selecciona el guard en la previsualización.

### ¿Una UI incluida hereda acciones del contenedor?

No. La dirección es la contraria para el estado compuesto: el contenedor expone sus acciones y las de sus UIs contenidas.

### ¿Puedo repetir una transición en varios fragmentos?

Sí, cuando es exactamente la misma transición y los fragmentos presentan vistas distintas. No debe crear ambigüedad.

### ¿Por qué una UI necesita UIID?

El UIID identifica la UI entre declaraciones, dibujos, transiciones, instancias repetidas y correspondencia cromática.

### ¿Qué motor D2 debo usar?

ELK suele ser útil para jerarquía y diagramas complejos. Dagre ofrece otra distribución dirigida. La elección es visual; no cambia la semántica UITDL.

### ¿La simulación valida el modelo?

No. Sólo ajusta posiciones.

## 16. Cómo responder preguntas con esta fuente

NotebookLM debe distinguir:

- **Comportamiento confirmado:** descrito directamente en este manual.
- **Supuesto de la herramienta:** por ejemplo, usar la primera UI como estado inicial.
- **Heurística:** por ejemplo, simulación de fuerzas y elección de layout.
- **Demostración limitada:** por ejemplo, un recorrido HTML navegable o un SVG D2 renderizado.
- **No establecido:** comportamiento de una aplicación real que UITDL sólo modela.

No afirmar que:

- un render D2 demuestra validez semántica;
- una condición fue evaluada por la aplicación;
- una simulación reproduce física real;
- una previsualización demuestra que el producto final está implementado;
- D2 y UITDL sean bidireccionales.

## 17. Glosario

- **Canvas:** espacio visual editable.
- **UIID:** identificador numérico visible de una UI.
- **UI:** interfaz o estado del sistema modelado.
- **Acción:** interacción disponible en una UI.
- **Guard o condición:** proposición que habilita una transición.
- **Transición:** cambio dirigido entre UIs mediante una acción.
- **Fragmento:** vista parcial conectada del modelo.
- **Inclusión o nesting:** una UI contenida dentro de otra.
- **Instancia contenida:** referencia a una UI específica dentro de un contenedor.
- **Borrador:** texto UITDL aún no aplicado.
- **D2:** lenguaje de diagramación usado como presentación derivada.
- **ELK/Dagre:** motores de layout para D2.
- **Pan:** desplazamiento de la cámara.
- **Zoom anclado:** cambio de escala que conserva el punto bajo el cursor.
- **Fallback:** alternativa usada cuando falla el método principal.

## 18. Límites conocidos

- UITDL no declara un estado inicial.
- Los guards no se evalúan automáticamente.
- D2 no se convierte de regreso a UITDL.
- La edición D2 no actualiza el canvas.
- La primera renderización D2 puede ser pesada.
- El portapapeles depende de permisos del navegador.
- El fondo oscuro del canvas y el tema textual son preferencias distintas.
- Un modelo puede tener advertencias aun siendo aplicable.
- No se debe interpretar la presentación visual como demostración de implementación real.

## 19. Fuentes adicionales recomendadas para NotebookLM

Además de este manual y el skill `uitdl-authoring`, se recomienda subir:

1. **El artículo o especificación fuente de UITDL.** Aporta fundamento académico, alcance original y definiciones que no deben inferirse sólo desde la herramienta.
2. **Un catálogo de ejemplos UITDL validados.** Incluir casos simples, inclusión, navegación reutilizable, acciones condicionadas, acciones sin condición y errores comunes corregidos.
3. **Un catálogo de diagnósticos.** Para cada código o mensaje: causa, ejemplo mínimo, reparación y severidad.
4. **Notas de versión.** Evitan que NotebookLM responda con funciones antiguas cuando cambien botones, límites o reglas.
5. **Política de modelado de la organización.** Nombres preferidos, granularidad de UIs, convenciones de guards y criterios para dividir fragmentos.
6. **Guía de despliegue y operación, sólo si los usuarios administrarán la aplicación.** Debe cubrir hosting, configuración, seguridad y recuperación; no mezclarla con el manual funcional.

No es necesario subir todo el código fuente para resolver dudas de usuarios. Puede aumentar ruido y hacer que NotebookLM responda con detalles internos en lugar de instrucciones prácticas. Para soporte técnico de desarrolladores, conviene crear un notebook separado con arquitectura, código, pruebas y decisiones técnicas.

