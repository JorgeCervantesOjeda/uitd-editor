// src/components/Canvas/visibleCanvasPan.ts
// Bounds camera movement using currently visible fragment rectangles and continuous visibility.
import { CANVAS_FRAGMENT_FRAME_SELECTOR } from "./canvasFragmentGeometry";

type Rect = { left: number; top: number; right: number; bottom: number };
type Delta = { x: number; y: number };

function hasIntersection( first: Rect, second: Rect ): boolean {
    return first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top;
}

export function constrainVisiblePan( viewport: Rect, elements: Rect[], dx: number, dy: number ): Delta {
    if ( elements.length === 0 ) return { x: dx, y: dy };
    const visible = elements.filter( element => hasIntersection( viewport, element ) );
    if ( visible.length === 0 ) return { x: 0, y: 0 };

    const width = viewport.right - viewport.left;
    const height = viewport.bottom - viewport.top;
    const left = Math.min( ...visible.map( element => element.left ) );
    const right = Math.max( ...visible.map( element => element.right ) );
    const top = Math.min( ...visible.map( element => element.top ) );
    const bottom = Math.max( ...visible.map( element => element.bottom ) );
    // Small diagrams necessarily leave more than a third empty already.
    // Keep their center in the middle third instead of immobilizing them.
    const horizontalMargin = right - left < width / 3 ? width * 2 / 3 - ( right - left ) / 2 : width / 3;
    const verticalMargin = bottom - top < height / 3 ? height * 2 / 3 - ( bottom - top ) / 2 : height / 3;
    // Hitting one axis limit must still allow sliding along the other axis.
    const boundedDx = dx > 0
        ? Math.min( dx, Math.max( 0, viewport.left + horizontalMargin - left ) )
        : Math.max( dx, -Math.max( 0, right - viewport.right + horizontalMargin ) );
    const boundedDy = dy > 0
        ? Math.min( dy, Math.max( 0, viewport.top + verticalMargin - top ) )
        : Math.max( dy, -Math.max( 0, bottom - viewport.bottom + verticalMargin ) );
    let fraction = 1;

    // Intervals of movement during which each element intersects the viewport.
    // Only the connected interval starting at zero is traversable: a large
    // pointer/scrollbar jump must not skip a blank region between elements.
    const intervals = elements.map( element => {
        let start = 0;
        let end = fraction;
        for ( const [ delta, low, high, min, max ] of [
            [ boundedDx, element.left, element.right, viewport.left, viewport.right ],
            [ boundedDy, element.top, element.bottom, viewport.top, viewport.bottom ],
        ] ) {
            if ( delta === 0 ) {
                if ( high <= min || low >= max ) end = -1;
            } else {
                const first = ( min - high ) / delta;
                const second = ( max - low ) / delta;
                start = Math.max( start, Math.min( first, second ) );
                end = Math.min( end, Math.max( first, second ) );
            }
        }
        return { start, end };
    } ).filter( interval => interval.end > interval.start ).sort( ( a, b ) => a.start - b.start );

    let reachable = 0;
    for ( const interval of intervals ) {
        if ( interval.start > reachable || ( reachable > 0 && interval.start === reachable ) ) break;
        reachable = Math.max( reachable, interval.end );
    }
    if ( reachable < fraction ) fraction = Math.max( 0, reachable - 0.01 / Math.max( Math.abs( boundedDx ), Math.abs( boundedDy ), 1 ) );
    return { x: boundedDx * fraction, y: boundedDy * fraction };
}

export function constrainCanvasPan( svg: SVGSVGElement, dx: number, dy: number ): Delta {
    const matrix = svg.getScreenCTM();
    if ( !matrix ) {
        console.warn( "[Canvas pan] Screen transform unavailable; movement blocked to retain visible content." );
        return { x: 0, y: 0 };
    }
    const viewport = svg.getBoundingClientRect();
    const toolbar = svg.closest( ".canvas" )?.querySelector( ".topToolbar" )?.getBoundingClientRect();
    const visibleViewport = {
        left: viewport.left,
        right: viewport.right,
        top: Math.max( viewport.top, toolbar?.bottom ?? viewport.top ),
        bottom: viewport.bottom,
    };
    const frames = Array.from( svg.querySelectorAll<SVGRectElement>( CANVAS_FRAGMENT_FRAME_SELECTOR ) )
        .map( frame => frame.getBoundingClientRect() )
        .filter( rect => rect.width > 0 && rect.height > 0 );
    const screenDelta = constrainVisiblePan( visibleViewport, frames,
        matrix.a * dx + matrix.c * dy, matrix.b * dx + matrix.d * dy );
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if ( !Number.isFinite( determinant ) || determinant === 0 ) {
        console.warn( "[Canvas pan] Invalid screen transform; movement blocked to retain visible content." );
        return { x: 0, y: 0 };
    }
    return {
        x: ( matrix.d * screenDelta.x - matrix.c * screenDelta.y ) / determinant,
        y: ( matrix.a * screenDelta.y - matrix.b * screenDelta.x ) / determinant,
    };
}
