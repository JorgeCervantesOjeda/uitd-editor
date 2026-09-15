// src/components/UITDLTextPanel/uitdlTabNavigation.test.ts
// Verifies UITDL editable field discovery and keyboard navigation order.

import { describe, expect, it } from "vitest";
import {
    collectUITDLEditableFields,
    findNextUITDLEditableField,
} from "./uitdlTabNavigation";

const MODEL = `UITD "Example" {
    UI 1 "Start" actions {
        clicks "Continue";
    }

    FRAGMENT "Flow" {
        DRAW { 1, 2 };
        TRANSITION from 1 to 2 if user clicks "Continue" AND "ready";
    }
}`;

describe( "uitdlTabNavigation", () => {
    it( "collects editable fields across UITDL declarations and transitions", () => {
        const fields = collectUITDLEditableFields( MODEL );

        expect( fields ).toContainEqual( {
            startLineNumber: 1,
            startColumn: 7,
            endLineNumber: 1,
            endColumn: 14,
        } );
        expect( fields ).toContainEqual( {
            startLineNumber: 2,
            startColumn: 8,
            endLineNumber: 2,
            endColumn: 9,
        } );
        expect( fields ).toContainEqual( {
            startLineNumber: 8,
            startColumn: 25,
            endLineNumber: 8,
            endColumn: 26,
        } );
        expect( fields ).toContainEqual( {
            startLineNumber: 8,
            startColumn: 48,
            endLineNumber: 8,
            endColumn: 56,
        } );
        expect( fields ).toContainEqual( {
            startLineNumber: 8,
            startColumn: 63,
            endLineNumber: 8,
            endColumn: 68,
        } );
    } );

    it( "jumps to the next field from anywhere in the text and wraps at the end", () => {
        expect( findNextUITDLEditableField( MODEL, { lineNumber: 8, column: 1 } ) ).toEqual( {
            startLineNumber: 8,
            startColumn: 25,
            endLineNumber: 8,
            endColumn: 26,
        } );
        expect( findNextUITDLEditableField( MODEL, { lineNumber: 8, column: 25 } ) ).toEqual( {
            startLineNumber: 8,
            startColumn: 30,
            endLineNumber: 8,
            endColumn: 31,
        } );
        expect( findNextUITDLEditableField( MODEL, { lineNumber: 9, column: 2 } ) ).toEqual( {
            startLineNumber: 1,
            startColumn: 7,
            endLineNumber: 1,
            endColumn: 14,
        } );
    } );

    it( "moves from an edited transition origin to the destination field", () => {
        const transition = 'TRANSITION from 123 to 0 if user clicks "target";';

        expect( findNextUITDLEditableField( transition, { lineNumber: 1, column: 20 } ) ).toEqual( {
            startLineNumber: 1,
            startColumn: 24,
            endLineNumber: 1,
            endColumn: 25,
        } );
    } );

    it( "jumps to the previous field with reverse navigation", () => {
        expect(
            findNextUITDLEditableField( MODEL, { lineNumber: 8, column: 62 }, "previous" )
        ).toEqual( {
            startLineNumber: 8,
            startColumn: 48,
            endLineNumber: 8,
            endColumn: 56,
        } );
    } );
} );
