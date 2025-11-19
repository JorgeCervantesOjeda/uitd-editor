// src/state/slices/selection.slice.ts
import type { AppState, ActionId, ConditionId, NodeId } from "../types";

export const selectionSlice = ( set: any, get: () => AppState ) => {
    // -------- Helpers internos --------

    // Índice por parentId → [childIds]
    const buildByParent = () => {
        const nodes = get().nodes;
        const byParent = new Map<number, number[]>();
        for ( const n of nodes ) {
            const p = n.parentId ?? null;
            if ( p == null ) continue;
            if ( !byParent.has( p ) ) byParent.set( p, [] );
            byParent.get( p )!.push( n.id );
        }
        return byParent;
    };

    // Solo descendientes (excluye el propio id)
    const descendantsOf = ( id: NodeId ) => {
        const byParent = buildByParent();
        const out: number[] = [];
        const stack = [ id ];
        while ( stack.length ) {
            const cur = stack.pop()!;
            const kids = byParent.get( cur ) ?? [];
            for ( const k of kids ) {
                out.push( k );
                stack.push( k );
            }
        }
        return out;
    };

    const addWithDescendants = ( base: Set<NodeId>, id: NodeId ) => {
        const next = new Set( base );
        next.add( id );
        for ( const d of descendantsOf( id ) ) next.add( d as NodeId );
        return next;
    };

    const removeWithDescendants = ( base: Set<NodeId>, id: NodeId ) => {
        const next = new Set( base );
        next.delete( id );
        for ( const d of descendantsOf( id ) ) next.delete( d as NodeId );
        return next;
    };

    // Raíz (sube por parentId hasta null)
    const rootOf = ( id: NodeId ): NodeId => {
        const nodes = get().nodes;
        const byId = new Map( nodes.map( n => [ n.id, n as { id: NodeId; parentId?: NodeId | null } ] ) );
        let cur: NodeId = id;
        const seen = new Set<NodeId>();
        while ( true ) {
            if ( seen.has( cur ) ) break; // defensa ante ciclos
            seen.add( cur );
            const p = byId.get( cur )?.parentId ?? null;
            if ( p == null ) return cur;
            cur = p as NodeId;
        }
        return cur;
    };

    // -------- Slice --------
    return {
        clearSelection: () =>
            set( {
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            } ),

        // --- Nodos ---
        // keep=false: selección simple (id + descendientes)
        // keep=true : agrega (id + descendientes) a la selección actual
        selectSingleOrKeep: ( id: NodeId, keep: boolean ) => {
            const cur = get().selection ?? new Set<NodeId>();
            const next = keep
                ? addWithDescendants( cur, id )
                : addWithDescendants( new Set<NodeId>(), id );
            set( {
                selection: next,
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            } );
        },

        // Toggle actúa como bloque (id + descendientes)
        toggleSelect: ( id: NodeId ) => {
            const cur = get().selection ?? new Set<NodeId>();
            const next = cur.has( id )
                ? removeWithDescendants( cur, id )
                : addWithDescendants( cur, id );
            set( { selection: next } );
        },

        // --- Actions ---
        selectSingleOrKeepAction: ( id: ActionId, keep: boolean ) => {
            const sel = new Set( get().selectionActions );
            if ( keep && sel.has( id ) ) {
                set( { selectionActions: sel } );
                return;
            }
            sel.clear();
            sel.add( id );
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

        // --- Conditions ---
        selectSingleOrKeepCondition: ( id: ConditionId, keep: boolean ) => {
            const sel = new Set( get().selectionConds );
            if ( keep && sel.has( id ) ) {
                set( { selectionConds: sel } );
                return;
            }
            sel.clear();
            sel.add( id );
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

        /**
         * Selección efectiva para la simulación:
         * - Considera SOLO raíces seleccionadas y agrega toda su clausura de descendientes.
         * - Si un nodo está seleccionado pero su raíz NO lo está, se ignora.
         * - Si el padre está seleccionado pero algunos hijos no lo están en UI,
         *   en simulación se toman TODOS los descendientes del padre igualmente.
         */
        getSimulationSelectedNodes: () => {
            const sel = get().selection ?? new Set<NodeId>();
            if ( sel.size === 0 ) return new Set<NodeId>();

            // 1) Raíces realmente seleccionadas
            const selectedRoots = new Set<NodeId>();
            for ( const id of sel ) {
                const r = rootOf( id );
                if ( sel.has( r ) ) selectedRoots.add( r );
            }
            if ( selectedRoots.size === 0 ) return new Set<NodeId>();

            // 2) Clausura: raíz + todos sus descendientes
            const out = new Set<NodeId>();
            for ( const r of selectedRoots ) {
                out.add( r );
                for ( const d of descendantsOf( r ) ) out.add( d as NodeId );
            }
            return out;
        },
    } satisfies Partial<AppState>;
};
