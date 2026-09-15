// src/components/UITDLTextPanel/d2CropGeometry.ts
// Provides coordinate and edit geometry for D2 SVG crop selections.

import type { D2CropRect } from "./d2JpegExport";

export type DiagramDimensions = {
    width: number;
    height: number;
};

export type DiagramPoint = {
    x: number;
    y: number;
};

export type D2CropDragMode =
    | "create"
    | "move"
    | "n"
    | "ne"
    | "e"
    | "se"
    | "s"
    | "sw"
    | "w"
    | "nw";

export type D2CropInteraction = {
    pointerId: number;
    mode: D2CropDragMode;
    start: DiagramPoint;
    current: DiagramPoint;
    cropAtStart: D2CropRect | null;
};

const MIN_CROP_SIZE = 1;

export function clampedDiagramPoint(
    point: DiagramPoint,
    dimensions: DiagramDimensions
): DiagramPoint {
    return {
        x: Math.min( dimensions.width, Math.max( 0, point.x ) ),
        y: Math.min( dimensions.height, Math.max( 0, point.y ) ),
    };
}

export function cropRectOfPoints(
    start: DiagramPoint,
    current: DiagramPoint,
    dimensions: DiagramDimensions
): D2CropRect | null {
    const safeStart = clampedDiagramPoint( start, dimensions );
    const safeCurrent = clampedDiagramPoint( current, dimensions );
    const x = Math.min( safeStart.x, safeCurrent.x );
    const y = Math.min( safeStart.y, safeCurrent.y );
    const width = Math.abs( safeCurrent.x - safeStart.x );
    const height = Math.abs( safeCurrent.y - safeStart.y );
    if ( width < MIN_CROP_SIZE || height < MIN_CROP_SIZE ) return null;
    return { x, y, width, height };
}

function clampedCropRect(
    crop: D2CropRect,
    dimensions: DiagramDimensions
): D2CropRect | null {
    const left = Math.min( dimensions.width, Math.max( 0, crop.x ) );
    const top = Math.min( dimensions.height, Math.max( 0, crop.y ) );
    const right = Math.min( dimensions.width, Math.max( 0, crop.x + crop.width ) );
    const bottom = Math.min( dimensions.height, Math.max( 0, crop.y + crop.height ) );
    const width = right - left;
    const height = bottom - top;
    if ( width < MIN_CROP_SIZE || height < MIN_CROP_SIZE ) return null;
    return { x: left, y: top, width, height };
}

export function movedCropRect(
    crop: D2CropRect,
    delta: DiagramPoint,
    dimensions: DiagramDimensions
): D2CropRect {
    const maxX = Math.max( 0, dimensions.width - crop.width );
    const maxY = Math.max( 0, dimensions.height - crop.height );
    return {
        ...crop,
        x: Math.min( maxX, Math.max( 0, crop.x + delta.x ) ),
        y: Math.min( maxY, Math.max( 0, crop.y + delta.y ) ),
    };
}

export function resizedCropRect(
    crop: D2CropRect,
    mode: D2CropDragMode,
    current: DiagramPoint,
    dimensions: DiagramDimensions
): D2CropRect | null {
    const safeCurrent = clampedDiagramPoint( current, dimensions );
    let left = crop.x;
    let top = crop.y;
    let right = crop.x + crop.width;
    let bottom = crop.y + crop.height;

    if ( mode.includes( "w" ) ) left = safeCurrent.x;
    if ( mode.includes( "e" ) ) right = safeCurrent.x;
    if ( mode.includes( "n" ) ) top = safeCurrent.y;
    if ( mode.includes( "s" ) ) bottom = safeCurrent.y;

    return cropRectOfPoints( { x: left, y: top }, { x: right, y: bottom }, dimensions );
}

export function cropRectOfInteraction(
    interaction: D2CropInteraction,
    dimensions: DiagramDimensions
): D2CropRect | null {
    if ( interaction.mode === "create" ) {
        return cropRectOfPoints( interaction.start, interaction.current, dimensions );
    }
    if ( !interaction.cropAtStart ) return null;
    if ( interaction.mode === "move" ) {
        return movedCropRect( interaction.cropAtStart, {
            x: interaction.current.x - interaction.start.x,
            y: interaction.current.y - interaction.start.y,
        }, dimensions );
    }
    return resizedCropRect( interaction.cropAtStart, interaction.mode, interaction.current, dimensions );
}

export function validCropRectOfInteraction(
    interaction: D2CropInteraction,
    dimensions: DiagramDimensions
): D2CropRect | null {
    const crop = cropRectOfInteraction( interaction, dimensions );
    return crop ? clampedCropRect( crop, dimensions ) : null;
}
