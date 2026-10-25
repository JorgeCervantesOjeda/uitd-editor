// src/components/Canvas/edgeGeometry.ts
// Builds edge paths with separated return arrows for unconditional same-UI transitions.
import type { Point } from "../../model/types";

const RETURN_ARROW_OFFSET = 36;

export function buildEdgePath( start: Point, end: Point, isUnconditionalReturn: boolean ): string {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const mx = start.x + dx / 2;
    const my = start.y + dy / 2;
    if ( !isUnconditionalReturn ) {
        return `M ${start.x} ${start.y} L ${mx} ${my} L ${end.x} ${end.y}`;
    }

    const length = Math.hypot( dx, dy );
    if ( length === 0 ) {
        // Coincident centers need a loop with a nonzero tangent at the middle arrow.
        const radius = RETURN_ARROW_OFFSET * 2;
        return `M ${start.x} ${start.y} Q ${start.x + radius} ${start.y - radius} ${start.x + radius} ${start.y} Q ${start.x + radius} ${start.y + radius} ${end.x} ${end.y}`;
    }

    const offsetX = -dy / length * RETURN_ARROW_OFFSET;
    const offsetY = dx / length * RETURN_ARROW_OFFSET;
    // Split a quadratic curve at its midpoint so markerMid follows a smooth tangent.
    return `M ${start.x} ${start.y} Q ${start.x + dx / 4 + offsetX} ${start.y + dy / 4 + offsetY} ${mx + offsetX} ${my + offsetY} Q ${start.x + dx * 3 / 4 + offsetX} ${start.y + dy * 3 / 4 + offsetY} ${end.x} ${end.y}`;
}
