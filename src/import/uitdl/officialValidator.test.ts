// src/import/uitdl/officialValidator.test.ts
// Verifies editor-facing positions for official UITDL validation diagnostics.

import { describe, expect, it } from "vitest";
import { validateWithOfficialValidator } from "./officialValidator";

describe( "validateWithOfficialValidator", () => {
    it( "points missing transition destinations at the referenced UI", () => {
        const text = `UITD "UITD Diagram" {
    UI 2 "Home" actions {
        clicks "Logout";
    }
    UI 5 "Error" actions {
        clicks "OK";
    }
    UI 9 "Log in" actions {
        clicks "submit";
    }
    FRAGMENT "name" {
        DRAW { 5, 2, 9 };
        TRANSITION from 9 to 12 if user clicks "submit" AND "ok";
        TRANSITION from 9 to 5 if user clicks "submit" AND "not ok";
        TRANSITION from 2 to 9 if user clicks "Logout";
        TRANSITION from 5 to 9 if user clicks "OK";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Referenced "to" UI "12" does not exist.' );

        expect( issue ).toMatchObject( {
            line: 13,
            col: 30,
        } );
    } );

    it( "points undrawn transition destinations at the referenced UI", () => {
        const text = `UITD "UITD Diagram" {
    UI 9 "Log in" actions {
        clicks "submit";
    }
    UI 12 "Dashboard" actions {}
    FRAGMENT "name" {
        DRAW { 9 };
        TRANSITION from 9 to 12 if user clicks "submit";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Undrawn UI "12" referenced in transition.' );

        expect( issue ).toMatchObject( {
            line: 8,
            col: 30,
        } );
    } );

    it( "points forward transition origins at the referenced UI", () => {
        const text = `UITD "UITD Diagram" {
    UI 9 "Log in" actions {}
    FRAGMENT "name" {
        DRAW { 9, 12 };
        TRANSITION from 12 to 9 if user clicks "submit";
    }
    UI 12 "Dashboard" actions {
        clicks "submit";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Referenced "from" UI "12" is used before its UI declaration.' );

        expect( issue ).toMatchObject( {
            line: 5,
            col: 25,
        } );
    } );

    it( "points missing DRAW references at the referenced UI", () => {
        const text = `UITD "UITD Diagram" {
    UI 1 "Home" actions {
        clicks "Stay";
    }
    FRAGMENT "name" {
        DRAW { 1, 12 };
        TRANSITION from 1 to 1 if user clicks "Stay";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Referenced UI "12" in DRAW does not exist.' );

        expect( issue ).toMatchObject( {
            line: 6,
            col: 19,
        } );
    } );

    it( "points missing nested DRAW references at the nested referenced UI", () => {
        const text = `UITD "UITD Diagram" {
    UI 3 "Container" actions {
        clicks "Stay";
    }
    FRAGMENT "name" {
        DRAW { 3[14] };
        TRANSITION from 3 to 3 if user clicks "Stay";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Referenced UI "14" in DRAW does not exist.' );

        expect( issue ).toMatchObject( {
            line: 6,
            col: 18,
        } );
    } );

    it( "reports duplicate exact DRAW references from the official validator", () => {
        const text = `UITD "UITD Diagram" {
    UI 1 "Node 1" actions {
        clicks "submit";
    }
    UI 2 "Creación de cuenta" actions {
        clicks "cancel";
        clicks "crear cuenta";
    }
    UI 3 "Home" actions {
        clicks "logout";
    }
    FRAGMENT "Fragment 1" {
        DRAW { 1, 2, 3, 1 };
        TRANSITION from 1 to 2 if user clicks "submit" AND "not ok";
        TRANSITION from 1 to 3 if user clicks "submit" AND "ok";
        TRANSITION from 2 to 1 if user clicks "cancel";
        TRANSITION from 2 to 1 if user clicks "crear cuenta";
        TRANSITION from 3 to 1 if user clicks "logout";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Duplicate DRAW reference "1" in fragment "Fragment 1". Remove the repeated reference.' );

        expect( issue ).toMatchObject( {
            line: 13,
            col: 25,
        } );
    } );

    it( "reports leading-zero UI IDs from the official validator", () => {
        const text = `UITD "UITD Diagram" {
    UI 01 "Home" actions {
        clicks "Stay";
    }
    FRAGMENT "name" {
        DRAW { 01 };
        TRANSITION from 01 to 01 if user clicks "Stay";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message === 'Invalid UIID "01": UI IDs must not contain leading zeros.' );

        expect( issue ).toMatchObject( {
            line: 2,
            col: 8,
        } );
    } );

    it( "reports nondeterministic transitions from the official validator", () => {
        const text = `UITD "UITD Diagram" {
    UI 1 "Home" actions {
        clicks "submit";
    }
    UI 2 "A" actions {}
    UI 3 "B" actions {}
    FRAGMENT "name" {
        DRAW { 1, 2, 3 };
        TRANSITION from 1 to 2 if user clicks "submit" AND "ok";
        TRANSITION from 1 to 3 if user clicks "submit" AND "ok";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message.includes( 'has multiple destinations' ) );

        expect( issue ).toMatchObject( {
            line: 9,
            col: 40,
        } );
    } );

    it( "reports disconnected fragments from the official validator", () => {
        const text = `UITD "UITD Diagram" {
    UI 1 "Home" actions {
        clicks "stay";
    }
    UI 2 "Other" actions {
        clicks "stay";
    }
    FRAGMENT "name" {
        DRAW { 1, 2 };
        TRANSITION from 1 to 1 if user clicks "stay";
    }
}`;

        const issue = validateWithOfficialValidator( text )
            .find( candidate => candidate.message.includes( 'is disconnected' ) );

        expect( issue ).toMatchObject( {
            line: 8,
            col: 5,
        } );
    } );
} );
