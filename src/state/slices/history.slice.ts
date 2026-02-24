// src/state/slices/history.slice.ts
import type {
    AppState,
    NodeBox,
    ActionLabel,
    ConditionLabel,
    Edge,
} from "../types";

export type HistoryKey = "nodes" | "actions" | "conditions" | "edges";

export type NodePatch = { before?: NodeBox; after?: NodeBox };
export type ActionPatch = { before?: ActionLabel; after?: ActionLabel };
export type ConditionPatch = { before?: ConditionLabel; after?: ConditionLabel };
export type EdgePatch = { before?: Edge; after?: Edge };

export type Delta = {
    nodes?: NodePatch[];
    actions?: ActionPatch[];
    conditions?: ConditionPatch[];
    edges?: EdgePatch[];
};

export type HistoryEntry = {
    delta: Delta;
    size: number;
};

const MAX_HISTORY_BYTES = 10 * 1024 * 1024; // 10MB aprox

// Helpers genéricos
type HasId = { id: number };

function shallowEqual<T extends Record<string, unknown>>( a: T, b: T ): boolean {
    const ka = Object.keys( a );
    const kb = Object.keys( b );
    if ( ka.length !== kb.length ) return false;
    for ( const k of ka ) {
        if ( a[ k as keyof T ] !== b[ k as keyof T ] ) return false;
    }
    return true;
}

export function buildPatches<T extends HasId>(
    before: T[],
    after: T[]
): { before?: T; after?: T }[] {
    const beforeMap = new Map( before.map( ( x ) => [ x.id, x ] ) );
    const afterMap = new Map( after.map( ( x ) => [ x.id, x ] ) );
    const ids = new Set<number>( [
        ...beforeMap.keys(),
        ...afterMap.keys(),
    ] );

    const patches: { before?: T; after?: T }[] = [];

    for ( const id of ids ) {
        const b = beforeMap.get( id );
        const a = afterMap.get( id );
        if ( !b && a ) {
            patches.push( { before: undefined, after: a } );
        } else if ( b && !a ) {
            patches.push( { before: b, after: undefined } );
        } else if ( b && a && !shallowEqual( b, a ) ) {
            patches.push( { before: b, after: a } );
        }
    }

    return patches;
}

function estimateSize( delta: Delta ): number {
    try {
        return JSON.stringify( delta ).length;
    } catch {
        return 1024; // fallback grosero
    }
}

function applyDeltaDir(
    delta: Delta,
    dir: "forward" | "backward",
    get: () => AppState,
    set: ( partial: Partial<AppState> ) => void
) {
    const s = get();
    let nodes = s.nodes;
    let actions = s.actions;
    let conditions = s.conditions;
    let edges = s.edges;

    const applyPatches = <T extends HasId>(
        current: T[],
        patches?: { before?: T; after?: T }[]
    ): T[] => {
        if ( !patches || patches.length === 0 ) return current;
        const map = new Map( current.map( ( x ) => [ x.id, x ] ) );
        for ( const p of patches ) {
            const target = dir === "forward" ? p.after : p.before;
            const id = ( p.after ?? p.before )!.id;
            if ( !target ) {
                map.delete( id );
            } else {
                map.set( id, target );
            }
        }
        return Array.from( map.values() );
    };

    nodes = applyPatches( nodes, delta.nodes );
    actions = applyPatches( actions, delta.actions );
    conditions = applyPatches( conditions, delta.conditions );
    edges = applyPatches( edges, delta.edges );

    // Recalcular next* en función del contenido actual para que undo/redo
    // también reviertan los contadores y no se queden “inflados”.
    const allIdForNext = [
        ...nodes.map( n => n.id ),
        ...conditions.map( c => c.id ),
    ];
    const nextId =
        allIdForNext.length > 0
            ? Math.max( ...allIdForNext ) + 1
            : 1;

    const nextActionId =
        actions.length > 0
            ? Math.max( ...actions.map( a => a.id ) ) + 1
            : 1;

    const nextEdgeId =
        edges.length > 0
            ? Math.max( ...edges.map( e => e.id ) ) + 1
            : 1;

    set( {
        nodes,
        actions,
        conditions,
        edges,
        nextId,
        nextActionId,
        nextEdgeId,
    } );
}

