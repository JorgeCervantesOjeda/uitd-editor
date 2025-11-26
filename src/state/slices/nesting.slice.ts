// src/state/slices/nesting.slice.ts
import type { AppState, NodeId } from "../types";
import {
    getNodeSizeCached,
    layoutChildrenSquareish,
    measureNodeSizeWithId,
} from "../../layout/measurement";
import {
    CONTAINER_PAD_X,
    CONTAINER_CHILDREN_TOP_PAD,
    CONTAINER_CHILDREN_BOTTOM_PAD,
    CHILD_GAP_X,
    CHILD_GAP_Y,
    CONTAINER_HEADER_GAP_Y,
    MIN_W,
    MIN_H,
    NODE_MIN_H,
    NODE_BOTTOM_PAD,
    NODE_WRAP_DEFAULT,
} from "../../model/types";

export const nestingSlice = ( set: any, get: () => AppState ) =>
( {
    /**
     * Cambia el padre de un nodo. Re-layout:
     * - Del contenedor viejo hacia la raíz (usando la cadena previa).
     * - Del contenedor nuevo hacia la raíz (usando la cadena posterior).
     * No toca acciones/condiciones.
     */
    setParent: ( child: NodeId, parent: NodeId | null ) => {
        const sBefore = get();

        const oldParent: NodeId | null =
            sBefore.nodes.find( ( n ) => n.id === child )?.parentId ?? null;

        // Si no cambia, nada que hacer
        if ( oldParent === parent ) return;

        // --- 1) Capturar cadena de ancestros del viejo padre (en el estado previo) ---
        const oldChain: NodeId[] = [];
        if ( oldParent != null ) {
            const parentOfPrev = ( id: NodeId | null ): NodeId | null =>
                id == null
                    ? null
                    : ( sBefore.nodes.find( ( n ) => n.id === id )?.parentId ?? null );
            let cur: NodeId | null = oldParent;
            while ( cur != null ) {
                oldChain.push( cur );
                cur = parentOfPrev( cur );
            }
        }

        // --- 2) Aplicar el cambio de parent ---
        set( {
            nodes: sBefore.nodes.map( ( n ) =>
                n.id === child ? { ...n, parentId: parent ?? null } : n
            ),
        } );

        // --- 3) Capturar cadena de ancestros del nuevo padre (en el estado actual) ---
        const sAfter = get();
        const newChain: NodeId[] = [];
        if ( parent != null ) {
            const parentOfNow = ( id: NodeId | null ): NodeId | null =>
                id == null
                    ? null
                    : ( sAfter.nodes.find( ( n ) => n.id === id )?.parentId ?? null );
            let cur: NodeId | null = parent;
            while ( cur != null ) {
                newChain.push( cur );
                cur = parentOfNow( cur );
            }
        }

        // --- 4) Re-layout bottom-up de ambas cadenas ---
        // Vieja cadena (el hijo ya no está ahí)
        for ( const cid of oldChain ) get().relayoutContainer( cid );
        // Nueva cadena (el hijo ya está ahí)
        for ( const cid of newChain ) get().relayoutContainer( cid );
    },

    /**
     * Recalcula tamaño del contenedor (mantiene centro) y posiciona hijos
     * según layout en fila. No toca acciones/condiciones.
     */
    relayoutContainer: ( containerId: NodeId ) => {
        const s = get();
        const container = s.nodes.find( ( n ) => n.id === containerId );
        if ( !container ) return;

        const children = s.nodes.filter(
            ( n ) => ( n.parentId ?? null ) === containerId
        );

        // Medición del cabezal (sin hijos)
        const base = measureNodeSizeWithId(
            ( container.displayId ?? container.id ),
            container.title,
            container.wrap ?? NODE_WRAP_DEFAULT,
            {
                bottomPad: NODE_BOTTOM_PAD,
                minH: NODE_MIN_H,
            }
        );

        // Sin hijos => tamaño = cabezal
        if ( children.length === 0 ) {
            set( {
                nodes: s.nodes.map( ( n ) =>
                    n.id === containerId ? { ...n, w: base.w, h: base.h } : n
                ),
            } );
            return;
        }

        // Con hijos: medir
        const sizes = children.map( ( c ) => {
            const m = getNodeSizeCached( c );
            return { w: m.w, h: m.h };
        } );

        // Layout relativo
        const { container: inner, positions: relPositions } =
            layoutChildrenSquareish(
                { x: 0, y: 0 },
                sizes,
                {
                    padX: CONTAINER_PAD_X,
                    padTopY: CONTAINER_CHILDREN_TOP_PAD,
                    padBottomY: CONTAINER_CHILDREN_BOTTOM_PAD,
                    gapX: CHILD_GAP_X,
                    gapY: CHILD_GAP_Y,
                    minW: MIN_W,
                    minH: MIN_H,
                }
            );

        // Tamaño final (manteniendo centro)
        const newW = Math.max( base.w, inner.w );
        const newH = base.h + CONTAINER_HEADER_GAP_Y + inner.h;

        // Top-left desde el centro actual
        const TLx = container.x - newW / 2;
        const TLy = container.y - newH / 2;

        // Offset real del bloque de hijos
        const ox = TLx;
        const oy = TLy + base.h + CONTAINER_HEADER_GAP_Y;

        // Posiciones absolutas (centro) por hijo
        const posById = new Map<number, { x: number; y: number }>();
        children.forEach( ( c, i ) => {
            const p = relPositions[ i ];
            const { w, h } = sizes[ i ];
            posById.set( c.id, { x: ox + p.x + w / 2, y: oy + p.y + h / 2 } );
        } );

        set( {
            nodes: s.nodes.map( ( n ) => {
                if ( n.id === containerId ) return { ...n, w: newW, h: newH };
                const p = posById.get( n.id );
                return p ? { ...n, x: p.x, y: p.y } : n;
            } ),
        } );
    },

    /**
     * Re-layout de ancestros de un nodo (no incluye al propio nodo).
     * Se mantiene por compatibilidad con llamadas existentes.
     */
    relayoutAncestors: ( nodeId: NodeId ) => {
        const nodes = get().nodes;
        const parentOf = ( id: NodeId ) =>
            nodes.find( ( n ) => n.id === id )?.parentId ?? null;
        let p = parentOf( nodeId );
        while ( p != null ) {
            get().relayoutContainer( p );
            p = parentOf( p );
        }
    },

    /** Mapa de niveles (root=0) sólo sobre nodos. */
    getLevelsMap: () => {
        const { nodes } = get();
        const levels = new Map<NodeId, number>();
        const getLevel = ( id: NodeId ): number => {
            if ( levels.has( id ) ) return levels.get( id )!;
            const self = nodes.find( ( n ) => n.id === id );
            const p = self?.parentId ?? null;
            const lv = p == null ? 0 : getLevel( p ) + 1;
            levels.set( id, lv );
            return lv;
        };
        nodes.forEach( ( n ) => getLevel( n.id ) );
        return levels;
    },

    // ---- Hover drop target (sólo nodos; acciones/condiciones no cuentan) ----
    dragHoverParent: null,
    setDragHoverParent: ( id: NodeId | null ) => set( { dragHoverParent: id } ),

    /**
     * Mejor contenedor candidato que contiene el centro del hijo.
     * - No puede ser él mismo ni un descendiente suyo.
     * - Si hay varios, elige el de mayor nivel (más profundo).
     */
    getDropTargetFor: ( childId: NodeId ): NodeId | null => {
        const all = get().nodes;
        const child = all.find( ( n ) => n.id === childId );
        if ( !child ) return null;

        const cx = child.x;
        const cy = child.y;

        const isAncestor = ( anc: NodeId, ch: NodeId ): boolean => {
            let p = all.find( ( n ) => n.id === ch )?.parentId ?? null;
            while ( p != null ) {
                if ( p === anc ) return true;
                p = all.find( ( n ) => n.id === p )?.parentId ?? null;
            }
            return false;
        };

        const containsCenter = ( cand: NodeId ) => {
            if ( cand === childId ) return false;
            if ( isAncestor( childId, cand ) ) return false; // no meter un padre dentro de su hijo
            const c = all.find( ( n ) => n.id === cand )!;
            const sc = getNodeSizeCached( c );
            const tlx = c.x - sc.w / 2;
            const tly = c.y - sc.h / 2;
            return cx >= tlx && cx <= tlx + sc.w && cy >= tly && cy <= tly + sc.h;
        };

        const candidates = all.filter( ( n ) => containsCenter( n.id ) );
        if ( candidates.length === 0 ) return null;

        const levels = get().getLevelsMap();
        return candidates.reduce( ( best, n ) =>
            levels.get( n.id )! > levels.get( best.id )! ? n : best
        ).id;
    },
} satisfies Pick<
    AppState,
    | "setParent"
    | "relayoutContainer"
    | "relayoutAncestors"
    | "getLevelsMap"
    | "dragHoverParent"
    | "setDragHoverParent"
    | "getDropTargetFor"
> );
