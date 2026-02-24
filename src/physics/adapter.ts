// src/physics/adapter.ts
import type { AppState } from "../state/types";
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

export function buildSimulatorFromStore(
    state: AppState,
    physicsOpts?: SimulatorOptions,
    movable?: Set<string> // ids (N./A./C.) movibles; undefined => todos movibles
) {
    const top = buildTopAncestorIndex( state );

    const nodes: NodeInput[] = [];
    // Nodos: integran por raíz (rootId = ancestro superior)
    for ( const n of state.nodes ) {
        nodes.push( { id: NK( n.id ), base: { x: n.x, y: n.y }, rootId: NK( top.get( n.id )! ) } );
    }
    // Acciones y condiciones: partículas independientes (sin rootId)
    for ( const a of state.actions ) nodes.push( { id: AK( a.id ), base: { x: a.x, y: a.y } } );
    for ( const c of state.conditions ) nodes.push( { id: CK( c.id ), base: { x: c.x, y: c.y } } );

    // Aristas: todas aportan resortes (incluyendo cruzadas seleccionado↔no seleccionado)
    const edges: SimEdge[] = state.edges.map( e => {
        const from =
            e.from.kind === "node" ? NK( e.from.id ) :
                e.from.kind === "action" ? AK( e.from.id ) : CK( e.from.id );
        const to =
            e.to.kind === "node" ? NK( e.to.id ) :
                e.to.kind === "action" ? AK( e.to.id ) : CK( e.to.id );
        return { from, to };
    } );

    // Defaults centralizados; sobreescribir con physicsOpts si vienen
    const sim = new ForceSimulator(
        nodes,
        edges,
        { ...DEFAULT_SIMULATOR_OPTIONS, ...( physicsOpts ?? {} ) },
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
