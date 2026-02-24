import type { NodeBox, ActionLabel, ConditionLabel } from "../../model/types";
import { getNodeSizeCached, measureActionOval, measureConditionOval } from "../../layout/measurement";

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function expandBounds( b: Bounds, x: number, y: number ) {
    if ( x < b.minX ) b.minX = x;
    if ( y < b.minY ) b.minY = y;
    if ( x > b.maxX ) b.maxX = x;
    if ( y > b.maxY ) b.maxY = y;
}

function expandRect( b: Bounds, x: number, y: number, w: number, h: number, stroke = 0, innerPad = 0 ) {
    const half = stroke / 2 + innerPad;
    expandBounds( b, x - half, y - half );
    expandBounds( b, x + w + half, y + h + half );
}

function buildTopAncestorIndex( nodes: NodeBox[] ): Map<number, number> {
    const byId = new Map( nodes.map( n => [ n.id, n ] ) );
    const top = new Map<number, number>();

    const findTop = ( id: number ): number => {
        let cur = id;
        const seen = new Set<number>();
        while ( true ) {
            if ( seen.has( cur ) ) break;
            seen.add( cur );
            const parentId = byId.get( cur )?.parentId ?? null;
            if ( parentId == null ) break;
            cur = parentId;
        }
        return cur;
    };

    for ( const n of nodes ) top.set( n.id, findTop( n.id ) );
    return top;
}

function selectedRoots( nodes: NodeBox[], selNodes: Set<number> ): Set<number> {
    if ( !selNodes || selNodes.size === 0 ) return new Set<number>();
    const topIndex = buildTopAncestorIndex( nodes );
    const roots = new Set<number>();
    for ( const id of selNodes ) {
        const r = topIndex.get( id );
        if ( r != null ) roots.add( r );
    }
    return roots;
}

/**
 * Calcula el bbox de:
 *  - Raíces (derivadas de nodos seleccionados), tomando x,y como CENTRO del nodo
 *  - Acciones seleccionadas (óvalo centrado)
 *  - Condiciones seleccionadas (óvalo centrado)
 * NO crece por aristas.
 */
export function computeSelectedBBox(
    nodes: NodeBox[],
    actions: ActionLabel[],
    conds: ConditionLabel[],
    selNodes: Set<number>,
    selActions: Set<number>,
    selConds: Set<number>,
): Bounds | null {
    const rootIds = selectedRoots( nodes, selNodes );
    const hasSomething =
        rootIds.size > 0 || ( selActions?.size ?? 0 ) > 0 || ( selConds?.size ?? 0 ) > 0;
    if ( !hasSomething ) return null;

    const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    // ✅ Igualamos con lo que pintas en pantalla (strokeWidth=4 en nodos/óvalos)
    const NODE_STROKE = 4, NODE_INNER_PAD = 1;
    const ACTION_STROKE = 4, ACTION_INNER_PAD = 1;
    const COND_STROKE = 4, COND_INNER_PAD = 1;

    // 1) Raíces (nodos con x,y en CENTRO)
    if ( rootIds.size > 0 ) {
        const rootSet = new Set( rootIds );
        for ( const n of nodes ) {
            if ( !rootSet.has( n.id ) ) continue;
            const s = getNodeSizeCached( n ); // mide W,H del rect
            const left = n.x - s.w / 2;
            const top = n.y - s.h / 2;
            expandRect( b, left, top, s.w, s.h, NODE_STROKE, NODE_INNER_PAD );
        }
    }

    // 2) Acciones
    if ( selActions && selActions.size > 0 ) {
        for ( const a of actions ) {
            if ( !selActions.has( a.id ) ) continue;
            const m = measureActionOval( a.title, a.wrap ?? 22 );
            const rx = m.w / 2, ry = m.h / 2;
            const half = ACTION_STROKE / 2 + ACTION_INNER_PAD;
            expandBounds( b, a.x - rx - half, a.y - ry - half );
            expandBounds( b, a.x + rx + half, a.y + ry + half );
        }
    }

    // 3) Condiciones
    if ( selConds && selConds.size > 0 ) {
        for ( const c of conds ) {
            if ( !selConds.has( c.id ) ) continue;
            const m = measureConditionOval( c.title, c.wrap ?? 22 );
            const rx = m.w / 2, ry = m.h / 2;
            const half = COND_STROKE / 2 + COND_INNER_PAD;
            expandBounds( b, c.x - rx - half, c.y - ry - half );
            expandBounds( b, c.x + rx + half, c.y + ry + half );
        }
    }

    if ( !isFinite( b.minX ) || !isFinite( b.minY ) || !isFinite( b.maxX ) || !isFinite( b.maxY ) ) return null;
    return b;
}

/** Convierte Bounds + margen al rect del overlay/export. */
export function boundsToRectWithMargin( b: Bounds, margin: number ) {
    return {
        x: b.minX - margin,
        y: b.minY - margin,
        w: ( b.maxX - b.minX ) + 2 * margin,
        h: ( b.maxY - b.minY ) + 2 * margin,
    };
}
