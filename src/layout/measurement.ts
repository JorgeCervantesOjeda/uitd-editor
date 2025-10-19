// Medición aproximada de texto y cálculo de tamaños para:
// - Nodos (rectángulos con título + fila "id")
// - Etiquetas en óvalo (acciones y condiciones)
//
// Nota: El wrap es por CONTEO DE CARACTERES (no por pixeles) y se hace por palabras.

import {
    PAD_X, PAD_Y, TITLE_LINE_H, TITLE_CHAR_W, ID_LINE_H,
    MIN_W, MIN_H, ACTION_MIN_W, ACTION_MIN_H, CONDITION_MIN_W, CONDITION_MIN_H,
    // ⬇⬇⬇ importa las nuevas
    NODE_WRAP_DEFAULT, NODE_MIN_H, NODE_BOTTOM_PAD,
} from "../model/types";
import type { NodeBox } from "../model/types";

// ---------- Utilidades de wrap y ancho ----------

export function wrapByChars( text: string, maxChars: number ): string[] {
    const hard = Math.max( 1, Math.floor( maxChars || 1 ) );
    const words = ( text ?? "" ).split( /\s+/ ).filter( Boolean );
    if ( words.length === 0 ) return [ "" ];
    const lines: string[] = [];
    let current = "";
    for ( const w of words ) {
        if ( current.length === 0 ) { current = w; continue; }
        if ( current.length + 1 + w.length <= hard ) current += " " + w;
        else { lines.push( current ); current = w; }
    }
    if ( current.length > 0 ) lines.push( current );
    return lines.length > 0 ? lines : [ "" ];
}

function linePxWidth( line: string ): number {
    return Math.max( 0, ( line?.length ?? 0 ) * TITLE_CHAR_W );
}

function contentWidthWithPadding( lines: string[] ): number {
    const inner = Math.max( 0, ...lines.map( linePxWidth ) );
    return inner + 2 * PAD_X;
}

// ---------- Medición de Nodo (rectángulo) ----------

export function measureNodeSize( title: string, wrap: number = 22 ): {
    w: number; h: number; lines: string[];
} {
    const lines = wrapByChars( title ?? "", wrap );
    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( MIN_W, Math.ceil( wContent ) );
    const titleHeight = lines.length * TITLE_LINE_H;
    const hContent = PAD_Y + titleHeight + ID_LINE_H + PAD_Y;
    const h = Math.max( MIN_H, Math.ceil( hContent ) );
    return { w, h, lines };
}

// ---------- Medición de Óvalo (acciones / condiciones) ----------

export function measureActionOval( title: string, wrap: number = 22 ): {
    w: number; h: number; lines: string[];
} {
    const lines = wrapByChars( title ?? "", wrap );
    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( ACTION_MIN_W, Math.ceil( wContent ) );
    const titleHeight = lines.length * TITLE_LINE_H;
    const hContent = PAD_Y + titleHeight + PAD_Y;
    const h = Math.max( ACTION_MIN_H, Math.ceil( hContent ) );
    return { w, h, lines };
}

export function measureConditionOval( title: string, wrap: number = 22 ): {
    w: number; h: number; lines: string[];
} {
    const lines = wrapByChars( title ?? "", wrap );
    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( CONDITION_MIN_W, Math.ceil( wContent ) );
    const titleHeight = lines.length * TITLE_LINE_H;
    const hContent = PAD_Y + titleHeight + PAD_Y;
    const h = Math.max( CONDITION_MIN_H, Math.ceil( hContent ) );
    return { w, h, lines };
}

// ---------- Helpers de tamaño cacheado (nodos) ----------

/** Medición de nodo donde el primer renglón inicia con "<id> " seguido del título. */
// Medición de nodo con "<id> título" en la misma línea (compactable)
export function measureNodeSizeWithId(
    idText: string | number,
    title: string,
    wrap: number = 22,
    opts?: { bottomPad?: number; minH?: number }
): { w: number; h: number; lines: string[] } {
    const text = `${idText} ${title ?? ""}`.trim();
    const lines = wrapByChars( text, wrap );
    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( MIN_W, Math.ceil( wContent ) );

    const titleHeight = lines.length * TITLE_LINE_H;
    const bottom = opts?.bottomPad ?? 4;
    const minH = opts?.minH ?? MIN_H;

    const hContent = PAD_Y + titleHeight + bottom;
    const h = Math.max( minH, Math.ceil( hContent ) );
    return { w, h, lines };
}


