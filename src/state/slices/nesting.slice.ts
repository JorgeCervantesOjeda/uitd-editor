import type { AppState, NodeId } from "../types";
import { getNodeSizeCached, layoutChildrenSingleRow, measureNodeSizeWithId } from "../../layout/measurement";
import {
    CONTAINER_PAD_X,
    CONTAINER_PAD_Y, // puedes dejarlo para otros usos
    CHILD_GAP_X, CHILD_GAP_Y,
    MIN_W, MIN_H,
    NODE_MIN_H, NODE_BOTTOM_PAD, NODE_WRAP_DEFAULT,
    CONTAINER_HEADER_GAP_Y,
    CONTAINER_CHILDREN_TOP_PAD,
    CONTAINER_CHILDREN_BOTTOM_PAD,
} from "../../model/types";


export const nestingSlice = ( set: any, get: () => AppState ) => ( {
    setParent: ( child: NodeId, parent: NodeId | null ) => {
        set( { nodes: get().nodes.map( n => n.id === child ? { ...n, parentId: parent ?? null } : n ) } );
    },

    relayoutContainer: ( containerId: NodeId ) => {
        const s = get();
        const container = s.nodes.find( n => n.id === containerId );
        if ( !container ) return;

        const children = s.nodes.filter( n => ( n.parentId ?? null ) === containerId );

        // Medición del CABEZAL compacto
        const base = measureNodeSizeWithId(
            ( container.displayId ?? container.id ),
            container.title,
            container.wrap ?? NODE_WRAP_DEFAULT,
            {
                bottomPad: NODE_BOTTOM_PAD, // respiración del header
                minH: NODE_MIN_H
            }
        );

        // ——— SIN HIJOS: tamaño = solo el cabezal ———
        if ( children.length === 0 ) {
            set( {
                nodes: s.nodes.map( n =>
                    n.id === containerId ? { ...n, w: base.w, h: base.h } : n
                ),
            } );
            return;
        }

        // ——— CON HIJOS ———
        const sizes = children.map( c => {
            const m = getNodeSizeCached( c );
            return { w: m.w, h: m.h };
        } );

        // 1) Calcula layout relativo (independiente del top-left real)
        const { container: inner, positions: relPositions } = layoutChildrenSingleRow(
            { x: 0, y: 0 }, // dummy; solo queremos tamaños y posiciones relativas
            sizes,
            {
                padX: CONTAINER_PAD_X,
                padTopY: CONTAINER_CHILDREN_TOP_PAD,
                padBottomY: CONTAINER_CHILDREN_BOTTOM_PAD,
                gapX: CHILD_GAP_X,
                gapY: CHILD_GAP_Y,
                minW: MIN_W,
                minH: MIN_H
            }
        );

        // 2) Tamaño final del contenedor (centro se mantiene)
        const newW = Math.max( base.w, inner.w );
        const newH = base.h + CONTAINER_HEADER_GAP_Y + inner.h;

        // 3) Top-left real del contenedor, a partir del centro (coords mundo)
        const TLx = container.x - newW / 2;
        const TLy = container.y - newH / 2;

        // 4) Offset real para las posiciones de hijos (top-left de la zona de hijos)
        const ox = TLx;
        const oy = TLy + base.h + CONTAINER_HEADER_GAP_Y;

        // 5) Mapear posiciones relativas → absolutas (top-left) y luego a CENTRO
        const posById = new Map<number, { x: number; y: number }>();
        children.forEach( ( c, i ) => {
            const p = relPositions[ i ];
            const w = sizes[ i ].w, h = sizes[ i ].h;
            posById.set( c.id, { x: ox + p.x + w / 2, y: oy + p.y + h / 2 } );
        } );

        set( {
            nodes: s.nodes.map( n => {
                if ( n.id === containerId ) return { ...n, w: newW, h: newH }; // mantiene centro
                const p = posById.get( n.id );
                return p ? { ...n, x: p.x, y: p.y } : n;
            } ),
        } );
    },

    relayoutAncestors: ( nodeId: NodeId ) => {
        const nodes = get().nodes;
        const parentOf = ( id: NodeId ) => nodes.find( n => n.id === id )?.parentId ?? null;
        let p = parentOf( nodeId );
        while ( p != null ) { get().relayoutContainer( p ); p = parentOf( p ); }
    },

    getLevelsMap: () => {
        const { nodes } = get();
        const levels = new Map<NodeId, number>();
        const getLevel = ( id: NodeId ): number => {
            if ( levels.has( id ) ) return levels.get( id )!;
            const self = nodes.find( n => n.id === id );
            const p = self?.parentId ?? null;
            const lv = p == null ? 0 : getLevel( p ) + 1;
            levels.set( id, lv );
            return lv;
        };
        nodes.forEach( n => getLevel( n.id ) );
        return levels;
    },

    // Hover drop target y helpers existentes…
    dragHoverParent: null,
    setDragHoverParent: ( id: NodeId | null ) => set( { dragHoverParent: id } ),

    getDropTargetFor: ( childId: NodeId ): NodeId | null => {
        const all = get().nodes;
        const child = all.find( n => n.id === childId );
        if ( !child ) return null;

        // Centros reales (ya no top-left)
        const cx = child.x;
        const cy = child.y;

        const isAncestor = ( anc: NodeId, ch: NodeId ): boolean => {
            let p = all.find( n => n.id === ch )?.parentId ?? null;
            while ( p != null ) { if ( p === anc ) return true; p = all.find( n => n.id === p )?.parentId ?? null; }
            return false;
        };

        const containsCenter = ( cand: NodeId ) => {
            if ( cand === childId ) return false;
            if ( isAncestor( childId, cand ) ) return false;
            const c = all.find( n => n.id === cand )!;
            const sc = getNodeSizeCached( c );
            // c.x, c.y son CENTRO → compara contra su bbox convertida a top-left
            const tlx = c.x - sc.w / 2;
            const tly = c.y - sc.h / 2;
            return ( cx >= tlx && cx <= tlx + sc.w && cy >= tly && cy <= tly + sc.h );
        };

        const candidates = all.filter( n => containsCenter( n.id ) );
        if ( candidates.length === 0 ) return null;

        const levels = get().getLevelsMap();
        return candidates.reduce( ( best, n ) =>
            ( levels.get( n.id )! > ( levels.get( best.id )! ) ) ? n : best
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
