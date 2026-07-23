// src/components/UITDLTextPanel/textDiagnosticsClipboard.test.ts
// Verifies clipboard formatting for UITDL text editor diagnostics.

import { describe, expect, it } from "vitest";
import type { ParseIssue } from "../../import/uitdl/types";
import { formatUITDLTextWithDiagnosticsForClipboard } from "./textDiagnosticsClipboard";

describe( "formatUITDLTextWithDiagnosticsForClipboard", () => {
    it( "returns the original text when there are no diagnostics", () => {
        const text = 'UITD "Example" {\n}\n';

        expect( formatUITDLTextWithDiagnosticsForClipboard( text, [] ) ).toBe( text );
    } );

    it( "appends grouped errors and warnings with locations", () => {
        const issues: ParseIssue[] = [
            {
                kind: "error",
                line: 2,
                col: 5,
                message: "Expected UI declaration.",
            },
            {
                kind: "warning",
                line: 6,
                message: "UIID 3 is unreachable.",
            },
            {
                kind: "warning",
                message: "No fragment width was provided.",
            },
        ];

        const report = formatUITDLTextWithDiagnosticsForClipboard( 'UITD "Example" {}', issues );

        expect( report ).toContain( 'UITD "Example" {}\n\nUITDL text diagnostics' );
        expect( report ).toContain( "Errors: 1" );
        expect( report ).toContain( "Warnings: 2" );
        expect( report ).toContain( "1. L2:C5 Expected UI declaration." );
        expect( report ).toContain( "1. L6 UIID 3 is unreachable." );
        expect( report ).toContain( "2. General No fragment width was provided." );
    } );
} );
