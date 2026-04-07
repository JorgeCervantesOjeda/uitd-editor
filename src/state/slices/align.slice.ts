// src/state/slices/align.slice.ts
import type { StateCreator } from "zustand";
import type {
    AppState, NodeBox, ActionLabel, ConditionLabel, NodeId,
} from "../types";
import {
    getNodeSizeCached,
    getActionSizeCached,
    getConditionSizeCached,
} from "../../layout/measurement";

type ItemRef =
    | { kind: "node"; ent: NodeBox }
    | { kind: "action"; ent: ActionLabel }
    | { kind: "condition"; ent: ConditionLabel };

function sizeOf( it: ItemRef ): { w: number; h: number } {
    if ( it.kind === "node" ) {
        const m = getNodeSizeCached( it.ent );
        return { w: m.w, h: m.h };
    }
    if ( it.kind === "action" ) {
        const m = getActionSizeCached( it.ent );
        return { w: m.w, h: m.h };
    }
    const m = getConditionSizeCached( it.ent );
    return { w: m.w, h: m.h };
}

function leftOf( it: ItemRef ): number {
    const s = sizeOf( it );
    return it.ent.x - s.w / 2;
}
function rightOf( it: ItemRef ): number {
    const s = sizeOf( it );
    return it.ent.x + s.w / 2;
}
function topOf( it: ItemRef ): number {
    const s = sizeOf( it );
    return it.ent.y - s.h / 2;
}
function bottomOf( it: ItemRef ): number {
    const s = sizeOf( it );
    return it.ent.y + s.h / 2;
}

function collectSelected( state: AppState ): {
    items: ItemRef[];
    nodeIdsForRelayout: Set<NodeId>;
} {
    const items: ItemRef[] = [];
    const relayoutNodes = new Set<NodeId>();

    for ( const n of state.nodes ) {
        if ( state.selection?.has( n.id ) ) {
            items.push( { kind: "node", ent: { ...n } } );
            relayoutNodes.add( n.id );
        }
    }
    for ( const a of state.actions ) {
        if ( state.selectionActions?.has( a.id ) ) {
            items.push( { kind: "action", ent: { ...a } } );
            relayoutNodes.add( a.originNodeId );
        }
    }
    if ( state.selectionConds?.size ) {
        const actionsById = new Map( state.actions.map( ( a ) => [ a.id, a ] ) );
        for ( const c of state.conditions ) {
            if ( state.selectionConds.has( c.id ) ) {
                items.push( { kind: "condition", ent: { ...c } } );
                const act = actionsById.get( c.originActionId );
                if ( act ) relayoutNodes.add( act.originNodeId );
            }
        }
    }
    return { items, nodeIdsForRelayout: relayoutNodes };
}

function commitBack( state: AppState, items: ItemRef[] ) {
    const nMap = new Map<number, NodeBox>();
    const aMap = new Map<number, ActionLabel>();
    const cMap = new Map<number, ConditionLabel>();

    for ( const it of items ) {
        if ( it.kind === "node" ) nMap.set( it.ent.id, it.ent );
        else if ( it.kind === "action" ) aMap.set( it.ent.id, it.ent );
        else cMap.set( it.ent.id, it.ent );
    }

    const nodes = state.nodes.map( ( n ) => nMap.get( n.id ) ?? n );
    const actions = state.actions.map( ( a ) => aMap.get( a.id ) ?? a );
    const conditions = state.conditions.map( ( c ) => cMap.get( c.id ) ?? c );

    return { nodes, actions, conditions };
}

export type AlignSlice = {
    alignLeft: () => void;
    alignCenterX: () => void;
    alignRight: () => void;
    alignTop: () => void;
    alignMiddleY: () => void;
    alignBottom: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const alignSlice: StateCreator<AppState, [], [], AlignSlice> = ( set, get, _api ) => ( {

    // === Horizontal ===
    alignLeft: () => {
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 2 ) return;

            const target = Math.min( ...items.map( leftOf ) );

            for ( const it of items ) {
                const w = sizeOf( it ).w;
                it.ent.x = target + w / 2;
            }

            set( ( prev ) => commitBack( prev, items ) );

            for ( const id of nodeIdsForRelayout ) {
                get().relayoutAncestors?.( id );
            }
        } );
    },

    alignCenterX: () => {
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 2 ) return;

            const target = items.reduce( ( a, it ) => a + it.ent.x, 0 ) / items.length;

            for ( const it of items ) {
                it.ent.x = target;
            }

            set( ( prev ) => commitBack( prev, items ) );

            for ( const id of nodeIdsForRelayout ) {
                get().relayoutAncestors?.( id );
            }
        } );
    },

    alignRight: () => {
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 2 ) return;

            const target = Math.max( ...items.map( rightOf ) );

            for ( const it of items ) {
                const w = sizeOf( it ).w;
                it.ent.x = target - w / 2;
            }

            set( ( prev ) => commitBack( prev, items ) );

            for ( const id of nodeIdsForRelayout ) {
                get().relayoutAncestors?.( id );
            }
        } );
    },

    // === Vertical ===
    alignTop: () => {
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 2 ) return;

            const target = Math.min( ...items.map( topOf ) );

            for ( const it of items ) {
                const h = sizeOf( it ).h;
                it.ent.y = target + h / 2;
            }

            set( ( prev ) => commitBack( prev, items ) );

            for ( const id of nodeIdsForRelayout ) {
                get().relayoutAncestors?.( id );
            }
        } );
    },

    alignMiddleY: () => {
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 2 ) return;

            const target = items.reduce( ( a, it ) => a + it.ent.y, 0 ) / items.length;

            for ( const it of items ) {
                it.ent.y = target;
            }

            set( ( prev ) => commitBack( prev, items ) );

            for ( const id of nodeIdsForRelayout ) {
                get().relayoutAncestors?.( id );
            }
        } );
    },

    alignBottom: () => {
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 2 ) return;

            const target = Math.max( ...items.map( bottomOf ) );

            for ( const it of items ) {
                const h = sizeOf( it ).h;
                it.ent.y = target - h / 2;
            }

            set( ( prev ) => commitBack( prev, items ) );

            for ( const id of nodeIdsForRelayout ) {
                get().relayoutAncestors?.( id );
            }
        } );
    },
} );