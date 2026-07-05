// Verifies that the heavy D2 compiler is instantiated only on demand and reused.

import { beforeEach, describe, expect, it, vi } from "vitest";

const compilerMocks = vi.hoisted( () => ( {
    construct: vi.fn(),
    compile: vi.fn( async () => ( { diagram: { id: "diagram" }, renderOptions: {} } ) ),
    render: vi.fn( async () => '<svg viewBox="0 0 10 10"></svg>' ),
} ) );

vi.mock( "@terrastruct/d2", () => ( {
    D2: class MockD2 {
        compile = compilerMocks.compile;
        render = compilerMocks.render;

        constructor() {
            compilerMocks.construct();
        }
    },
} ) );

describe( "renderD2 lazy compiler", () => {
    beforeEach( () => {
        vi.resetModules();
        compilerMocks.construct.mockClear();
        compilerMocks.compile.mockClear();
        compilerMocks.render.mockClear();
    } );

    it( "loads D2 only on demand and reuses the compiler instance", async () => {
        const renderer = await import( "./renderD2" );

        expect( renderer.isD2CompilerLoaded() ).toBe( false );
        expect( compilerMocks.construct ).not.toHaveBeenCalled();

        await renderer.loadD2Compiler();

        expect( renderer.isD2CompilerLoaded() ).toBe( true );
        expect( compilerMocks.construct ).toHaveBeenCalledTimes( 1 );

        await renderer.loadD2Compiler();
        const svg = await renderer.renderD2( "x -> y", "elk" );

        expect( compilerMocks.construct ).toHaveBeenCalledTimes( 1 );
        expect( compilerMocks.compile ).toHaveBeenCalledWith( "x -> y", { layout: "elk" } );
        expect( compilerMocks.render ).toHaveBeenCalledTimes( 1 );
        expect( svg ).toContain( "<svg" );
    } );
} );