export type HistoryState = {
    historyUndo: HistoryEntry[];
    historyRedo: HistoryEntry[];
    historyBytes: number;

    // Sesión de edición agrupada (p.ej. un diálogo abierto)
    editingSession: {
        keys: HistoryKey[];
        beforeNodes: NodeBox[];
        beforeActions: ActionLabel[];
        beforeConditions: ConditionLabel[];
        beforeEdges: Edge[];
    } | null;

    beginEditingSession: ( keys: HistoryKey[] ) => void;
    commitEditingSession: () => void;

    pushDelta: ( delta: Delta ) => void;
    undo: () => void;
    redo: () => void;

    /**
     * Ayuda genérica para la mayoría de acciones:
     * - snapshot “before” de keys (nodes/actions/conditions/edges)
     * - ejecuta fn()
     * - snapshot “after”
     * - construye delta con lo que cambió y lo mete al historial
     *
     * Si hay una editingSession activa que cubre esas keys,
     * solo ejecuta fn() y deja el diff para commitEditingSession().
     */
    captureDelta: ( keys: HistoryKey[], fn: () => void ) => void;

    // Snapshot especial para drag (para tener el BEFORE del arrastre)
    dragHistoryBefore: {
        nodes: NodeBox[];
        actions: ActionLabel[];
        conditions: ConditionLabel[];
    } | null;
};

