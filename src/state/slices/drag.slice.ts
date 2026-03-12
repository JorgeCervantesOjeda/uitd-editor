// src/state/slices/drag.slice.ts
import type { AppState, ActionId, ConditionId, NodeId, Point } from "../types";
import { getNodeSizeCached } from "../../layout/measurement";
import { buildPatches, type Delta } from "./history.slice";
import { measureActionOval, measureConditionOval } from "../../layout/measurement";
import { NODE_WRAP_DEFAULT } from "../../model/types";

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

export const dragSlice = ( set: SetState, get: () => AppState ) =>
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
            const seen = new Set<NodeId>();
            while ( p != null ) {
                if ( seen.has( p ) ) return false;
                seen.add( p );
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
            dragGuides: { enabled: false },
        } );
    },

    updateCombinedDrag: ( current: Point, shiftKey: boolean ) => {
        const { drag, nodes, actions, conditions } = get();
        if ( !drag.active ) return;

        let dx = current.x - drag.anchor.x;
        let dy = current.y - drag.anchor.y;
        const FINE_DRAG_SCALE = 0.2;
        if ( shiftKey ) {
            dx *= FINE_DRAG_SCALE;
            dy *= FINE_DRAG_SCALE;
        }

        // Conjuntos moviéndose
        const movingNodeIds = new Set<NodeId>( Array.from( drag.startNodes.keys() ) );
        const movingActionIds = new Set<ActionId>( Array.from( drag.startActions.keys() ) );
        const movingCondIds = new Set<ConditionId>( Array.from( drag.startConds.keys() ) );

        // ----- helpers jerarquía SOLO para nodos -----
        const all = nodes;

        const parentOf = ( id: NodeId ): NodeId | null =>
            all.find( n => n.id === id )?.parentId ?? null;

        const isAncestor = ( anc: NodeId, ch: NodeId ): boolean => {
            let p = parentOf( ch );
            const seen = new Set<NodeId>();
            while ( p != null ) {
                if ( seen.has( p ) ) return false;
                seen.add( p );
                if ( p === anc ) return true;
                p = parentOf( p );
            }
            return false;
        };

        // raíces movidas (selección original) para definir “jerarquía”
        const movedRoots = new Set<NodeId>( Array.from( get().selection ) );

        const isInMovedHierarchy = ( nodeId: NodeId ): boolean => {
            // mismo nodo
            if ( movedRoots.has( nodeId ) ) return true;

            // ancestro o descendiente de algún root
            for ( const r of movedRoots ) {
                if ( isAncestor( r, nodeId ) ) return true; // nodeId es descendiente de r
                if ( isAncestor( nodeId, r ) ) return true; // nodeId es ancestro de r
            }
            return false;
        };

        // ----- SNAP solo con Shift -----
        const SNAP_DIST = 8;
        // ✅ 1) Tipar explícitamente como boolean
        let dragGuides: { enabled: boolean; x?: number; y?: number } = { enabled: false };


        // bbox del grupo movido (usando posición tentativa start+dx/dy)
        let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;

        // nodes moviéndose (incluye descendientes expandidos)
        for ( const n of nodes ) {
            const st = drag.startNodes.get( n.id );
            if ( !st ) continue;
            const tmp = { ...n, x: st.x + dx, y: st.y + dy };
            const m = getNodeSizeCached( tmp );
            minX = Math.min( minX, tmp.x - m.w / 2 );
            maxX = Math.max( maxX, tmp.x + m.w / 2 );
            minY = Math.min( minY, tmp.y - m.h / 2 );
            maxY = Math.max( maxY, tmp.y + m.h / 2 );
        }

        // actions moviéndose
        for ( const a of actions ) {
            const st = drag.startActions.get( a.id );
            if ( !st ) continue;
            const tmp = { ...a, x: st.x + dx, y: st.y + dy };
            const m = measureActionOval( tmp.title, tmp.wrap ?? NODE_WRAP_DEFAULT );
            minX = Math.min( minX, tmp.x - m.w / 2 );
            maxX = Math.max( maxX, tmp.x + m.w / 2 );
            minY = Math.min( minY, tmp.y - m.h / 2 );
            maxY = Math.max( maxY, tmp.y + m.h / 2 );
        }

        // conditions moviéndose
        for ( const c of conditions ) {
            const st = drag.startConds.get( c.id );
            if ( !st ) continue;
            const tmp = { ...c, x: st.x + dx, y: st.y + dy };
            const m = measureConditionOval( tmp.title, tmp.wrap ?? NODE_WRAP_DEFAULT );
            minX = Math.min( minX, tmp.x - m.w / 2 );
            maxX = Math.max( maxX, tmp.x + m.w / 2 );
            minY = Math.min( minY, tmp.y - m.h / 2 );
            maxY = Math.max( maxY, tmp.y + m.h / 2 );
        }

        if ( Number.isFinite( minX ) && Number.isFinite( minY ) ) {
            const bbox = {
                left: minX,
                right: maxX,
                top: minY,
                bottom: maxY,
                cx: ( minX + maxX ) / 2,
                cy: ( minY + maxY ) / 2,
            };

            // targets
            const xTargets: number[] = [];
            const yTargets: number[] = [];

            // NODOS: solo externos por jerarquía (A)
            for ( const n of nodes ) {
                if ( movingNodeIds.has( n.id ) ) continue;
                if ( isInMovedHierarchy( n.id ) ) continue;

                const m = getNodeSizeCached( n );
                xTargets.push( n.x - m.w / 2, n.x, n.x + m.w / 2 );
                yTargets.push( n.y - m.h / 2, n.y, n.y + m.h / 2 );
            }

            // ACTIONS: no filtrar por jerarquía (solo excluir si se mueven)
            for ( const a of actions ) {
                if ( movingActionIds.has( a.id ) ) continue;
                const m = measureActionOval( a.title, a.wrap ?? NODE_WRAP_DEFAULT );
                xTargets.push( a.x - m.w / 2, a.x, a.x + m.w / 2 );
                yTargets.push( a.y - m.h / 2, a.y, a.y + m.h / 2 );
            }

            // CONDITIONS: no filtrar por jerarquía (solo excluir si se mueven)
            for ( const c of conditions ) {
                if ( movingCondIds.has( c.id ) ) continue;
                const m = measureConditionOval( c.title, c.wrap ?? NODE_WRAP_DEFAULT );
                xTargets.push( c.x - m.w / 2, c.x, c.x + m.w / 2 );
                yTargets.push( c.y - m.h / 2, c.y, c.y + m.h / 2 );
            }

            const xAnchors = [ bbox.left, bbox.cx, bbox.right ];
            const yAnchors = [ bbox.top, bbox.cy, bbox.bottom ];

            let bestDx: { delta: number; target: number } | null = null;
            for ( const a of xAnchors ) {
                for ( const t of xTargets ) {
                    const d = t - a;
                    const ad = Math.abs( d );
                    if ( ad <= SNAP_DIST && ( !bestDx || ad < Math.abs( bestDx.delta ) ) ) {
                        bestDx = { delta: d, target: t };
                    }
                }
            }

            let bestDy: { delta: number; target: number } | null = null;
            for ( const a of yAnchors ) {
                for ( const t of yTargets ) {
                    const d = t - a;
                    const ad = Math.abs( d );
                    if ( ad <= SNAP_DIST && ( !bestDy || ad < Math.abs( bestDy.delta ) ) ) {
                        bestDy = { delta: d, target: t };
                    }
                }
            }

            if ( bestDx ) { dx += bestDx.delta; dragGuides = { ...dragGuides, enabled: true, x: bestDx.target }; }
            if ( bestDy ) { dy += bestDy.delta; dragGuides = { ...dragGuides, enabled: true, y: bestDy.target }; }
            if ( !bestDx && !bestDy ) { dragGuides = { ...dragGuides, enabled: true }; }
        } else {
            dragGuides = { ...dragGuides, enabled: true };
        }

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

        set( { nodes: nextNodes, actions: nextActions, conditions: nextConds, dragGuides } );

        // Hover drop target (como ya lo tenías)
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
            const seen = new Set<NodeId>();
            while ( p != null ) {
                if ( seen.has( p ) ) return false;
                seen.add( p );
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
            dragGuides: { enabled: false },
        } );

        get().setDragHoverParent( null );
    },
} satisfies Partial<AppState> );
