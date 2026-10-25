// src/components/Canvas/edgeGeometry.test.ts
// Checks the geometry used by selfTransitions.integration.test.tsx.
import { describe, expect, it } from "vitest";
import { buildEdgePath } from "./edgeGeometry";

describe( "buildEdgePath", () => {
    it( "keeps ordinary edges straight with a midpoint for the arrow", () => {
        expect( buildEdgePath( { x: 0, y: 0 }, { x: 200, y: 0 }, false ) ).toBe( "M 0 0 L 100 0 L 200 0" );
    } );

    it( "separates the return arrow from the outgoing midpoint", () => {
        expect( buildEdgePath( { x: 200, y: 0 }, { x: 0, y: 0 }, true ) ).toBe(
            "M 200 0 Q 150 -36 100 -36 Q 50 -36 0 0"
        );
    } );

    it( "handles vertical return edges without invalid coordinates", () => {
        expect( buildEdgePath( { x: 0, y: 200 }, { x: 0, y: 0 }, true ) ).toBe(
            "M 0 200 Q 36 150 36 100 Q 36 50 0 0"
        );
    } );

    it( "draws a loop when both endpoint centers coincide", () => {
        expect( buildEdgePath( { x: 10, y: 20 }, { x: 10, y: 20 }, true ) ).toBe(
            "M 10 20 Q 82 -52 82 20 Q 82 92 10 20"
        );
    } );
} );
