// imports
import { measureNodeSizeWithId, measureActionOval, measureConditionOval } from "../../layout/measurement";
import type { ActionId, AppState, ConditionId, NodeId } from "../types";


export const editSlice = ( set: any, get: () => AppState ) => ( {
    // === NODO (rectángulo) ===
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ): void => {
        const s = get();
        set( {
            nodes: s.nodes.map( n =>
                n.id === id
                    ? {
                        ...n,
                        title: patch.title ?? n.title,
                        displayId: patch.displayId ?? n.displayId,
                    }
                    : n
            ),
        } );
        // si cambió el título, re-medir/relayout ancestros
        if ( patch.title !== undefined ) {
            get().relayoutContainer( id );
            get().relayoutAncestors( id );
        }
    },
    
    // (opcional) deja renameNode redirigiendo a editNodeMeta:
    renameNode: ( id: number, title: string ) => {
        const s = get();
        const n = s.nodes.find( x => x.id === id );
        if ( !n ) return;
        get().editNodeMeta( id, { displayId: n.displayId ?? String( n.id ), title } );
    },

    // === ACTION (óvalo) ===
    renameAction: ( id: number, title: string ) => {
        const t = ( title ?? "" ).trim(); if ( !t ) return;
        const s = get(); const a = s.actions.find( x => x.id === id ); if ( !a ) return;

        const m = measureActionOval( t, a.wrap ?? 22 );
        set( {
            actions: s.actions.map( x => x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x ),
        } );
    },

    // === CONDITION (óvalo) ===
    renameCondition: ( id: number, title: string ) => {
        const t = ( title ?? "" ).trim(); if ( !t ) return;
        const s = get(); const c = s.conditions.find( x => x.id === id ); if ( !c ) return;

        const m = measureConditionOval( t, c.wrap ?? 22 );
        set( {
            conditions: s.conditions.map( x => x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x ),
        } );
    },

    deleteSelected: () => {
        const selNodes = get().selection;
        const selActions = get().selectionActions;
        const selConds = get().selectionConds;

        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) return;

        set( ( s: AppState ) => {
            const remainingNodes = s.nodes.filter( n => !selNodes.has( n.id ) );
            const remainingNodeIds = new Set( remainingNodes.map( n => n.id ) );

            const remainingActions = s.actions.filter(
                a => !selActions.has( a.id ) && remainingNodeIds.has( a.originNodeId )
            );
            const remainingActionIds = new Set( remainingActions.map( a => a.id ) );

            const remainingConds = s.conditions.filter(
                c => !selConds.has( c.id ) && remainingActionIds.has( c.originActionId )
            );
            const remainingCondIds = new Set( remainingConds.map( c => c.id ) );

            const remainingEdges = s.edges.filter( e => {
                const okFrom =
                    e.from.kind === "node"
                        ? remainingNodeIds.has( e.from.id )
                        : e.from.kind === "action"
                            ? remainingActionIds.has( e.from.id )
                            : remainingCondIds.has( e.from.id );

                const okTo =
                    e.to.kind === "node"
                        ? remainingNodeIds.has( e.to.id )
                        : e.to.kind === "action"
                            ? remainingActionIds.has( e.to.id )
                            : remainingCondIds.has( e.to.id );

                return okFrom && okTo;
            } );

            return {
                nodes: remainingNodes,
                actions: remainingActions,
                conditions: remainingConds,
                edges: remainingEdges,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            };
        } );
    },
} satisfies Partial<AppState> );
