// src/components/Canvas/canvasFragmentGeometry.ts
// Shares the primary fragment-frame selector and measures their union without titles or selection overlays.
import type { DiagramGeometry } from "../DiagramScrollbar/diagramCameraMetrics";

export const CANVAS_FRAGMENT_FRAME_SELECTOR =
    '[data-layer="fragment-frames"] .fragmentFrameGroup > rect[data-fragment-selection]:not([data-export="ignore"])';

export function measureCanvasFragmentGeometry( diagram: SVGGElement ): DiagramGeometry | null {
    const frames = Array.from( diagram.querySelectorAll<SVGRectElement>( CANVAS_FRAGMENT_FRAME_SELECTOR ) );
    if ( frames.length === 0 ) return null;
    try {
        const boxes = frames.map( frame => frame.getBBox() );
        if ( boxes.some( box => !Number.isFinite( box.x ) || !Number.isFinite( box.y )
            || !Number.isFinite( box.width ) || !Number.isFinite( box.height ) || box.width <= 0 || box.height <= 0 ) ) {
            console.warn( "[Canvas fragment geometry] Invalid frame bounds; camera geometry is unavailable." );
            return null;
        }
        const x = Math.min( ...boxes.map( box => box.x ) );
        const y = Math.min( ...boxes.map( box => box.y ) );
        return {
            x, y,
            width: Math.max( ...boxes.map( box => box.x + box.width ) ) - x,
            height: Math.max( ...boxes.map( box => box.y + box.height ) ) - y,
        };
    } catch ( error ) {
        console.warn( "[Canvas fragment geometry] Frame measurement failed; camera geometry is unavailable.", error );
        return null;
    }
}
