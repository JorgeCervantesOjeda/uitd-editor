// Verifies the public UITDL import boundary emits trace entry and response events.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "../../state/types";
import { resetSequenceTraceForTests } from "../../debug/sequenceTrace";
import { importUITDL } from "./index";

function baseState(): AppState {
    return {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        fragmentTitles: {},
        nextId: 1,
        nextActionId: 1,
        nextEdgeId: 1,
        panzoom: { x: 0, y: 0, zoom: 1 },
        viewBox: { w: 1000, h: 800 },
    } as unknown as AppState;
}

describe( "importUITDL boundary", () => {
    beforeEach( () => {
        resetSequenceTraceForTests();
        vi.spyOn( console, "info" ).mockImplementation( () => undefined );
        vi.spyOn( console, "log" ).mockImplementation( () => undefined );
        vi.spyOn( window, "confirm" ).mockReturnValue( true );
    } );

    it( "emits one entry and one response while importing a valid artifact", () => {
        const text = `UITD "Trace" {
            UI 1 "Start" actions {}
            FRAGMENT "Only UI" {
                DRAW { 1 };
            }
        }`;

        const project = importUITDL( text, baseState() );
        const traceCalls = vi.mocked( console.info ).mock.calls.filter( call => call[ 0 ] === "[sequence-trace]" );

        expect( project.nodes ).toHaveLength( 1 );
        expect( traceCalls ).toHaveLength( 4 );
        expect( traceCalls[ 0 ] ).toEqual( [ "[sequence-trace]", expect.objectContaining( {
            kind: "entry",
            operation: "importUITDL",
            from: "UITDLArtifactImporter",
            to: "UITDLProjectBuilder",
        } ) ] );
        expect( traceCalls[ 1 ] ).toEqual( [ "[sequence-trace]", expect.objectContaining( {
            kind: "entry",
            operation: "callOfficialUITDLValidator",
            from: "UITDLArtifactImporter",
            to: "UITDLCanonicalValidator",
        } ) ] );
        expect( traceCalls[ 2 ] ).toEqual( [ "[sequence-trace]", expect.objectContaining( {
            kind: "exit",
            operation: "callOfficialUITDLValidator",
            from: "UITDLCanonicalValidator",
            to: "UITDLArtifactImporter",
            outcome: "response",
        } ) ] );
        expect( traceCalls[ 3 ] ).toEqual( [ "[sequence-trace]", expect.objectContaining( {
            kind: "exit",
            operation: "importUITDL",
            from: "UITDLProjectBuilder",
            to: "UITDLArtifactImporter",
            outcome: "response",
        } ) ] );
    } );
} );