export const historySlice = (
    set: ( partial: Partial<AppState> ) => void,
    get: () => AppState
): HistoryState => ( {
    historyUndo: [],
    historyRedo: [],
    historyBytes: 0,

    editingSession: null,

    beginEditingSession: ( keys: HistoryKey[] ) => {
        // Si ya había una sesión, la cerramos primero
        const current = get().editingSession;
        if ( current ) {
            get().commitEditingSession();
        }

        const s0 = get();
        const beforeNodes = keys.includes( "nodes" ) ? s0.nodes.map( n => ( { ...n } ) ) : [];
        const beforeActions = keys.includes( "actions" ) ? s0.actions.map( a => ( { ...a } ) ) : [];
        const beforeConditions = keys.includes( "conditions" ) ? s0.conditions.map( c => ( { ...c } ) ) : [];
        const beforeEdges = keys.includes( "edges" ) ? s0.edges.map( e => ( { ...e } ) ) : [];

        set( {
            editingSession: {
                keys,
                beforeNodes,
                beforeActions,
                beforeConditions,
                beforeEdges,
            },
        } );
    },

    commitEditingSession: () => {
        const session = get().editingSession;
        if ( !session ) return;

        const s1 = get();
        const delta: Delta = {};

        if ( session.keys.includes( "nodes" ) ) {
            const p = buildPatches( session.beforeNodes, s1.nodes );
            if ( p.length ) delta.nodes = p;
        }
        if ( session.keys.includes( "actions" ) ) {
            const p = buildPatches( session.beforeActions, s1.actions );
            if ( p.length ) delta.actions = p;
        }
        if ( session.keys.includes( "conditions" ) ) {
            const p = buildPatches( session.beforeConditions, s1.conditions );
            if ( p.length ) delta.conditions = p;
        }
        if ( session.keys.includes( "edges" ) ) {
            const p = buildPatches( session.beforeEdges, s1.edges );
            if ( p.length ) delta.edges = p;
        }

        // limpiamos la sesión antes de pushear al historial
        set( { editingSession: null } );

        if (
            ( delta.nodes && delta.nodes.length ) ||
            ( delta.actions && delta.actions.length ) ||
            ( delta.conditions && delta.conditions.length ) ||
            ( delta.edges && delta.edges.length )
        ) {
            get().pushDelta( delta );
        }
    },

    pushDelta: ( delta: Delta ) => {
        // No meter entradas vacías
        if (
            ( !delta.nodes || delta.nodes.length === 0 ) &&
            ( !delta.actions || delta.actions.length === 0 ) &&
            ( !delta.conditions || delta.conditions.length === 0 ) &&
            ( !delta.edges || delta.edges.length === 0 )
        ) {
            return;
        }

        const size = estimateSize( delta );
        let undo = [ ...get().historyUndo, { delta, size } ];
        const redo: HistoryEntry[] = [];
        let bytes = get().historyBytes + size;

        while ( bytes > MAX_HISTORY_BYTES && undo.length > 0 ) {
            const removed = undo[ 0 ];
            undo = undo.slice( 1 );
            bytes -= removed.size;
        }

        set( {
            historyUndo: undo,
            historyRedo: redo,
            historyBytes: bytes,
        } );
    },

    undo: () => {
        const st = get();
        if ( st.historyUndo.length === 0 ) return;
        const entry = st.historyUndo[ st.historyUndo.length - 1 ];
        const rest = st.historyUndo.slice( 0, -1 );

        applyDeltaDir( entry.delta, "backward", get, set );

        set( {
            historyUndo: rest,
            historyRedo: [ ...st.historyRedo, entry ],
        } );
    },

    redo: () => {
        const st = get();
        if ( st.historyRedo.length === 0 ) return;
        const entry = st.historyRedo[ st.historyRedo.length - 1 ];
        const rest = st.historyRedo.slice( 0, -1 );

        applyDeltaDir( entry.delta, "forward", get, set );

        set( {
            historyUndo: [ ...st.historyUndo, entry ],
            historyRedo: rest,
        } );
    },

    captureDelta: ( keys: HistoryKey[], fn: () => void ) => {
        const session = get().editingSession;
        if (
            session &&
            keys.every( k => session.keys.includes( k ) )
        ) {
            // Estamos dentro de una sesión agrupada para estas keys:
            // aplicamos cambios pero delegamos el diff a commitEditingSession().
            fn();
            return;
        }

        const s0 = get();
        const beforeNodes = keys.includes( "nodes" ) ? s0.nodes.map( ( n ) => ( { ...n } ) ) : [];
        const beforeActions = keys.includes( "actions" ) ? s0.actions.map( ( a ) => ( { ...a } ) ) : [];
        const beforeConditions = keys.includes( "conditions" ) ? s0.conditions.map( ( c ) => ( { ...c } ) ) : [];
        const beforeEdges = keys.includes( "edges" ) ? s0.edges.map( ( e ) => ( { ...e } ) ) : [];

        fn(); // aquí se hace la mutación real

        const s1 = get();
        const afterNodes = keys.includes( "nodes" ) ? s1.nodes : [];
        const afterActions = keys.includes( "actions" ) ? s1.actions : [];
        const afterConditions = keys.includes( "conditions" ) ? s1.conditions : [];
        const afterEdges = keys.includes( "edges" ) ? s1.edges : [];

        const delta: Delta = {};
        if ( keys.includes( "nodes" ) ) {
            const p = buildPatches( beforeNodes, afterNodes );
            if ( p.length ) delta.nodes = p;
        }
        if ( keys.includes( "actions" ) ) {
            const p = buildPatches( beforeActions, afterActions );
            if ( p.length ) delta.actions = p;
        }
        if ( keys.includes( "conditions" ) ) {
            const p = buildPatches( beforeConditions, afterConditions );
            if ( p.length ) delta.conditions = p;
        }
        if ( keys.includes( "edges" ) ) {
            const p = buildPatches( beforeEdges, afterEdges );
            if ( p.length ) delta.edges = p;
        }

        get().pushDelta( delta );
    },

    dragHistoryBefore: null,
} );
