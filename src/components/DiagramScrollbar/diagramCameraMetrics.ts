export const CANONICAL_ZOOM_PERCENT = 100;

export type DiagramGeometry = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type Camera2D = {
    x: number;
    y: number;
    zoom: number;
};

export type AxisScrollMetrics = {
    maxOffset: number;
    offset: number;
    startCameraOffset: number;
};

type AxisScrollInput = {
    geometryStart: number;
    geometrySize: number;
    cameraOffset: number;
    zoom: number;
    visibleStart: number;
    visibleSize: number;
};

type FitToWidthInput = {
    geometry: DiagramGeometry;
    visibleLeft: number;
    visibleTop: number;
    visibleWidth: number;
    paddingX: number;
    paddingY: number;
};

type WheelDeltaLike = {
    deltaMode: number;
    deltaX: number;
    deltaY: number;
};

export function clampScroll( offset: number, maxOffset: number ): number {
    const finiteMax = Number.isFinite( maxOffset ) ? Math.max( 0, maxOffset ) : 0;
    if ( !Number.isFinite( offset ) ) return 0;
    return Math.min( finiteMax, Math.max( 0, offset ) );
}

export function effectiveZoomOfPercent( zoomPercent: number, fitZoom: number ): number {
    if ( !Number.isFinite( fitZoom ) || fitZoom <= 0 ) return 0;
    if ( !Number.isFinite( zoomPercent ) ) return fitZoom;
    return fitZoom * zoomPercent / CANONICAL_ZOOM_PERCENT;
}

export function zoomPercentOfEffectiveZoom( zoom: number, fitZoom: number ): number {
    if ( !Number.isFinite( zoom ) || !Number.isFinite( fitZoom ) || fitZoom <= 0 ) {
        return CANONICAL_ZOOM_PERCENT;
    }
    return zoom / fitZoom * CANONICAL_ZOOM_PERCENT;
}

export function computeFitToWidthCamera( input: FitToWidthInput ): {
    fitZoom: number;
    camera: Camera2D;
} | null {
    const { geometry, visibleLeft, visibleTop, visibleWidth, paddingX, paddingY } = input;
    if (
        !Number.isFinite( geometry.x ) ||
        !Number.isFinite( geometry.y ) ||
        !Number.isFinite( geometry.width ) ||
        geometry.width <= 0 ||
        !Number.isFinite( visibleWidth ) ||
        visibleWidth <= 0
    ) return null;

    const availableWidth = visibleWidth - 2 * Math.max( 0, paddingX );
    if ( !Number.isFinite( availableWidth ) || availableWidth <= 0 ) return null;

    const fitZoom = availableWidth / geometry.width;
    if ( !Number.isFinite( fitZoom ) || fitZoom <= 0 ) return null;

    return {
        fitZoom,
        camera: {
            x: visibleLeft + Math.max( 0, paddingX ) - geometry.x * fitZoom,
            y: visibleTop + Math.max( 0, paddingY ) - geometry.y * fitZoom,
            zoom: fitZoom,
        },
    };
}

export function computeAxisScrollMetrics( input: AxisScrollInput ): AxisScrollMetrics | null {
    const {
        geometryStart,
        geometrySize,
        cameraOffset,
        zoom,
        visibleStart,
        visibleSize,
    } = input;

    if (
        !Number.isFinite( geometryStart ) ||
        !Number.isFinite( geometrySize ) ||
        geometrySize <= 0 ||
        !Number.isFinite( cameraOffset ) ||
        !Number.isFinite( zoom ) ||
        zoom <= 0 ||
        !Number.isFinite( visibleStart ) ||
        !Number.isFinite( visibleSize ) ||
        visibleSize <= 0
    ) return null;

    const scaledSize = geometrySize * zoom;
    const maxOffset = Math.max( 0, scaledSize - visibleSize );
    const diagramStart = cameraOffset + geometryStart * zoom;
    const offset = clampScroll( visibleStart - diagramStart, maxOffset );

    return {
        maxOffset,
        offset,
        startCameraOffset: visibleStart - geometryStart * zoom,
    };
}

export function cameraOffsetOfScroll( metrics: AxisScrollMetrics, nextOffset: number ): number {
    return metrics.startCameraOffset - clampScroll( nextOffset, metrics.maxOffset );
}

export function normalizeWheelDelta(
    event: WheelDeltaLike,
    orientation: "horizontal" | "vertical",
    pageSize: number
): number {
    const rawDelta = orientation === "horizontal"
        ? Math.abs( event.deltaX ) > Math.abs( event.deltaY ) ? event.deltaX : event.deltaY
        : event.deltaY;
    const unit = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
            ? Math.max( 0, pageSize )
            : 1;
    return rawDelta * unit;
}
