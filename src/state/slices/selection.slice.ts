import type { AppState, ActionId, ConditionId, NodeId } from "../types";

export const selectionSlice = ( set: any, get: () => AppState ) =>
( {
    clearSelection: () =>
        set( {
            selection: new Set<NodeId>(),
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>(),
        } ),

    // Nodos
    selectSingleOrKeep: ( id: NodeId, keep: boolean ) => {
        const sel = new Set( get().selection );
        if ( keep && sel.has( id ) ) { set( { selection: sel } ); return; }
        sel.clear(); sel.add( id );
        set( {
            selection: sel,
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>(),
        } );
    },

    toggleSelect: ( id: NodeId ) => {
        const sel = new Set( get().selection );
        sel.has( id ) ? sel.delete( id ) : sel.add( id );
        set( { selection: sel } );
    },

    // Actions
    selectSingleOrKeepAction: ( id: ActionId, keep: boolean ) => {
        const sel = new Set( get().selectionActions );
        if ( keep && sel.has( id ) ) { set( { selectionActions: sel } ); return; }
        sel.clear(); sel.add( id );
        set( {
            selectionActions: sel,
            selection: new Set<NodeId>(),
            selectionConds: new Set<ConditionId>(),
        } );
    },

    toggleSelectAction: ( id: ActionId ) => {
        const sel = new Set( get().selectionActions );
        sel.has( id ) ? sel.delete( id ) : sel.add( id );
        set( { selectionActions: sel } );
    },

    // Conditions
    selectSingleOrKeepCondition: ( id: ConditionId, keep: boolean ) => {
        const sel = new Set( get().selectionConds );
        if ( keep && sel.has( id ) ) { set( { selectionConds: sel } ); return; }
        sel.clear(); sel.add( id );
        set( {
            selectionConds: sel,
            selection: new Set<NodeId>(),
            selectionActions: new Set<ActionId>(),
        } );
    },

    toggleSelectCondition: ( id: ConditionId ) => {
        const sel = new Set( get().selectionConds );
        sel.has( id ) ? sel.delete( id ) : sel.add( id );
        set( { selectionConds: sel } );
    },
} satisfies Partial<AppState> );
