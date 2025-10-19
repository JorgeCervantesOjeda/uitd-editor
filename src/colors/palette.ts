// src/colors/palette.ts

// ===== Constantes afinables =====
export const H_BASE_MIN = 6;
export const VARIETY_MARGIN = 0.30;
export const H_STEP = 2;

export const SAT_RANGE: [ number, number ] = [ 0.65, 0.82 ];
export const LIGHT_RANGE_LIGHT: [ number, number ] = [ 0.76, 0.88 ];
export const LIGHT_RANGE_DARK: [ number, number ] = [ 0.22, 0.32 ];

export const MIN_HUE_SEP_DEG = 12;
export const REQUIRE_DIFFERENT_TONE_TIER = true;
export const REQUIRE_DIFFERENT_VARIANT = true;

export const FORBID_RED_GREEN = true;
export const FORBID_RED_BLUE = false; // permitido por tu indicación
export const FORBID_COMPLEMENTARIES_HIGH_SAT = true;
export const COMPLEMENTARY_TOLERANCE_DEG = 15;
export const S_MIN_VIB = 0.75;
export const DELTA_L_MIN_VIB = 0.09;

export const FORBID_IDENTICAL_BG_BORDER = true;

export const TEXT_LUMINANCE_SWITCH = 0.5; // umbral simple
export const REQUIRE_WCAG_TEXT = true;   // opcional
export const WCAG_MIN_CONTRAST = 4.5;

export const MAX_RETRIES_PER_PAIR = 10;

// Rango de “hues” para familias aproximadas (grados)
export const HUE_RED: [ number, number ] = [ 345, 360 ]; // incluye wrap + [0,15]
export const HUE_RED_2: [ number, number ] = [ 0, 15 ];
export const HUE_GREEN: [ number, number ] = [ 100, 160 ];
export const HUE_BLUE: [ number, number ] = [ 200, 260 ];

// ===== Utilidades =====
export function clamp01( x: number ) { return Math.max( 0, Math.min( 1, x ) ); }
export function randBetween( a: number, b: number ) { return a + Math.random() * ( b - a ); }
export function pickIn<T>( arr: T[] ): T { return arr[ Math.floor( Math.random() * arr.length ) ]; }

export function angleDeltaDeg( a: number, b: number ) {
    const d = Math.abs( ( ( a - b ) + 540 ) % 360 - 180 );
    return d; // 0..180
}
export function nearComplementary( a: number, b: number, tolDeg: number ) {
    return Math.abs( angleDeltaDeg( a, ( b + 180 ) % 360 ) ) <= tolDeg;
}

function inRange( h: number, r: [ number, number ] ) {
    const [ a, b ] = r;
    if ( a <= b ) return h >= a && h <= b;
    return h >= a || h <= b; // wrap
}
export function isRed( h: number ) { return inRange( h, HUE_RED ) || inRange( h, HUE_RED_2 ); }
export function isGreen( h: number ) { return inRange( h, HUE_GREEN ); }
export function isBlue( h: number ) { return inRange( h, HUE_BLUE ); }

// HSL -> RGB (0..255)
export function hslToRgb( h: number, s: number, l: number ) {
    const c = ( 1 - Math.abs( 2 * l - 1 ) ) * s;
    const hp = ( h % 360 ) / 60;
    const x = c * ( 1 - Math.abs( ( hp % 2 ) - 1 ) );
    let [ r1, g1, b1 ] = [ 0, 0, 0 ];
    if ( hp >= 0 && hp < 1 ) [ r1, g1, b1 ] = [ c, x, 0 ];
    else if ( hp < 2 ) [ r1, g1, b1 ] = [ x, c, 0 ];
    else if ( hp < 3 ) [ r1, g1, b1 ] = [ 0, c, x ];
    else if ( hp < 4 ) [ r1, g1, b1 ] = [ 0, x, c ];
    else if ( hp < 5 ) [ r1, g1, b1 ] = [ x, 0, c ];
    else[ r1, g1, b1 ] = [ c, 0, x ];
    const m = l - c / 2;
    const r = Math.round( ( r1 + m ) * 255 );
    const g = Math.round( ( g1 + m ) * 255 );
    const b = Math.round( ( b1 + m ) * 255 );
    return { r, g, b };
}

