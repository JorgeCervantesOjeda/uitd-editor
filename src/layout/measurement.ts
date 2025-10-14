import {
    PAD_X, PAD_Y, TITLE_LINE_H, TITLE_CHAR_W,
    ID_LINE_H, MIN_W, MIN_H,
    ACTION_MIN_W, ACTION_MIN_H
} from "../model/types";

// Wrap por palabras (simple, basado en número de caracteres)
export function wrapByWords( text: string, maxChars: number ): string[] {
    const words = text.split( /\s+/ ).filter( Boolean );
    const lines: string[] = [];
    let cur = "";
    for ( const w of words ) {
        if ( !cur ) cur = w;
        else if ( ( cur + " " + w ).length <= maxChars ) cur = cur + " " + w;
        else { lines.push( cur ); cur = w; }
    }
    if ( cur || lines.length === 0 ) lines.push( cur );
    return lines;
}

// Tamaño de nodo rectangular a partir del título envuelto
export function measureNodeSize( title: string, wrapChars = 22 ) {
    const lines = wrapByWords( title, wrapChars );
    const maxLen = Math.max( ...lines.map( ( l ) => l.length ), 1 );

    const contentW = TITLE_CHAR_W * maxLen;
    const w = Math.max( MIN_W, Math.ceil( contentW + PAD_X * 2 ) );

    const contentH = TITLE_LINE_H * lines.length + ID_LINE_H;
    const h = Math.max( MIN_H, Math.ceil( contentH + PAD_Y * 2 ) );

    return { w, h, lines };
}

// Tamaño de óvalo (acción) a partir del título envuelto
export function measureActionOval( title: string, wrapChars = 22 ) {
    const lines = wrapByWords( title, wrapChars );
    const maxLen = Math.max( ...lines.map( ( l ) => l.length ), 1 );

    const contentW = TITLE_CHAR_W * maxLen;
    const w = Math.max( ACTION_MIN_W, Math.ceil( contentW + PAD_X * 2 ) );

    // Para acciones, solo texto de la etiqueta; sin línea de id
    const contentH = TITLE_LINE_H * lines.length;
    const h = Math.max( ACTION_MIN_H, Math.ceil( contentH + PAD_Y * 2 ) );

    return { w, h, lines };
}
  