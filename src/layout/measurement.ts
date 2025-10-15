// src/layout/measurement.ts
// Medición aproximada de texto y cálculo de tamaños para:
// - Nodos (rectángulos con título + fila "id")
// - Etiquetas en óvalo (acciones y condiciones)
//
// Nota: El wrap es por CONTEO DE CARACTERES (no por pixeles) y se hace por palabras.
// El ancho se estima con un ancho promedio por carácter (TITLE_CHAR_W).
// Esto mantiene el costo de cálculo bajo y suficiente para el editor interactivo.

import {
    PAD_X,
    PAD_Y,
    TITLE_LINE_H,
    TITLE_CHAR_W,
    ID_LINE_H,
    MIN_W,
    MIN_H,
    ACTION_MIN_W,
    ACTION_MIN_H,
    CONDITION_MIN_W,
    CONDITION_MIN_H,
} from "../model/types";

// ---------- Utilidades de wrap y ancho ----------

/**
 * Corta un texto en líneas por palabras, respetando un máximo de caracteres por renglón.
 * El wrap es "duro" a nivel de palabras: no se parte una palabra a la mitad.
 */
export function wrapByChars( text: string, maxChars: number ): string[] {
    const hard = Math.max( 1, Math.floor( maxChars || 1 ) );
    const words = ( text ?? "" ).split( /\s+/ ).filter( Boolean );
    if ( words.length === 0 ) return [ "" ];

    const lines: string[] = [];
    let current = "";

    for ( const w of words ) {
        if ( current.length === 0 ) {
            current = w;
            continue;
        }
        if ( current.length + 1 + w.length <= hard ) {
            current += " " + w;
        } else {
            lines.push( current );
            current = w;
        }
    }
    if ( current.length > 0 ) lines.push( current );
    return lines.length > 0 ? lines : [ "" ];
}

/**
 * Estima el ancho en píxeles a partir de la longitud de la línea
 * usando un ancho promedio de carácter (TITLE_CHAR_W).
 */
function linePxWidth( line: string ): number {
    return Math.max( 0, ( line?.length ?? 0 ) * TITLE_CHAR_W );
}

/**
 * Devuelve el ancho mínimo que satisface el contenido (por líneas)
 * más padding horizontal (2 * PAD_X).
 */
function contentWidthWithPadding( lines: string[] ): number {
    const inner = Math.max( 0, ...lines.map( linePxWidth ) );
    return inner + 2 * PAD_X;
}

// ---------- Medición de Nodo (rectángulo) ----------

export function measureNodeSize( title: string, wrap: number = 22 ): {
    w: number;
    h: number;
    lines: string[];
} {
    const lines = wrapByChars( title ?? "", wrap );

    // Ancho mínimo por contenido y padding
    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( MIN_W, Math.ceil( wContent ) );

    // Alto = padding superior + líneas de título + fila "id" + padding inferior
    const titleHeight = lines.length * TITLE_LINE_H;
    const hContent = PAD_Y + titleHeight + ID_LINE_H + PAD_Y;
    const h = Math.max( MIN_H, Math.ceil( hContent ) );

    return { w, h, lines };
}

// ---------- Medición de Óvalo (acciones / condiciones) ----------

/**
 * Medición de un óvalo de texto (acciones/condiciones).
 * Para condiciones reutilizamos la misma función (mismo estilo de óvalo).
 */
export function measureActionOval( title: string, wrap: number = 22 ): {
    w: number;
    h: number;
    lines: string[];
} {
    const lines = wrapByChars( title ?? "", wrap );

    // Ancho por contenido + padding; mínimos del óvalo de acción
    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( ACTION_MIN_W, Math.ceil( wContent ) );

    // Alto = padding superior + líneas + padding inferior; mínimo del óvalo
    const titleHeight = lines.length * TITLE_LINE_H;
    const hContent = PAD_Y + titleHeight + PAD_Y;
    const h = Math.max( ACTION_MIN_H, Math.ceil( hContent ) );

    return { w, h, lines };
}

/**
 * Medición específica para condición (si se desea distinguir mínimos).
 * Por ahora, usa mínimos de condición pero mismo cálculo de óvalo.
 */
export function measureConditionOval( title: string, wrap: number = 22 ): {
    w: number;
    h: number;
    lines: string[];
} {
    const lines = wrapByChars( title ?? "", wrap );

    const wContent = contentWidthWithPadding( lines );
    const w = Math.max( CONDITION_MIN_W, Math.ceil( wContent ) );

    const titleHeight = lines.length * TITLE_LINE_H;
    const hContent = PAD_Y + titleHeight + PAD_Y;
    const h = Math.max( CONDITION_MIN_H, Math.ceil( hContent ) );

    return { w, h, lines };
}
  