// src/components/Canvas/canvasCameraBounds.ts
// Clamps the canvas camera to the scrollable bounds of the measured diagram.

import {
    cameraOffsetOfBoundedAxis,
    type AxisScrollMetrics,
} from "../DiagramScrollbar/diagramCameraMetrics";

export type CanvasCamera = {
    x: number;
    y: number;
    zoom: number;
};

export type CanvasScrollMetrics = {
    horizontal: AxisScrollMetrics;
    vertical: AxisScrollMetrics;
};

export function clampedCanvasCameraOfScrollMetrics(
    panzoom: CanvasCamera,
    metrics: CanvasScrollMetrics
): CanvasCamera {
    return {
        ...panzoom,
        x: cameraOffsetOfBoundedAxis( metrics.horizontal ),
        y: cameraOffsetOfBoundedAxis( metrics.vertical ),
    };
}

export function isSameCanvasCamera( first: CanvasCamera, second: CanvasCamera ): boolean {
    return first.x === second.x && first.y === second.y && first.zoom === second.zoom;
}
