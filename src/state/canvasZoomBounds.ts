// src/state/canvasZoomBounds.ts
// Computes the zoom floor and camera offsets that leave at most one third empty per viewport edge.

type Rect = { x: number; y: number; width: number; height: number };
type Camera = { x: number; y: number; zoom: number };

export type CanvasZoomBounds = { geometry: Rect; viewport: Rect };

export function computeMinimumCanvasZoom( bounds: CanvasZoomBounds | null ): number {
    if ( !bounds ) return 0;
    return Math.max(
        bounds.viewport.width / ( 3 * bounds.geometry.width ),
        bounds.viewport.height / ( 3 * bounds.geometry.height )
    );
}

function constrainAxisOffset( offset: number, start: number, size: number, visibleStart: number, visibleSize: number ): number {
    const minimum = visibleStart + visibleSize * 2 / 3 - start - size;
    const maximum = visibleStart + visibleSize / 3 - start;
    // At the minimum zoom a floating-point rounding error may invert equal limits.
    return minimum > maximum ? ( minimum + maximum ) / 2 : Math.min( maximum, Math.max( minimum, offset ) );
}

export function constrainCanvasZoomCamera( camera: Camera, bounds: CanvasZoomBounds | null ): Camera {
    if ( !bounds ) return camera;
    const zoom = Math.max( camera.zoom, computeMinimumCanvasZoom( bounds ) );
    const { geometry, viewport } = bounds;
    return {
        zoom,
        x: constrainAxisOffset( camera.x, geometry.x * zoom, geometry.width * zoom, viewport.x, viewport.width ),
        y: constrainAxisOffset( camera.y, geometry.y * zoom, geometry.height * zoom, viewport.y, viewport.height ),
    };
}
