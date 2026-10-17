// src/debug/sequenceTrace.test.ts
// Verifies the normative entry/exit trace emission contract.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    emitSequenceTrace,
    resetSequenceTraceForTests,
    setSequenceTraceEnabled,
} from "./sequenceTrace";

describe( "sequence trace emission", () => {
    beforeEach( () => {
        resetSequenceTraceForTests();
        localStorage.clear();
        vi.spyOn( console, "info" ).mockImplementation( () => undefined );
    } );

    it( "emits entry and exit events by default", () => {
        emitSequenceTrace( {
            kind: "entry",
            correlationId: "trace-1",
            from: "UITDLTextPanel",
            to: "UITDLCanonicalValidator",
            operation: "callOfficialUITDLValidator",
            payload: { textLength: 12 },
        } );
        emitSequenceTrace( {
            kind: "exit",
            correlationId: "trace-1",
            from: "UITDLCanonicalValidator",
            to: "UITDLTextPanel",
            operation: "callOfficialUITDLValidator",
            outcome: "response",
            payload: { issueCount: 0 },
        } );

        expect( console.info ).toHaveBeenCalledTimes( 2 );
        expect( console.info ).toHaveBeenNthCalledWith(
            1,
            "[sequence-trace]",
            expect.objectContaining( { kind: "entry", sequence: 1, correlationId: "trace-1" } ),
        );
        expect( console.info ).toHaveBeenNthCalledWith(
            2,
            "[sequence-trace]",
            expect.objectContaining( { kind: "exit", sequence: 2, outcome: "response" } ),
        );
    } );

    it( "suppresses emission only after explicit configuration disables it", () => {
        setSequenceTraceEnabled( false );

        emitSequenceTrace( {
            kind: "entry",
            correlationId: "trace-disabled",
            from: "UITDLTextPanel",
            to: "UITDLCanonicalValidator",
            operation: "callOfficialUITDLValidator",
            payload: { textLength: 12 },
        } );

        expect( console.info ).not.toHaveBeenCalled();
    } );
} );
