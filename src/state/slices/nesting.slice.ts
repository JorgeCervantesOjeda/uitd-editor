import type { AppState, NodeId } from "../types";
import { getNodeSizeCached, layoutChildrenSingleRow, measureNodeSizeWithId } from "../../layout/measurement";
import { CONTAINER_PAD_X, CHILD_GAP_X, CHILD_GAP_Y, MIN_W, MIN_H } from "../../model/types";

export const nestingSlice = ( set: any, get: () => AppState ) =>
( {
    setParent: ( child: NodeId, parent: NodeId | null ) => {
        set( { nodes: get().nodes.map( n => n.id === child ? { ...n, parentId: parent ?? null } : n ) } );
    },

    relayoutContainer: ( containerId: NodeId ) => {
        const s = get();
        const container = s.nodes.find( n => n.id === containerId );
        if ( !container ) {
            console.debug( "[RC] container", containerId, "NO_ENCONTRADO" );
            return;
        }

        // DEBUG: estado del contenedor ANTES
        console.debug( "[RC] container", containerId, {
            title: container.title, displayId: container.displayId, x: container.x, y: container.y,
            w: container.w, h: container.h
        } );

        const children = s.nodes.filter( n => ( n.parentId ?? null ) === containerId );
        console.debug( "[RC] childrenIDs", containerId, children.map( c => c.id ) );

        if ( children.length === 0 ) {
            console.debug( "[RC] NO_CHILDREN → solo cabezal", containerId );
            const base = measureNodeSizeWithId(
                ( container.displayId ?? container.id ),
                container.title,
                container.wrap ?? 22,
                { bottomPad: 4, minH: 40 }
            );
            console.debug( "[RC] base(h, w)", { h: base.h, w: base.w, lines: base.lines } );

            set( {
                nodes: s.nodes.map( n =>
                    n.id === containerId ? { ...n, w: base.w, h: base.h } : n
                ),
            } );
            return;
        }

        // DEBUG: tamaños de hijos usados para layout
        const sizes = children.map( c => {
            const m = getNodeSizeCached( c );
            console.debug( "[RC] childSize", { id: c.id, w: m.w, h: m.h, title: c.title, displayId: c.displayId } );
            return { w: m.w, h: m.h };
        } );

        const base = measureNodeSizeWithId(
            ( container.displayId ?? container.id ),
            container.title,
            container.wrap ?? 22,
            { bottomPad: 2, minH: 40 }
        );
        console.debug( "[RC] base(h, w, lines)", { h: base.h, w: base.w, lines: base.lines } );

        const { container: inner, positions } = layoutChildrenSingleRow(
            { x: container.x, y: container.y + base.h },
            sizes,
            {
                padX: CONTAINER_PAD_X,
                padY: 4,
                gapX: CHILD_GAP_X,
                gapY: CHILD_GAP_Y,
                minW: MIN_W,
                minH: MIN_H
            }
        );

        const newW = Math.max( base.w, inner.w );
        const newH = Math.max( base.h, base.h + inner.h );
        console.debug( "[RC] inner(h, w)", inner, "→ newWH", { newW, newH } );

        const posById = new Map<number, { x: number; y: number }>();
        children.forEach( ( c, i ) => posById.set( c.id, positions[ i ] ) );

        set( {
            nodes: s.nodes.map( n => {
                if ( n.id === containerId ) return { ...n, w: newW, h: newH };
                const p = posById.get( n.id );
                return p ? { ...n, x: p.x, y: p.y } : n;
            } ),
        } );

        // DEBUG: estado del contenedor DESPUÉS
        const after = get().nodes.find( n => n.id === containerId )!;
        console.debug( "[RC] AFTER container", containerId, { w: after.w, h: after.h } );
    },
      
    relayoutAncestors: ( nodeId: NodeId ) => {
        const hasChildrenNow = get().nodes.some( n => ( n.parentId ?? null ) === nodeId );
        if ( hasChildrenNow ) get().relayoutContainer( nodeId );

        const parentOf = ( id: NodeId ): NodeId | null => {
            const nodesNow = get().nodes;
            return nodesNow.find( n => n.id === id )?.parentId ?? null;
        };
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

    // Hover de drop target en caliente
    dragHoverParent: null,
    setDragHoverParent: ( id: NodeId | null ) => set( { dragHoverParent: id } ),

    getDropTargetFor: ( childId: NodeId ): NodeId | null => {
        const all = get().nodes;
        const child = all.find( n => n.id === childId );
        if ( !child ) return null;

        const sizeChild = getNodeSizeCached( child );
        const cx = child.x + sizeChild.w / 2;
        const cy = child.y + sizeChild.h / 2;

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
            return cx >= c.x && cx <= c.x + sc.w && cy >= c.y && cy <= c.y + sc.h;
        };

        const candidates = all.filter( n => containsCenter( n.id ) );
        if ( candidates.length === 0 ) return null;

        const levels = get().getLevelsMap();
        return candidates.reduce( ( best, n ) =>
            ( levels.get( n.id )! > ( levels.get( best.id )! ) ) ? n : best
        ).id;
    },
} satisfies Partial<AppState> );
