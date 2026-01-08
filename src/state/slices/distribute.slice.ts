// src/state/slices/distribute.slice.ts
import type { StateCreator } from "zustand";
import type {
    AppState, NodeBox, NodeId, ActionLabel, ConditionLabel,
} from "../types";
import {
    getNodeSizeCached,
    measureActionOval,
    measureConditionOval,
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
        const a = it.ent;
        const m = measureActionOval( a.title ?? "", a.wrap );
        return { w: a.w ?? m.w, h: a.h ?? m.h };
    }
    // condition
    const c = it.ent;
    const m = measureConditionOval( c.title ?? "", c.wrap );
    return { w: c.w ?? m.w, h: c.h ?? m.h };
}

function leftOf( it: ItemRef ): number {
    const s = sizeOf( it );
    return it.ent.x - s.w / 2;
}
function topOf( it: ItemRef ): number {
    const s = sizeOf( it );
    return it.ent.y - s.h / 2;
}

function setEntX( it: ItemRef, x: number ): void {
    if ( it.kind === "node" ) it.ent.x = x;
    else if ( it.kind === "action" ) it.ent.x = x;
    else it.ent.x = x; // condition
}
function setEntY( it: ItemRef, y: number ): void {
    if ( it.kind === "node" ) it.ent.y = y;
    else if ( it.kind === "action" ) it.ent.y = y;
    else it.ent.y = y; // condition
}

function distributeAlongX( sorted: ItemRef[] ): void {
    // Equiespacia los CENTROS en X, manteniendo fijos primero y último
    if ( sorted.length < 3 ) return;

    const c0 = sorted[ 0 ].ent.x;
    const cN = sorted[ sorted.length - 1 ].ent.x;
    const span = cN - c0;
    if ( Math.abs( span ) < 1e-9 ) return; // todos en el mismo centro → no hacemos nada

    const step = span / ( sorted.length - 1 );
    for ( let i = 1; i < sorted.length - 1; i++ ) {
        setEntX( sorted[ i ], c0 + step * i );
    }
}

function distributeAlongY( sorted: ItemRef[] ): void {
    // Equiespacia los CENTROS en Y, manteniendo fijos primero y último
    if ( sorted.length < 3 ) return;

    const c0 = sorted[ 0 ].ent.y;
    const cN = sorted[ sorted.length - 1 ].ent.y;
    const span = cN - c0;
    if ( Math.abs( span ) < 1e-9 ) return;

    const step = span / ( sorted.length - 1 );
    for ( let i = 1; i < sorted.length - 1; i++ ) {
        setEntY( sorted[ i ], c0 + step * i );
    }
}

function collectSelected( state: AppState ): {
    items: ItemRef[];
    nodeIdsForRelayout: Set<NodeId>;
} {
    const items: ItemRef[] = [];
    const relayoutNodes = new Set<NodeId>();

    // Nodos
    for ( const n of state.nodes ) {
        if ( state.selection?.has( n.id ) ) {
            items.push( { kind: "node", ent: { ...n } } );
            relayoutNodes.add( n.id );
        }
    }

    // Acciones
    for ( const a of state.actions ) {
        if ( state.selectionActions?.has( a.id ) ) {
            items.push( { kind: "action", ent: { ...a } } );
            relayoutNodes.add( a.originNodeId );
        }
    }

    // Condiciones
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

export type DistributeSlice = {
    distributeSelectedHorizontally: () => void;
    distributeSelectedVertically: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const distributeSlice: StateCreator<AppState, [], [], DistributeSlice> = ( set, get, _api ) => ( {
    distributeSelectedHorizontally: () => {
        // ✅ Todo el batch es deshacible
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 3 ) return;

            const sorted = [ ...items ].sort(
                ( a, b ) => leftOf( a ) - leftOf( b ) || ( a.ent.id - b.ent.id )
            );
            distributeAlongX( sorted );

            set( ( prev ) => commitBack( prev, sorted ) );
            for ( const id of nodeIdsForRelayout ) get().relayoutAncestors?.( id );
        } );
    },

    distributeSelectedVertically: () => {
        // ✅ Todo el batch es deshacible
        get().captureDelta( [ "nodes", "actions", "conditions" ], () => {
            const s = get();
            const { items, nodeIdsForRelayout } = collectSelected( s );
            if ( items.length < 3 ) return;

            const sorted = [ ...items ].sort(
                ( a, b ) => topOf( a ) - topOf( b ) || ( a.ent.id - b.ent.id )
            );
            distributeAlongY( sorted );

            set( ( prev ) => commitBack( prev, sorted ) );
            for ( const id of nodeIdsForRelayout ) get().relayoutAncestors?.( id );
        } );
    },
} );
