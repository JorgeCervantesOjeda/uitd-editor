// src/state/slices/rubberband.slice.ts
import type { StateCreator } from "zustand";
import type {
    AppState,
    Point,
    ActionId,
    ConditionId,
    NodeId,
} from "../types";

// Define exactamente las propiedades que aporta este slice
type RubberbandSlice = Pick<
    AppState,
    | "beginGoToTarget"
    | "beginRubberFromCondition"
    | "retargetCondition"
    | "updatePendingMouse"
    | "commitTargetToNode"
    | "cancelPending"
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const rubberbandSlice: StateCreator<AppState, [], [], RubberbandSlice> = ( set, get, _api ) => ( {
    beginGoToTarget: ( actionId: ActionId ) => {
        get().captureDelta( [ "edges" ], () => {
            const s = get();
            const act = s.actions.find( ( a ) => a.id === actionId );
            if ( !act ) return;

            // Iniciar rubber band desde la acción (no tocar aristas todavía)
            set( {
                pendingConnect: {
                    mode: "action-to-target",
                    fromActionId: actionId,
                    mouse: { x: act.x, y: act.y },
                },
            } );
        } );
    },

    beginRubberFromCondition: ( conditionId: ConditionId ) => {
        const cond = get().conditions.find( ( c ) => c.id === conditionId );
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
            const cond = s.conditions.find( ( c ) => c.id === conditionId );
            if ( !cond ) return;

            const prunedEdges = s.edges.filter(
                ( e ) => !( e.from.kind === "condition" && e.from.id === conditionId )
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
        get().captureDelta( [ "edges", "conditions" ], () => {
            const s = get();
            const p = s.pendingConnect;
            if ( !p ) return;

            let newEdge:
                | {
                    id: number;
                    from:
                    | { kind: "action"; id: ActionId }
                    | { kind: "condition"; id: ConditionId };
                    to: { kind: "node"; id: NodeId };
                    style: "dashed1";
                }
                | null = null;

            if ( p.mode === "action-to-target" ) {
                // Si ya existían condiciones desde esta acción, eliminarlas al completar el goto
                const condIds = s.conditions
                    .filter( c => c.originActionId === p.fromActionId )
                    .map( c => c.id );
                let nextConditions = s.conditions;
                let nextEdges = s.edges;
                if ( condIds.length > 0 ) {
                    const condIdSet = new Set( condIds );
                    nextConditions = s.conditions.filter( c => !condIdSet.has( c.id ) );
                    nextEdges = s.edges.filter(
                        ( e ) => !(
                            ( e.from.kind === "condition" && condIdSet.has( e.from.id ) ) ||
                            ( e.to.kind === "condition" && condIdSet.has( e.to.id ) )
                        )
                    );
                }
                // Remover TODAS las aristas salientes de la acción (incluye action->condition)
                nextEdges = nextEdges.filter(
                    ( e ) => !( e.from.kind === "action" && e.from.id === p.fromActionId )
                );

                newEdge = {
                    id: s.nextEdgeId,
                    from: { kind: "action", id: p.fromActionId },
                    to: { kind: "node", id: nodeId },
                    style: "dashed1",
                };

                set( {
                    edges: [ ...nextEdges, newEdge ],
                    conditions: nextConditions,
                    nextEdgeId: s.nextEdgeId + 1,
                    pendingConnect: null,
                } );
                return;
            } else if ( p.mode === "condition-to-target" ) {
                newEdge = {
                    id: s.nextEdgeId,
                    from: { kind: "condition", id: p.fromConditionId },
                    to: { kind: "node", id: nodeId },
                    style: "dashed1",
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
} );