// Rel. luminance (WCAG)
export function srgbToLinear( c: number ) {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow( ( cs + 0.055 ) / 1.055, 2.4 );
}
export function relativeLuminanceRGB( r: number, g: number, b: number ) {
    const R = srgbToLinear( r );
    const G = srgbToLinear( g );
    const B = srgbToLinear( b );
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
export function contrastRatio( L1: number, L2: number ) {
    const [ a, b ] = L1 >= L2 ? [ L1, L2 ] : [ L2, L1 ];
    return ( a + 0.05 ) / ( b + 0.05 );
}

export function hslToHex( h: number, s: number, l: number ) {
    const { r, g, b } = hslToRgb( h, s, l );
    const toHex = ( x: number ) => x.toString( 16 ).padStart( 2, "0" );
    return `#${toHex( r )}${toHex( g )}${toHex( b )}`;
}

export function pickTextHexForBg( h: number, s: number, l: number ) {
    const { r, g, b } = hslToRgb( h, s, l );
    const L = relativeLuminanceRGB( r, g, b );
    // simple: blanco/negro por luminancia
    const whiteContrast = contrastRatio( relativeLuminanceRGB( 255, 255, 255 ), L );
    const blackContrast = contrastRatio( relativeLuminanceRGB( 0, 0, 0 ), L );
    let hex = whiteContrast >= blackContrast ? "#ffffff" : "#000000";

    if ( REQUIRE_WCAG_TEXT ) {
        // empujar al de mejor contraste si el elegido no alcanza
        const chosenContrast = hex === "#ffffff" ? whiteContrast : blackContrast;
        if ( chosenContrast < WCAG_MIN_CONTRAST ) {
            hex = whiteContrast >= blackContrast ? "#ffffff" : "#000000";
        }
    }
    return hex;
}

export type ToneTier = "light" | "dark";
export type ToneVariant = 1 | 2;

export function makeHueList( H: number ) {
    const hues: number[] = [];
    for ( let i = 0; i < H; i++ ) hues.push( ( i * 360 ) / H );
    return hues;
}

export function sampleTone( tier: ToneTier ): { s: number; l: number; variant: ToneVariant } {
    const s = randBetween( SAT_RANGE[ 0 ], SAT_RANGE[ 1 ] );
    if ( tier === "light" ) {
        const v = Math.random() < 0.5 ? 1 : 2;
        const l = v === 1 ? randBetween( LIGHT_RANGE_LIGHT[ 0 ], ( LIGHT_RANGE_LIGHT[ 0 ] + LIGHT_RANGE_LIGHT[ 1 ] ) / 2 )
            : randBetween( ( LIGHT_RANGE_LIGHT[ 0 ] + LIGHT_RANGE_LIGHT[ 1 ] ) / 2, LIGHT_RANGE_LIGHT[ 1 ] );
        return { s, l, variant: v };
    } else {
        const v = Math.random() < 0.5 ? 1 : 2;
        const l = v === 1 ? randBetween( LIGHT_RANGE_DARK[ 0 ], ( LIGHT_RANGE_DARK[ 0 ] + LIGHT_RANGE_DARK[ 1 ] ) / 2 )
            : randBetween( ( LIGHT_RANGE_DARK[ 0 ] + LIGHT_RANGE_DARK[ 1 ] ) / 2, LIGHT_RANGE_DARK[ 1 ] );
        return { s, l, variant: v };
    }
}

export function forbidPair( bgH: number, bgS: number, bgL: number, bdH: number, bdS: number, bdL: number ) {
    if ( FORBID_IDENTICAL_BG_BORDER ) {
        if ( Math.abs( angleDeltaDeg( bgH, bdH ) ) < 0.0001 && Math.abs( bgS - bdS ) < 1e-6 && Math.abs( bgL - bdL ) < 1e-6 ) {
            return true;
        }
    }

    // Deben diferir en algo: hue o tier/variante; hue sep mínima (si no difieren en tier/variante)
    if ( angleDeltaDeg( bgH, bdH ) < MIN_HUE_SEP_DEG ) {
        // si tonos podrían ser mismos, exigir separación mínima de hue
        return true;
    }

    // Rojo–Verde prohibido (simétrico)
    if ( FORBID_RED_GREEN ) {
        const bgIsRG = ( isRed( bgH ) && isGreen( bdH ) ) || ( isGreen( bgH ) && isRed( bdH ) );
        if ( bgIsRG ) return true;
    }
    // Rojo–Azul opcional (por defecto permitido)
    if ( FORBID_RED_BLUE ) {
        const bgIsRB = ( isRed( bgH ) && isBlue( bdH ) ) || ( isBlue( bgH ) && isRed( bdH ) );
        if ( bgIsRB ) return true;
    }

    // Complementarios muy saturados y luminancia similar
    if ( FORBID_COMPLEMENTARIES_HIGH_SAT && bgS >= S_MIN_VIB && bdS >= S_MIN_VIB ) {
        if ( nearComplementary( bgH, bdH, COMPLEMENTARY_TOLERANCE_DEG ) && Math.abs( bgL - bdL ) < DELTA_L_MIN_VIB ) {
            return true;
        }
    }

    return false;
}