export function getNodeSizeCached( n: NodeBox ): { w: number; h: number; lines: string[] } {
    const wrap = n.wrap ?? NODE_WRAP_DEFAULT;
    const idHeader = ( n.displayId ?? n.id );
    // ⬇ Consistencia con creación: mismo minH y bottomPad
    const m = measureNodeSizeWithId( idHeader, n.title ?? "", wrap, {
        bottomPad: NODE_BOTTOM_PAD,
        minH: NODE_MIN_H,
    } );
    if ( n.id === 2 /* DEBUG */ ) {
        const wrap = n.wrap ?? 22;
        const idHeader = ( n.displayId ?? n.id );
        const m = measureNodeSizeWithId( idHeader, n.title ?? "", wrap, { bottomPad: 4, minH: 40 } ); // usa tus constantes si ya las centralizaste
        console.debug( "[MS] container measure", { id: n.id, text: `${idHeader} ${n.title ?? ""}`.trim(), lines: m.lines, w: m.w, h: m.h } );
    }

    if ( typeof n.w === "number" && typeof n.h === "number" ) {
        return { w: n.w, h: n.h, lines: m.lines };
    }
    return { w: m.w, h: m.h, lines: m.lines };
}
    
// ---------- Packing por filas con área mínima ----------

export type Size = { w: number; h: number };

export function packRowsMinArea(
    childSizes: Size[],
    opts: { padX: number; padY: number; gapX: number; gapY: number; minW?: number; minH?: number }
): { w: number; h: number; rows: { indices: number[]; rowW: number; rowH: number }[] } {
    const { padX, padY, gapX, gapY, minW = MIN_W, minH = MIN_H } = opts;
    const N = childSizes.length;
    if ( N === 0 ) return { w: Math.max( minW, 2 * padX ), h: Math.max( minH, 2 * padY ), rows: [] };

    let bestArea = Number.POSITIVE_INFINITY;
    let best: any = null;

    for ( let R = 1; R <= N; R++ ) {
        const rows = Array.from( { length: R }, () => ( { indices: [] as number[], rowW: 0, rowH: 0 } ) );
        for ( let i = 0; i < N; i++ ) {
            // asignar al menor alto de fila
            let rBest = 0;
            for ( let r = 1; r < R; r++ ) if ( rows[ r ].rowH < rows[ rBest ].rowH ) rBest = r;
            const s = childSizes[ i ];
            const row = rows[ rBest ];
            row.indices.push( i );
            row.rowW += ( row.indices.length > 1 ? gapX : 0 ) + s.w;
            row.rowH = Math.max( row.rowH, s.h );
        }
        const totalW = rows.reduce( ( m, r ) => Math.max( m, r.rowW ), 0 );
        const totalH = rows.reduce( ( a, r, i ) => a + r.rowH + ( i ? gapY : 0 ), 0 );
        const w = Math.max( minW, 2 * padX + totalW );
        const h = Math.max( minH, 2 * padY + totalH );
        const area = w * h;
        if ( area < bestArea ) { bestArea = area; best = { w, h, rows }; }
    }
    return best;
}

export function layoutChildrenGrid(
    topLeft: { x: number; y: number },
    childSizes: Size[],
    opts: { padX: number; padY: number; gapX: number; gapY: number; minW?: number; minH?: number }
): { container: Size; positions: { x: number; y: number }[] } {
    const packed = packRowsMinArea( childSizes, opts );
    const { padX, padY, gapX, gapY } = opts;
    const positions = childSizes.map( () => ( { x: 0, y: 0 } ) );
    let y = topLeft.y + padY;
    for ( const row of packed.rows ) {
        let x = topLeft.x + padX;
        for ( const i of row.indices ) { positions[ i ] = { x, y }; x += childSizes[ i ].w + gapX; }
        y += row.rowH + gapY;
    }
    return { container: { w: packed.w, h: packed.h }, positions };
}

export function layoutChildrenSingleRow(
    topLeft: { x: number; y: number },
    childSizes: Size[],
    opts: { padX: number; padY: number; gapX: number; gapY: number; minW?: number; minH?: number }
): { container: Size; positions: { x: number; y: number }[] } {
    const { padX, padY, gapX, minW = MIN_W, minH = MIN_H } = opts;
    if ( childSizes.length === 0 ) {
        return { container: { w: Math.max( minW, 2 * padX ), h: Math.max( minH, 2 * padY ) }, positions: [] };
    }
    const totalW = childSizes.reduce( ( acc, s, i ) => acc + s.w + ( i ? gapX : 0 ), 0 );
    const maxH = Math.max( ...childSizes.map( s => s.h ) );
    const w = Math.max( minW, 2 * padX + totalW );
    const h = Math.max( minH, 2 * padY + maxH );

    const positions: { x: number; y: number }[] = [];
    let x = topLeft.x + padX;
    const y = topLeft.y + padY;
    for ( const s of childSizes ) { positions.push( { x, y } ); x += s.w + gapX; }
    return { container: { w, h }, positions };
}
