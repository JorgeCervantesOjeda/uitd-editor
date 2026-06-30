// src/components/UITDLTextPanel/exampleUITDL.ts
// Provides a compact, valid UITDL model for learning and experimentation.

export const EXAMPLE_UITDL = `UITD "Reports portal" {
    UI 1 "Navigation menu" actions {
        clicks "Dashboard";
        clicks "Reports";
        clicks "Sign out";
    }
    UI 2 "Sign in" actions {
        submits "Credentials";
    }
    UI 3 "Dashboard" actions {
        clicks "Open latest report";
    }
    UI 4 "Reports" actions {
        clicks "Open report";
    }
    UI 5 "Report detail" actions {
        clicks "Back to reports";
    }
    UI 6 "Sign-in error" actions {
        clicks "Try again";
    }
    UI 7 "Access denied" actions {
        clicks "Back to reports";
    }

    FRAGMENT "Reusable navigation" {
        WIDTH 26;
        DRAW { 1, 2, 3[1], 4[1] };
        TRANSITION from 1 to 3 if user clicks "Dashboard" AND "session is active";
        TRANSITION from 1 to 4 if user clicks "Reports" AND "session is active";
        TRANSITION from 1 to 2 if user clicks "Sign out";
    }

    FRAGMENT "Authentication" {
        WIDTH 28;
        DRAW { 2, 3[1], 6 };
        TRANSITION from 2 to 3 if user submits "Credentials" AND "credentials are valid";
        TRANSITION from 2 to 6 if user submits "Credentials" AND "credentials are invalid";
        TRANSITION from 6 to 2 if user clicks "Try again";
    }

    FRAGMENT "Dashboard report" {
        DRAW { 3[1], 5[1] };
        TRANSITION from 3 to 5 if user clicks "Open latest report" AND "a report is available";
    }

    FRAGMENT "Reports access" {
        WIDTH 24;
        DRAW { 4[1], 5[1], 7[1] };
        TRANSITION from 4 to 5 if user clicks "Open report" AND "report access is granted";
        TRANSITION from 4 to 7 if user clicks "Open report" AND "report access is restricted";
    }

    FRAGMENT "Report return" {
        DRAW { 5[1], 4[1] };
        TRANSITION from 5 to 4 if user clicks "Back to reports";
    }

    FRAGMENT "Denied return" {
        DRAW { 7[1], 4[1] };
        TRANSITION from 7 to 4 if user clicks "Back to reports";
    }
}
`;
