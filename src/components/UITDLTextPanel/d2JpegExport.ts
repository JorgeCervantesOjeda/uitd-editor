// src/components/UITDLTextPanel/d2JpegExport.ts
// Builds high-resolution JPG exports from cropped D2 SVG viewBox regions.

export type D2CropRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type D2JpegRasterSize = {
    width: number;
    height: number;
    dpi: number;
};

export type D2JpegExportResult = {
    fileName: string;
    rasterSize: D2JpegRasterSize;
};

const LETTER_DPI = 300;
const LETTER_SHORT_INCHES = 8.5;
const LETTER_LONG_INCHES = 11;
const JPEG_QUALITY = 0.95;

function countOfPixels( inches: number ): number {
    return Math.round( inches * LETTER_DPI );
}

function downloadBlob( blob: Blob, fileName: string ) {
    const url = URL.createObjectURL( blob );
    const anchor = document.createElement( "a" );
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild( anchor );
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL( url );
}

function blobOfCanvas( canvas: HTMLCanvasElement, type: string, quality: number ): Promise<Blob> {
    return new Promise( ( resolve, reject ) => {
        canvas.toBlob( blob => {
            if ( blob ) {
                resolve( blob );
                return;
            }
            reject( new Error( "The browser could not encode the JPG crop." ) );
        }, type, quality );
    } );
}

function loadedImageOfSVG( svg: string ): Promise<HTMLImageElement> {
    return new Promise( ( resolve, reject ) => {
        const blob = new Blob( [ svg ], { type: "image/svg+xml;charset=utf-8" } );
        const url = URL.createObjectURL( blob );
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL( url );
            resolve( image );
        };
        image.onerror = () => {
            URL.revokeObjectURL( url );
            reject( new Error( "The browser could not rasterize the cropped SVG." ) );
        };
        image.src = url;
    } );
}

export function rasterSizeOfD2Crop( crop: D2CropRect ): D2JpegRasterSize {
    const aspectRatio = crop.width / crop.height;
    const isLandscape = aspectRatio >= 1;
    const maxWidth = countOfPixels( isLandscape ? LETTER_LONG_INCHES : LETTER_SHORT_INCHES );
    const maxHeight = countOfPixels( isLandscape ? LETTER_SHORT_INCHES : LETTER_LONG_INCHES );
    let width = maxWidth;
    let height = Math.round( width / aspectRatio );

    if ( height > maxHeight ) {
        height = maxHeight;
        width = Math.round( height * aspectRatio );
    }

    return {
        width: Math.max( 1, width ),
        height: Math.max( 1, height ),
        dpi: LETTER_DPI,
    };
}

export function croppedD2SVG( svg: string, crop: D2CropRect, rasterSize: D2JpegRasterSize ): string {
    const documentOfSVG = new DOMParser().parseFromString( svg, "image/svg+xml" );
    const svgElement = documentOfSVG.documentElement;
    if ( svgElement.nodeName.toLowerCase() !== "svg" || documentOfSVG.querySelector( "parsererror" ) ) {
        throw new Error( "The rendered D2 SVG could not be parsed for JPG export." );
    }

    svgElement.setAttribute( "viewBox", `${crop.x} ${crop.y} ${crop.width} ${crop.height}` );
    svgElement.setAttribute( "width", String( rasterSize.width ) );
    svgElement.setAttribute( "height", String( rasterSize.height ) );
    svgElement.setAttribute( "preserveAspectRatio", "xMidYMid meet" );

    return new XMLSerializer().serializeToString( svgElement );
}

export async function exportD2CropToJpeg(
    svg: string,
    crop: D2CropRect,
    fileName = "diagram.d2.crop.jpg"
): Promise<D2JpegExportResult> {
    const rasterSize = rasterSizeOfD2Crop( crop );
    const croppedSVG = croppedD2SVG( svg, crop, rasterSize );
    const image = await loadedImageOfSVG( croppedSVG );
    const canvas = document.createElement( "canvas" );
    canvas.width = rasterSize.width;
    canvas.height = rasterSize.height;
    const context = canvas.getContext( "2d" );
    if ( !context ) {
        throw new Error( "The browser could not create a canvas for JPG export." );
    }

    context.fillStyle = "#ffffff";
    context.fillRect( 0, 0, canvas.width, canvas.height );
    context.drawImage( image, 0, 0, canvas.width, canvas.height );
    const blob = await blobOfCanvas( canvas, "image/jpeg", JPEG_QUALITY );
    downloadBlob( blob, fileName );

    return { fileName, rasterSize };
}
