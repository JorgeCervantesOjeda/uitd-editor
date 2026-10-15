# RigidBlock: bloques rígidos visuales para la simulación del lienzo

## Estado y alcance

Esta especificación describe el diseño aprobado para introducir bloques rígidos (`RigidBlock`) en UITD Editor. En esta etapa no implementa código de producto.

El objetivo es permitir que una selección de elementos del lienzo se marque como un bloque rígido que, durante la simulación, se comporte como un solo cuerpo trasladable: sus miembros conservan las posiciones relativas, las aristas internas no deforman el bloque y el bloque se representa con un rectángulo de esquinas redondeadas.

El bloque es metadato visual del lienzo. No cambia la semántica UITDL, no agrega acciones o transiciones y no debe modificar la salida UITDL ni el D2 derivado.

## Requisitos aceptados

1. La selección puede contener nodos, acciones y condiciones.
2. Si la selección contiene un nodo de una jerarquía, el bloque incluye toda esa jerarquía.
3. Todos los miembros del bloque deben pertenecer al mismo fragmento.
4. La creación se rechaza si la selección expandida cruza más de un fragmento.
5. Dos bloques no pueden compartir miembros. La superposición se define como intersección de membresía, no como intersección accidental de sus rectángulos visuales.
6. El bloque se dibuja mediante un rectángulo de esquinas redondeadas con radio medio.
7. El rectángulo representa el área física del bloque y su centro representa el centro físico del cuerpo.
8. Durante la simulación, el bloque puede trasladarse, pero no rotar ni deformarse.
9. El marcado se ofrece en el menú contextual y también en el menú desplegable de simulación.
10. Los bloques persisten en el proyecto y en el almacenamiento persistido del editor.
11. Los bloques sólo son visuales del lienzo y no forman parte del modelo UITDL exportado.

## Observaciones del código existente

- `src/state/types.ts` separa la selección de nodos, acciones y condiciones.
- `src/state/slices/selection.slice.ts` ya calcula descendientes de nodos y la selección efectiva para simulación.
- `src/fragments/fragmentModel.ts` construye grupos de fragmentos a partir de nodos, acciones, condiciones, aristas y jerarquías.
- `src/physics/adapter.ts` convierte el estado del editor en entradas del simulador y hoy asigna `rootId` a nodos, mientras acciones y condiciones se modelan como partículas independientes.
- `src/physics/force-simulator.ts` ya integra desplazamientos compartidos por raíz y fuerzas individuales por partícula.
- `src/physics/runForces.ts` construye simulaciones independientes por fragmento, filtra elementos movibles y registra un cambio agrupado en el historial.
- `src/components/Canvas/renderMenus.tsx` contiene los menús contextuales de nodos, acciones y condiciones.
- `src/components/Canvas/TopToolbar/menus/SimMenu.tsx` contiene las acciones de simulación.
- `src/components/Canvas/nodes.tsx` y `src/components/Canvas/edges.tsx` renderizan los elementos y sus aristas a partir de posiciones absolutas.
- `src/io/serialization.ts` y `src/state/store.ts` definen los formatos y la persistencia del proyecto.

Estas observaciones se consideran evidencia de arquitectura existente, no evidencia de que la funcionalidad nueva ya exista.

## Modelo de datos

Se añadirá al modelo de editor:

```ts
type RigidBlockMember =
    | { kind: "node"; id: NodeId }
    | { kind: "action"; id: ActionId }
    | { kind: "condition"; id: ConditionId };

type RigidBlock = {
    id: RigidBlockId;
    members: RigidBlockMember[];
};
```

`RigidBlock` vivirá en el modelo del proyecto y `AppState` expondrá `rigidBlocks` junto con la operación de creación y eliminación necesaria para los menús.

El fragmento no se almacenará como dato duplicado. Se derivará con `buildFragmentGroups` al validar o usar el bloque, porque la conectividad puede cambiar cuando el usuario edita aristas o jerarquías.

La persistencia local y el formato de proyecto incorporarán `rigidBlocks`. La versión de persistencia y la versión de proyecto deberán migrar los datos antiguos que no contengan esta propiedad a una lista vacía. La migración debe registrar cualquier fallback con causa, fallback e impacto.

## Creación y validación

La operación `createRigidBlockFromSelection` seguirá este orden:

1. Leer las tres selecciones actuales.
2. Expandir cada nodo seleccionado a toda su jerarquía descendiente.
3. Eliminar referencias duplicadas y descartar referencias inexistentes.
4. Resolver el fragmento de cada miembro.
5. Rechazar la operación si algún miembro no puede resolverse o si existen dos fragmentos distintos.
6. Rechazar la operación si algún miembro ya pertenece a otro `RigidBlock`.
7. Crear el bloque con un identificador nuevo y la membresía normalizada.
8. Mostrar inmediatamente el rectángulo del bloque y un estado accesible de éxito.

La operación no debe crear bloques parcialmente válidos ni aplicar un fallback silencioso. Un rechazo debe indicar si la causa fue fragmento múltiple, membresía ya utilizada o referencia inválida.

La eliminación de un bloque sólo elimina el metadato y conserva los elementos del lienzo.

## Geometría y comportamiento físico

Para un `RigidBlock`, se calculará un rectángulo a partir de la geometría medida de todos sus miembros y un margen constante. El centro será:

```text
center.x = (bounds.left + bounds.right) / 2
center.y = (bounds.top + bounds.bottom) / 2
```

Cada miembro conservará un desplazamiento local respecto a ese centro. El cuerpo rígido tendrá el ancho y alto del rectángulo marcado.

La integración recomendada es generalizar el concepto actual de raíz de movimiento a un identificador de cuerpo compartido:

