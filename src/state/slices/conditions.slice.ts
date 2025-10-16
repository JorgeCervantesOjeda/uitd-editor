import type { AppState, ActionId } from "../types";
import {
    DEFAULT_LABEL_FILL, DEFAULT_LABEL_STROKE, DEFAULT_LABEL_TEXT,
} from "../constants";

export const conditionsSlice = ( set: any, get: () => AppState ) =>
( {
    // Crear condición desde acción (y conversión si hay arista directa)
    handleCreateCondition: ( actionId: ActionId ) => {
        const { edges, actions, conditions, nextId, nextEdgeId, nodes } = get();
        const action = actions.find( a => a.id === actionId );
        if ( !action ) return;

        const originNode = nodes.find( n => n.id === action.originNodeId );
        const inheritFill = originNode?.colorFill ?? DEFAULT_LABEL_FILL;
        const inheritStroke = originNode?.colorStroke ?? DEFAULT_LABEL_STROKE;

        let newEdges = [ ...edges ];
        const newConditions = [ ...conditions ];
        let idCursor = nextId;
        let edgeCursor = nextEdgeId;

        // ¿Existe arista directa action->node?
        const direct = newEdges.find(
            e => e.from.kind === "action" && e.from.id === actionId && e.to.kind === "node"
        );

        if ( direct ) {
            const nodeTargetId = direct.to.id;
            // eliminar arista directa
            newEdges = newEdges.filter( e => e !== direct );

            // condición "empty" para conversión
            const condId = idCursor++;
            newConditions.push( {
                id: condId,
                originActionId: actionId,
                title: "empty",
                x: action.x + 40,
                y: action.y,
                wrap: 22,
                colorFill: inheritFill,
                colorStroke: inheritStroke,
                colorText: DEFAULT_LABEL_TEXT,
            } );

            // action->cond (dashed2) y cond->nodeTarget (dashed1)
            newEdges.push(
                { id: edgeCursor++, from: { kind: "action", id: actionId }, to: { kind: "condition", id: condId }, style: "dashed2" },
                { id: edgeCursor++, from: { kind: "condition", id: condId }, to: { kind: "node", id: nodeTargetId }, style: "dashed1" },
            );
        }

        // Siempre crear nueva condición "empty" para rubber-banding
        const newCondId = idCursor++;
        newConditions.push( {
            id: newCondId,
            originActionId: actionId,
            title: "empty",
            x: action.x + 40,
            y: action.y + 40,
            wrap: 22,
            colorFill: inheritFill,
            colorStroke: inheritStroke,
            colorText: DEFAULT_LABEL_TEXT,
        } );

        newEdges.push( {
            id: edgeCursor++,
            from: { kind: "action", id: actionId },
            to: { kind: "condition", id: newCondId },
            style: "dashed2",
        } );

        set( {
            conditions: newConditions,
            edges: newEdges,
            nextId: idCursor,
            nextEdgeId: edgeCursor,
        } );

        // Rubber-band desde la nueva condición
        get().beginRubberFromCondition( newCondId );
    },
} satisfies Partial<AppState> );
