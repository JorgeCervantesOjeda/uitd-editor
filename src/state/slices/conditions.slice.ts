// src/state/slices/conditions.slice.ts
import { withMeasuredConditionLabel } from "../../layout/measurement";
import type { AppState, ActionId } from "../types";
import {
    DEFAULT_LABEL_FILL,
    DEFAULT_LABEL_STROKE,
    DEFAULT_LABEL_TEXT,
} from "../constants";

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

export const conditionsSlice = ( set: SetState, get: () => AppState ) =>
( {
    // Crear condición desde acción (y conversión si hay arista directa)
    handleCreateCondition: ( actionId: ActionId ) => {
        get().captureDelta( [ "conditions", "edges" ], () => {
            const { edges, actions, conditions, nextId, nextEdgeId } = get();
            const action = actions.find( a => a.id === actionId );
            if ( !action ) return;

            let newEdges = [ ...edges ];
            const newConditions = [ ...conditions ];
            let idCursor = nextId;
            let edgeCursor = nextEdgeId;

            // ¿Existe arista directa action->node?
            const direct = newEdges.find(
                e => e.from.kind === "action" && e.from.id === actionId && e.to.kind === "node"
            );
            let newCondId: number | null = null;

            if ( direct ) {
                const nodeTargetId = direct.to.id;
                // eliminar arista directa
                newEdges = newEdges.filter( e => e !== direct );

                // condición "empty" para conversión
                const condId = idCursor++;
                newConditions.push(
                    withMeasuredConditionLabel( {
                        id: condId,
                        originActionId: actionId,
                        title: "empty",
                        x: action.x + 40 + Math.random() * 100,
                        y: action.y + 40 + Math.random() * 100,
                        wrap: 22,
                        colorFill: DEFAULT_LABEL_FILL,
                        colorStroke: DEFAULT_LABEL_STROKE,
                        colorText: DEFAULT_LABEL_TEXT,
                    } )
                );
                newCondId = condId;

                // action->cond (dashed2) y cond->nodeTarget (dashed1)
                newEdges.push(
                    { id: edgeCursor++, from: { kind: "action", id: actionId }, to: { kind: "condition", id: condId }, style: "dashed2" },
                    { id: edgeCursor++, from: { kind: "condition", id: condId }, to: { kind: "node", id: nodeTargetId }, style: "dashed1" },
                );
            }

            // Si no había arista directa, crear nueva condición "empty" para rubber-banding
            if ( !direct ) {
                newCondId = idCursor++;
                newConditions.push(
                    withMeasuredConditionLabel( {
                        id: newCondId,
                        originActionId: actionId,
                        title: "empty",
                        x: action.x + 40 + Math.random() * 100,
                        y: action.y + 40 + Math.random() * 100,
                        wrap: 22,
                        colorFill: DEFAULT_LABEL_FILL,
                        colorStroke: DEFAULT_LABEL_STROKE,
                        colorText: DEFAULT_LABEL_TEXT,
                    } )
                );

                newEdges.push( {
                    id: edgeCursor++,
                    from: { kind: "action", id: actionId },
                    to: { kind: "condition", id: newCondId },
                    style: "dashed2",
                } );
            }

            set( {
                conditions: newConditions,
                edges: newEdges,
                nextId: idCursor,
                nextEdgeId: edgeCursor,
            } );

            // Rubber-band solo si se creó condición nueva (sin arista directa previa)
            if ( !direct && newCondId != null ) {
                get().beginRubberFromCondition( newCondId );
            }
        } );
    },
} satisfies Partial<AppState> );