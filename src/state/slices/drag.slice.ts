// src/state/slices/drag.slice.ts
import type { AppState, ActionId, ConditionId, NodeId, Point } from "../types";
import { getNodeSizeCached } from "../../layout/measurement";
import { buildPatches, type Delta } from "./history.slice";

export const dragSlice = ( set: any, get: () => AppState ) =>
( {
    beginCombinedDrag: (
        anchor: Point,
        nodeIds: Set<NodeId>,
        actionIds: Set<ActionId>,
        condIds: Set<ConditionId>
    ) => {
        const startNodes = new Map<NodeId, { x: number; y: number }>();

        // Expandir selección a TODOS los descendientes (hijos, nietos, ...)
        const all = get().nodes;
        const parentOf = ( id: NodeId ) => all.find( n => n.id === id )?.parentId ?? null;
        const isDescendantOf = ( candidate: NodeId, ancestor: NodeId ): boolean => {
            let p = parentOf( candidate );
            while ( p != null ) {
                if ( p === ancestor ) return true;
                p = parentOf( p );
            }
            return false;
        };

        // Conjunto efectivo = seleccionados ∪ sus descendientes
        const effective = new Set<NodeId>( nodeIds );
        for ( const n of all ) {
            for ( const rootId of nodeIds ) {
                if ( isDescendantOf( n.id, rootId ) ) { effective.add( n.id ); break; }
            }
        }

        // Registrar posiciones iniciales para todos los nodos efectivos
        all.forEach( n => {
            if ( effective.has( n.id ) ) startNodes.set( n.id, { x: n.x, y: n.y } );
        } );

        const startActions = new Map<ActionId, { x: number; y: number }>();
        const startConds = new Map<ConditionId, { x: number; y: number }>();

        get().actions.forEach( a => {
            if ( actionIds.has( a.id ) ) startActions.set( a.id, { x: a.x, y: a.y } );
        } );
        get().conditions.forEach( c => {
            if ( condIds.has( c.id ) ) startConds.set( c.id, { x: c.x, y: c.y } );
        } );

        // Snapshot BEFORE completo para history
        const s0 = get();
        set( {
            drag: {
                active: true,
                anchor,
                startNodes,
                startActions,
                startConds,
            },
            dragHistoryBefore: {
                nodes: s0.nodes.map( n => ( { ...n } ) ),
                actions: s0.actions.map( a => ( { ...a } ) ),
                conditions: s0.conditions.map( c => ( { ...c } ) ),
            },
        } );
    },

    updateCombinedDrag: ( current: Point ) => {
        const { drag, nodes, actions, conditions } = get();
        if ( !drag.active ) return;

        const dx = current.x - drag.anchor.x;
        const dy = current.y - drag.anchor.y;

        const nextNodes = nodes.map( n => {
            const start = drag.startNodes.get( n.id );
            return start ? { ...n, x: start.x + dx, y: start.y + dy } : n;
        } );

        const nextActions = actions.map( a => {
            const start = drag.startActions.get( a.id );
            return start ? { ...a, x: start.x + dx, y: start.y + dy } : a;
        } );

        const nextConds = conditions.map( c => {
            const start = drag.startConds.get( c.id );
            return start ? { ...c, x: start.x + dx, y: start.y + dy } : c;
        } );

        set( { nodes: nextNodes, actions: nextActions, conditions: nextConds } );

        // Hover de drop target (solo si hay exactamente 1 nodo seleccionado)
        const sel = get().selection;
        if ( sel.size === 1 ) {
            const nodeId = Array.from( sel )[ 0 ];
            const target = get().getDropTargetFor( nodeId );
            get().setDragHoverParent( target );
        } else {
            get().setDragHoverParent( null );
        }
    },

    endCombinedDrag: () => {
        const s = get();
        if ( !s.drag.active ) {
            get().setDragHoverParent( null );
            return;
        }

        const movedNodeIds = Array.from( get().selection );

        const all = get().nodes;
        const levels = get().getLevelsMap();

        const rect = ( n: typeof all[ number ] ) => {
            const m = getNodeSizeCached( n );
            return { x: n.x - m.w / 2, y: n.y - m.h / 2, w: m.w, h: m.h };
        };

        const isAncestor = ( anc: NodeId, ch: NodeId ): boolean => {
            let p = all.find( n => n.id === ch )?.parentId ?? null;
            while ( p != null ) {
                if ( p === anc ) return true;
                p = all.find( n => n.id === p )?.parentId ?? null;
            }
            return false;
        };

        // --- lógica de nesting y relayout (tu código tal cual) ---
        if ( movedNodeIds.length > 0 ) {
            for ( const id of movedNodeIds ) {
                const child = all.find( n => n.id === id )!;
                const cx = child.x;
                const cy = child.y;

                const candidates = all.filter( c =>
                    c.id !== id &&
                    !isAncestor( id, c.id ) &&
                    ( () => {
                        const r = rect( c );
                        return ( cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h );
                    } )()
                );

                let newParent: NodeId | null = null;
                if ( candidates.length > 0 ) {
                    newParent = candidates.reduce( ( best, n ) =>
                        ( levels.get( n.id )! > levels.get( best.id )! ) ? n : best
                    ).id;
                }

                const prevParent = child.parentId ?? null;

                if ( prevParent !== ( newParent ?? null ) ) {
                    // 1) Cambiar parent
                    get().setParent( id, newParent ?? null );

                    // 2) Relayout del contenedor NUEVO (si hay)
                    if ( newParent != null ) {
                        get().relayoutContainer( newParent );
                        get().relayoutAncestors( newParent );
                    }

                    // 3) Relayout del contenedor ANTERIOR (si había)
                    if ( prevParent != null ) {
                        get().relayoutContainer( prevParent );
                        get().relayoutAncestors( prevParent );
                    }
                }
            }
        }

        // --- construir delta a partir del snapshot BEFORE y estado AFTER ---
        const beforeSnap = get().dragHistoryBefore;
        if ( beforeSnap ) {
            const afterNodes = get().nodes;
            const afterActions = get().actions;
            const afterConditions = get().conditions;

            const nodePatches = buildPatches( beforeSnap.nodes, afterNodes );
            const actionPatches = buildPatches( beforeSnap.actions, afterActions );
            const condPatches = buildPatches( beforeSnap.conditions, afterConditions );

            const delta: Delta = {};
            if ( nodePatches.length ) delta.nodes = nodePatches;
            if ( actionPatches.length ) delta.actions = actionPatches;
            if ( condPatches.length ) delta.conditions = condPatches;

            get().pushDelta( delta );
        }

        // limpiar drag + snapshot + hover
        set( {
            drag: {
                active: false,
                anchor: { x: 0, y: 0 },
                startNodes: new Map(),
                startActions: new Map(),
                startConds: new Map(),
            },
            dragHistoryBefore: null,
        } );

        get().setDragHoverParent( null );
    },
} satisfies Partial<AppState> );
