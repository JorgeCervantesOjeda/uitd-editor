// src/debug/markDraw.ts
let __drawSeq = 0;

export function markDraw( tag: string, extra?: Record<string, unknown> ) {
    const n = ++__drawSeq;
    if ( extra ) {
        console.log( `[DRAW ${String( n ).padStart( 4, "0" )}] ${tag}`, extra );
    } else {
        console.log( `[DRAW ${String( n ).padStart( 4, "0" )}] ${tag}` );
    }
    return n;
}

export function resetDrawSeq() {
    __drawSeq = 0;
}

// Para agrupar logs de un render/commit en consola
export function group( tag: string ) {
    console.groupCollapsed( `▼ ${tag}` );
    return () => console.groupEnd();
}
