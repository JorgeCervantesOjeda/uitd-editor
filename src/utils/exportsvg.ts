export type ExportJpgOptions = {
    scale?: number;      // 1..4 típico
    quality?: number;    // 0..1 (JPEG)
    background?: string; // p.ej. "#ffffff"
};

export function serializeSvg( svgEl: SVGSVGElement ): string {
    const clone = svgEl.cloneNode( true ) as SVGSVGElement;
    if ( !clone.getAttribute( "xmlns" ) ) clone.setAttribute( "xmlns", "http://www.w3.org/2000/svg" );
    if ( !clone.getAttribute( "xmlns:xlink" ) ) clone.setAttribute( "xmlns:xlink", "http://www.w3.org/1999/xlink" );
    const serializer = new XMLSerializer();
    return serializer.serializeToString( clone );
}

export function exportSvg( svgEl: SVGSVGElement, filename = "diagram.svg" ) {
    const svgText = serializeSvg( svgEl );
    const blob = new Blob( [ svgText ], { type: "image/svg+xml;charset=utf-8" } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( "a" );
    a.href = url;
    a.download = filename;
    document.body.appendChild( a );
    a.click();
    a.remove();
    URL.revokeObjectURL( url );
}

export async function exportJpg(
    svgEl: SVGSVGElement,
    filename = "diagram.jpg",
    opts: ExportJpgOptions = {}
) {
    const { scale = 2, quality = 0.92, background = "#ffffff" } = opts;

    const vb = svgEl.viewBox.baseVal;
    const width = vb?.width || svgEl.clientWidth || 1200;
    const height = vb?.height || svgEl.clientHeight || 800;

    const svgText = serializeSvg( svgEl );
    const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent( svgText );
    const img = await loadImage( svgDataUrl );

    const canvas = document.createElement( "canvas" );
    canvas.width = Math.max( 1, Math.floor( width * scale ) );
    canvas.height = Math.max( 1, Math.floor( height * scale ) );
    const ctx = canvas.getContext( "2d" );
    if ( !ctx ) throw new Error( "Canvas 2D context not available" );

    ctx.fillStyle = background;
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    ctx.drawImage( img, 0, 0, canvas.width, canvas.height );

    const dataUrl = canvas.toDataURL( "image/jpeg", quality );
    const a = document.createElement( "a" );
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild( a );
    a.click();
    a.remove();
}

function loadImage( src: string ): Promise<HTMLImageElement> {
    return new Promise( ( resolve, reject ) => {
        const img = new Image();
        img.onload = () => resolve( img );
        img.onerror = ( e ) => reject( e );
        img.src = src;
    } );
}
  