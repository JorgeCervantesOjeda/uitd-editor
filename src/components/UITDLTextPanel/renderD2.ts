// src/components/UITDLTextPanel/renderD2.ts
// Compiles editable D2 with the selected engine and sanitizes the rendered SVG.

import DOMPurify from "dompurify";

export type D2Layout = "elk" | "dagre";

type D2Instance = InstanceType<( typeof import( "@terrastruct/d2" ) )[ "D2" ]>;

let d2Instance: D2Instance | null = null;

async function getD2Instance(): Promise<D2Instance> {
    if ( !d2Instance ) {
        const { D2 } = await import( "@terrastruct/d2" );
        d2Instance = new D2();
    }
    return d2Instance;
}

export async function renderD2( source: string, layout: D2Layout ): Promise<string> {
    const compiler = await getD2Instance();
    const { diagram, renderOptions } = await compiler.compile( source, { layout } );
    const renderedSVG = await compiler.render( diagram, {
        ...renderOptions,
        center: true,
        noXMLTag: true,
        pad: 40,
    } );
    const sanitizedSVG = DOMPurify.sanitize( renderedSVG, {
        USE_PROFILES: { svg: true, svgFilters: true },
    } );
    if ( !sanitizedSVG.includes( "<svg" ) ) {
        throw new Error( "D2 returned no usable SVG after sanitization." );
    }
    return sanitizedSVG;
}
