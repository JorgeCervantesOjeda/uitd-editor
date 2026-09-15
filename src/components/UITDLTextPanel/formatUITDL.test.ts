// src/components/UITDLTextPanel/formatUITDL.test.ts
// Verifies structural UITDL formatting and quoted text preservation.
import { describe, expect, it } from "vitest";
import { formatUITDL } from "./formatUITDL";

describe( "formatUITDL", () => {
    it( "formats a compact model with bracketed containment", () => {
        const source = 'UITD "Test"{UI 1 "Start" actions{clicks "Go";}UI 2 "End" actions{}FRAGMENT "Main"{DRAW{1[2]};TRANSITION from 1 to 2 if user clicks "Go";}}';

        expect( formatUITDL( source ) ).toBe( [
            'UITD "Test" {',
            '    UI 1 "Start" actions {',
            '        clicks "Go";',
            "    }",
            '    UI 2 "End" actions {',
            "    }",
            '    FRAGMENT "Main" {',
            "        DRAW {",
            "            1[2]",
            "        };",
            '        TRANSITION from 1 to 2 if user clicks "Go";',
            "    }",
            "}",
            "",
        ].join( "\n" ) );
    } );

    it( "preserves structural characters and spaces inside strings", () => {
        const source = 'UITD "A { title }" { UI 1 "Home, page" actions { clicks "Open (new)"; } }';

        const formatted = formatUITDL( source );

        expect( formatted ).toContain( 'UITD "A { title }" {' );
        expect( formatted ).toContain( 'UI 1 "Home, page" actions {' );
        expect( formatted ).toContain( 'clicks "Open (new)";' );
    } );
} );
