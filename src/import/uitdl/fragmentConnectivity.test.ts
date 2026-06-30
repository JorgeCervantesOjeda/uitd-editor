// src/import/uitdl/fragmentConnectivity.test.ts
// Verifies that every textual UITDL fragment is one connected component.

import { describe, expect, it } from "vitest";
import { validateFragmentConnectivity } from "./fragmentConnectivity";
import { validateWithOfficialValidator } from "./officialValidator";

const PREFIX = `UITD "Connectivity" {
    UI 1 "Navigation" actions { clicks "Dashboard"; clicks "Reports"; clicks "Sign out"; }
    UI 2 "Sign in" actions {}
    UI 3 "Dashboard" actions {}
    UI 4 "Reports" actions {}
    UI 5 "Report detail" actions {}
`;

describe( "validateFragmentConnectivity", () => {
    it( "rejects a disconnected UI in DRAW", () => {
        const text = `${PREFIX}
            FRAGMENT "Reusable navigation" {
                DRAW { 1, 2, 3[1], 4[1], 5 };
                TRANSITION from 1 to 3 if user clicks "Dashboard" AND "session is active";
                TRANSITION from 1 to 4 if user clicks "Reports" AND "session is active";
                TRANSITION from 1 to 2 if user clicks "Sign out";
            }
        }`;
        const issues = validateFragmentConnectivity( text );

        expect( issues ).toHaveLength( 1 );
        expect( issues[ 0 ].message ).toContain( "Fragment \"Reusable navigation\" is disconnected" );
        expect( issues[ 0 ].message ).toContain( "{ UI 5 }" );
        expect( validateWithOfficialValidator( text )
            .some( issue => issue.kind === "error" && issue.message.includes( "is disconnected" ) )
        ).toBe( true );
    } );

    it( "accepts connectivity established by transitions and inclusion", () => {
        const issues = validateFragmentConnectivity( `${PREFIX}
            FRAGMENT "Reusable navigation" {
                DRAW { 1, 2, 3[1], 4[1] };
                TRANSITION from 1 to 3 if user clicks "Dashboard" AND "session is active";
                TRANSITION from 1 to 4 if user clicks "Reports" AND "session is active";
                TRANSITION from 1 to 2 if user clicks "Sign out";
            }
        }` );

        expect( issues ).toEqual( [] );
    } );
} );
