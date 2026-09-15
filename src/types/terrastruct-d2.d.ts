// src/types/terrastruct-d2.d.ts
// Supplies the public D2 API types missing from the package exports map.

declare module "@terrastruct/d2" {
    export type D2Layout = "dagre" | "elk";

    export type RenderOptions = {
        center?: boolean;
        noXMLTag?: boolean;
        pad?: number;
        [ key: string ]: unknown;
    };

    export type CompileResponse = {
        diagram: unknown;
        renderOptions: RenderOptions;
    };

    export class D2 {
        compile( input: string, options?: { layout?: D2Layout } ): Promise<CompileResponse>;
        render( diagram: unknown, options?: RenderOptions ): Promise<string>;
    }
}
