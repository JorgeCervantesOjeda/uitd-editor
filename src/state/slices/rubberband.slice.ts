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

            // 1) Eliminar TODAS las aristas salientes de esa acción
            const prunedEdges = s.edges.filter(
                ( e ) => !( e.from.kind === "action" && e.from.id === actionId )
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
        get().captureDelta( [ "edges" ], () => {
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
                newEdge = {
                    id: s.nextEdgeId,
                    from: { kind: "action", id: p.fromActionId },
                    to: { kind: "node", id: nodeId },
                    style: "dashed1",
                };
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
