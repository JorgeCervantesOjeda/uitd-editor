import type { AppState, EdgeEndpoint, Point, ActionId, ConditionId, NodeId } from "../types";

export const rubberbandSlice = ( set: any, get: () => AppState ) =>
( {
    beginGoToTarget: ( actionId: ActionId ) => {
        // Solo si no hay aristas salientes desde la acción
        const hasOutgoing = get().edges.some( e => e.from.kind === "action" && e.from.id === actionId );
        if ( hasOutgoing ) return;

        const act = get().actions.find( a => a.id === actionId );
        if ( !act ) return;

        set( {
            pendingConnect: {
                mode: "action-to-target",
                fromActionId: actionId,
                mouse: { x: act.x, y: act.y },
            },
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
    
    retargetCondition: ( conditionId ) => {
        const s = get();
        const cond = s.conditions.find( c => c.id === conditionId );
        if ( !cond ) return;

        // eliminar TODAS las aristas salientes de esa condición
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
    },

    updatePendingMouse: ( world: Point ) => {
        const p = get().pendingConnect;
        if ( !p ) return;
        set( { pendingConnect: { ...p, mouse: { x: world.x, y: world.y } } } );
    },

    commitTargetToNode: ( nodeId: NodeId ) => {
        const p = get().pendingConnect;
        if ( !p ) return;

        let from: EdgeEndpoint;
        if ( p.mode === "action-to-target" ) from = { kind: "action", id: p.fromActionId };
        else from = { kind: "condition", id: p.fromConditionId };

        const edgeId = get().nextEdgeId;
        const edge = { id: edgeId, from, to: { kind: "node", id: nodeId }, style: "dashed1" as const };

        set( ( s: AppState ) => ( {
            edges: [ ...s.edges, edge ],
            nextEdgeId: edgeId + 1,
            pendingConnect: null,
        } ) );
    },

    cancelPending: () => set( { pendingConnect: null } ),
} satisfies Partial<AppState> );
