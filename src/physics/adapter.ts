// src/physics/adapter.ts
import type { AppState } from "../state/types";
import {
    getActionSizeCached,
    getConditionSizeCached,
    getNodeSizeCached,
} from "../layout/measurement";
import { ForceSimulator, type NodeInput, type Edge as SimEdge, type SimulatorOptions } from "./force-simulator";
import { DEFAULT_SIMULATOR_OPTIONS } from "./defaults";

export type { SimulatorOptions };

const NK = ( id: number ) => `N.${id}`;
const AK = ( id: number ) => `A.${id}`;
const CK = ( id: number ) => `C.${id}`;

// Mapa: id de nodo -> ancestro superior (raíz) para integrarlo por contenedor
function buildTopAncestorIndex( state: AppState ): Map<number, number> {
    const byId = new Map( state.nodes.map( n => [ n.id, n ] ) );
    const top = new Map<number, number>();

    const findTop = ( id: number ): number => {
        let cur = id;
        const seen = new Set<number>();
        while ( true ) {
            if ( seen.has( cur ) ) break;
            seen.add( cur );
            const p = byId.get( cur )?.parentId ?? null;
            if ( p == null ) break;
            cur = p;
        }
        return cur;
    };

    for ( const n of state.nodes ) top.set( n.id, findTop( n.id ) );
    return top;
}

function scalarPhysicsSize( w: number, h: number, minSize: number ): number {
    return Math.max( minSize, ( w + h ) / 2 );
}

function buildSizeIndex( state: AppState, minSize: number ): Map<string, number> {
    const out = new Map<string, number>();

    for ( const n of state.nodes ) {
        const s = getNodeSizeCached( n );
        out.set( NK( n.id ), scalarPhysicsSize( s.w, s.h, minSize ) );
    }

    for ( const a of state.actions ) {
        const s = getActionSizeCached( a );
        out.set( AK( a.id ), scalarPhysicsSize( s.w, s.h, minSize ) );
    }

    for ( const c of state.conditions ) {
        const s = getConditionSizeCached( c );
        out.set( CK( c.id ), scalarPhysicsSize( s.w, s.h, minSize ) );
    }

    return out;
}

function edgeEndpointKey(
    ep: { kind: "node"; id: number } | { kind: "action"; id: number } | { kind: "condition"; id: number }
): string {
    return ep.kind === "node"
        ? NK( ep.id )
        : ep.kind === "action"
            ? AK( ep.id )
            : CK( ep.id );
}

function repulsionChargeFromSize( size: number, minSize: number, exponent: number ): number {
    return Math.pow( Math.max( 1, size / minSize ), exponent );
}

export function buildSimulatorFromStore(
    state: AppState,
    physicsOpts?: SimulatorOptions,
    movable?: Set<string> // ids (N./A./C.) movibles; undefined => todos movibles
) {
    const top = buildTopAncestorIndex( state );
    const mergedOpts = { ...DEFAULT_SIMULATOR_OPTIONS, ...( physicsOpts ?? {} ) };
    const sizeByKey = buildSizeIndex( state, mergedOpts.restLengthMinSize );

    const nodes: NodeInput[] = [];

    // Nodos: integran por raíz (rootId = ancestro superior)
    for ( const n of state.nodes ) {
        const key = NK( n.id );
        const size = sizeByKey.get( key ) ?? mergedOpts.restLengthMinSize;

        nodes.push( {
            id: key,
            base: { x: n.x, y: n.y },
            rootId: NK( top.get( n.id )! ),
            repulsionCharge: repulsionChargeFromSize(
                size,
                mergedOpts.restLengthMinSize,
                mergedOpts.repulsionSizeExponent
            ),
        } );
    }

    // Acciones y condiciones: partículas independientes (sin rootId)
    for ( const a of state.actions ) {
        const key = AK( a.id );
        const size = sizeByKey.get( key ) ?? mergedOpts.restLengthMinSize;

        nodes.push( {
            id: key,
            base: { x: a.x, y: a.y },
            repulsionCharge: repulsionChargeFromSize(
                size,
                mergedOpts.restLengthMinSize,
                mergedOpts.repulsionSizeExponent
            ),
        } );
    }

    for ( const c of state.conditions ) {
        const key = CK( c.id );
        const size = sizeByKey.get( key ) ?? mergedOpts.restLengthMinSize;

        nodes.push( {
            id: key,
            base: { x: c.x, y: c.y },
            repulsionCharge: repulsionChargeFromSize(
                size,
                mergedOpts.restLengthMinSize,
                mergedOpts.repulsionSizeExponent
            ),
        } );
    }

    // Aristas: cada una aporta un resorte con longitud de reposo propia
    const edges: SimEdge[] = state.edges.map( e => {
        const from = edgeEndpointKey( e.from );
        const to = edgeEndpointKey( e.to );

        const fromSize = sizeByKey.get( from ) ?? mergedOpts.restLengthMinSize;
        const toSize = sizeByKey.get( to ) ?? mergedOpts.restLengthMinSize;

        const avgSize = ( fromSize + toSize ) / 2;
        const restLength =
            mergedOpts.equilibriumDist +
            mergedOpts.restLengthSizeFactor * avgSize;

        return { from, to, restLength };
    } );

    const sim = new ForceSimulator(
        nodes,
        edges,
        mergedOpts,
        movable
    );
    return sim;
}

// Posiciones absolutas por id lógico (N./A./C.)
export type PosMap = Record<string, { x: number; y: number }>;

export function applyPositionsToStore(
    pos: PosMap,
    set: ( p: Partial<AppState> ) => void,
    get: () => AppState,
    onlyIds?: Set<string> // opcional: escribir sólo estos ids
) {
    const s = get();
    const allow = ( k: string ) => !onlyIds || onlyIds.has( k );

    const nextNodes = s.nodes.map( n => {
        const key = NK( n.id );
        return allow( key ) && pos[ key ] ? { ...n, ...pos[ key ] } : n;
    } );

    const nextActions = s.actions.map( a => {
        const key = AK( a.id );
        return allow( key ) && pos[ key ] ? { ...a, ...pos[ key ] } : a;
    } );

    const nextConds = s.conditions.map( c => {
        const key = CK( c.id );
        return allow( key ) && pos[ key ] ? { ...c, ...pos[ key ] } : c;
    } );

    set( { nodes: nextNodes, actions: nextActions, conditions: nextConds } );
}