- los miembros de un bloque apuntan al mismo cuerpo rígido;
- el cuerpo tiene una sola posición y velocidad de traslación;
- las posiciones de los miembros se reconstruyen como `center + localOffset`;
- no existe velocidad angular ni transformación de rotación;
- las fuerzas externas se acumulan en el cuerpo;
- las aristas internas no se utilizan para deformar la posición local;
- la representación visual de las aristas continúa usando las posiciones reales de sus extremos.

La simulación seguirá estando limitada al fragmento único del bloque. No se crearán simulaciones que unan dos fragmentos por medio de un `RigidBlock`.

La geometría física y la visual deben utilizar el mismo cálculo de límites, tamaño y centro para evitar que el rectángulo observado y el cuerpo simulado diverjan.

## Interacción y representación visual

El menú contextual de nodos, acciones y condiciones ofrecerá:

- `Create rigid block` cuando la selección sea válida;
- `Remove rigid block` cuando la selección corresponda a un bloque existente;
- una explicación visible cuando la selección cruce fragmentos o comparta membresía con otro bloque.

El menú de simulación repetirá estas acciones para que el usuario pueda trabajar desde el flujo de simulación.

El rectángulo del bloque se renderizará en una capa SVG propia, con:

- esquinas redondeadas de radio medio;
- borde diferenciado y relleno translúcido;
- `pointerEvents="none"` para no bloquear selección ni arrastre;
- identificador accesible del bloque;
- estilos compatibles con modo claro y oscuro;
- actualización inmediata al crear, eliminar o mover el bloque.

La presentación debe resolverse preferentemente con CSS y clases visuales; la lógica JavaScript se limitará al estado y a la geometría necesaria para dibujar el rectángulo.

## Borrado, pegado y cambios estructurales

### Borrado parcial

Cuando se eliminen algunos miembros:

- el bloque conserva sus miembros sobrevivientes;
- se recalculan sus límites;
- si no quedan miembros, el bloque se elimina;
- se conserva una entrada de historial coherente con la operación.

### Copia y pegado

Cuando se copie y pegue un bloque completo:

- se copian los miembros;
- se remapean sus identificadores;
- se crea un nuevo `RigidBlock` sin compartir membresía con el original;
- se conserva la geometría relativa.

Cuando se pegue sólo una parte de un bloque:

- los elementos pegados quedan sin bloque;
- no se agregan silenciosamente al bloque original;
- la UI muestra un aviso persistente hasta que cambie la condición o el usuario lo descarte.

Estas reglas evitan acoplamientos inesperados y respetan la prohibición de superposición de membresía.

### Importación y edición UITDL

La importación o aplicación de UITDL no transporta `RigidBlock`, porque el bloque es metadato visual del lienzo. Los bloques cuyos miembros ya no existan deben eliminarse o reportarse explícitamente; nunca deben conservar referencias inválidas en silencio.

## Historial y persistencia

Crear, eliminar, modificar membresía, copiar o pegar bloques será reversible junto con la modificación visual relacionada.

Los cambios de posición producidos por la simulación se registrarán como una sola operación de historial, igual que el flujo actual de fuerzas. El metadato del bloque sólo cambiará cuando cambie la membresía o cuando una operación estructural lo requiera.

## Pruebas y evidencia

La implementación deberá vincular tres niveles de prueba:

1. **Unidad:** expansión de jerarquías, deduplicación, cálculo de límites, centro, validación de fragmento y detección de superposición.
2. **Integración:** adaptación de `RigidBlock` al simulador, offsets invariantes, fuerzas externas, aristas internas y persistencia/migración.
3. **Sistema/UI:** creación y eliminación desde ambos menús, rechazo visible de selecciones inválidas, rectángulo visible y copia/pegado parcial.

Los casos deberán cubrir entradas normales, selección parcial de jerarquía, selección de varios fragmentos, membresía ya utilizada, borrado completo, borrado parcial, copia completa y pegado parcial.

El estado base observado antes de la implementación fue: 54 archivos de prueba, 269 pruebas aprobadas, compilación correcta y lint correcto. Esa evidencia no demuestra el comportamiento nuevo; sólo establece una línea base para regresión.

## Riesgos residuales y límites

- El rectángulo físico puede solapar visualmente elementos externos; eso no se considera superposición de membresía y debe resolverse mediante las fuerzas existentes.
- Las aristas externas conservan sus anclajes visuales en los miembros, aunque las fuerzas se agregan al cuerpo rígido.
- El bloque no rota. Añadir rotación sería una ampliación independiente del alcance.
- La importación UITDL no restaura bloques; sólo los proyectos que soporten el metadato del editor podrán conservarlos.

## Criterios de aceptación

1. Una selección válida crea un `RigidBlock` desde el menú contextual y desde el menú de simulación.
2. Una selección expandida que cruce fragmentos no crea ningún bloque y muestra una causa visible.
3. Una selección con membresía ya utilizada no crea ningún bloque y muestra una causa visible.
4. El rectángulo aparece inmediatamente y sigue el bloque durante la simulación.
5. Después de cualquier número de pasos de simulación, las distancias y offsets locales entre miembros permanecen constantes dentro de la tolerancia numérica definida por las pruebas.
6. El rectángulo físico y el visual comparten centro, ancho y alto.
7. El borrado parcial conserva un bloque válido con sus miembros sobrevivientes.
8. El pegado parcial no asigna silenciosamente los elementos a un bloque.
9. Guardar y recargar el proyecto conserva los bloques.
10. UITDL y D2 no reciben sintaxis ni nodos adicionales por causa de `RigidBlock`.
11. La regresión existente permanece aprobada.
