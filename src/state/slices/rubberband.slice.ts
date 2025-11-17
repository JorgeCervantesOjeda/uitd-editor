// src/state/slices/rubberband.slice.ts
import type { AppState, EdgeEndpoint, Point, ActionId, ConditionId, NodeId } from "../types";

export const rubberbandSlice = ( set: any, get: () => AppState ) => ( {
    beginGoToTarget: ( actionId: ActionId ) => {
        get().captureDelta( [ "edges" ], () => {
            const s = get();
            const act = s.actions.find( a => a.id === actionId );
            if ( !act ) return;

            // 1) Eliminar TODAS las aristas salientes de esa acción
            const prunedEdges = s.edges.filter(
                e => !( e.from.kind === "action" && e.from.id === actionId )
            );

            // 2) Iniciar rubber band desde la acción
            set( {
                edges: prunedEdges,
                pendingConnect: {
                    mode: "action-to-target",
                    fromActionId: actionId,
                    mouse: { x: act.x, y: act.y },
                },
            } );
        } );
    },

    beginRubberFromCondition: ( conditionId: ConditionId ) => {
        const cond = get().conditions.find( c => c.id === conditionId );
        if ( !cond ) return;

        set( {
            pendingConnect: {
                mode: "condition-to-target",
                fromConditionId: conditionId,
                mouse: { x: cond.x, y: cond.y },
            },
        } );
    },

    retargetCondition: ( conditionId: ConditionId ) => {
        get().captureDelta( [ "edges" ], () => {
            const s = get();
            const cond = s.conditions.find( c => c.id === conditionId );
            if ( !cond ) return;

            const prunedEdges = s.edges.filter(
                e => !( e.from.kind === "condition" && e.from.id === conditionId )
            );

            set( {
                edges: prunedEdges,
                pendingConnect: {
                    mode: "condition-to-target",
                    fromConditionId: conditionId,
                    mouse: { x: cond.x, y: cond.y },
                },
            } );
        } );
    },

    updatePendingMouse: ( world: Point ) => {
        const p = get().pendingConnect;
        if ( !p ) return;
        set( { pendingConnect: { ...p, mouse: { x: world.x, y: world.y } } } );
    },

    commitTargetToNode: ( nodeId: NodeId ) => {
        get().captureDelta( [ "edges" ], () => {
            const s = get();
            const p = s.pendingConnect;
            if ( !p ) return;

            let newEdge = null;

            if ( p.mode === "action-to-target" ) {
                // ya podaste salientes en beginGoToTarget, así que no habrá duplicados
                newEdge = {
                    id: s.nextEdgeId,
                    from: { kind: "action", id: p.fromActionId },
                    to: { kind: "node", id: nodeId },
                    style: "dashed1" as const,
                };
            } else if ( p.mode === "condition-to-target" ) {
                newEdge = {
                    id: s.nextEdgeId,
                    from: { kind: "condition", id: p.fromConditionId },
                    to: { kind: "node", id: nodeId },
                    style: "dashed1" as const,
                };
            }

            if ( newEdge ) {
                set( {
                    edges: [ ...s.edges, newEdge ],
                    nextEdgeId: s.nextEdgeId + 1,
                    pendingConnect: null,
                } );
            } else {
                set( { pendingConnect: null } );
            }
        } );
    },

    cancelPending: () => set( { pendingConnect: null } ),
} ) satisfies Partial<AppState>;
