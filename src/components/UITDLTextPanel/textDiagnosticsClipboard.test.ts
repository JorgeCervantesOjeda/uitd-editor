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
                code: "internal-parser",
                line: 2,
                col: 5,
                message: "Expected UI declaration.",
                source: "uitdl-text",
            },
            {
                kind: "warning",
                code: "ui-no-effective-outgoing",
                line: 6,
                message: "UIID 3 is unreachable.",
                source: "uitdl-text",
            },
            {
                kind: "warning",
                code: "official-validator",
                message: "No fragment width was provided.",
                source: "uitdl-text",
            },
        ];

        const report = formatUITDLTextWithDiagnosticsForClipboard( 'UITD "Example" {}', issues );

        expect( report ).toContain( 'UITD "Example" {}\n\nUITDL text diagnostics' );
        expect( report ).toContain( "Source: UITDL text" );
        expect( report ).toContain( "Errors: 1" );
        expect( report ).toContain( "Warnings: 2" );
        expect( report ).toContain( "1. [internal-parser] L2:C5 Expected UI declaration." );
        expect( report ).toContain( "1. [ui-no-effective-outgoing] L6 UIID 3 is unreachable." );
        expect( report ).toContain( "2. [official-validator] General No fragment width was provided." );
    } );
} );
