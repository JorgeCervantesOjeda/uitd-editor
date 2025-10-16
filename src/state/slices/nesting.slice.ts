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
        if ( !container ) return;

        const children = s.nodes.filter( n => ( n.parentId ?? null ) === containerId );
        if ( children.length === 0 ) {
            const base = measureNodeSizeWithId(
                ( container.displayId ?? container.id ),
                container.title,
                container.wrap ?? 22,
                { bottomPad: 4, minH: 40 }
            );
            set( {
                nodes: s.nodes.map( n =>
                    n.id === containerId ? { ...n, w: base.w, h: base.h } : n
                ),
            } );
            return;
        }
                    
        const sizes = children.map( c => {
            const m = getNodeSizeCached( c );
            return { w: m.w, h: m.h };
        } );

        // Cabezal con "<id> título" en la misma línea
        // Cabezal compacto: "<id> título" + muy poco padding inferior
        const base = measureNodeSizeWithId( ( container.displayId ?? container.id ), container.title, container.wrap ?? 22, {
            bottomPad: 2,   // ↓ menos espacio bajo el título
            minH: 40        // evita mínimos altos en el cabezal
        } );

        // Layout de hijos en UNA FILA, justo debajo del cabezal
        const { container: inner, positions } = layoutChildrenSingleRow(
            { x: container.x, y: container.y + base.h }, // hijos debajo del cabezal
            sizes,
            {
                padX: CONTAINER_PAD_X,
                padY: 4,                 // ↓ MUY poco espacio entre cabezal e hijos
                gapX: CHILD_GAP_X,
                gapY: CHILD_GAP_Y,
                minW: MIN_W,
                minH: MIN_H
            }
        );

        // Tamaño total del contenedor = cabezal + hijos
        const newW = Math.max( base.w, inner.w );
        const newH = Math.max( base.h, base.h + inner.h );

        // Aplicar posiciones y tamaño
        const posById = new Map<number, { x: number; y: number }>();
        children.forEach( ( c, i ) => posById.set( c.id, positions[ i ] ) );

        set( {
            nodes: s.nodes.map( n => {
                if ( n.id === containerId ) return { ...n, w: newW, h: newH };
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
