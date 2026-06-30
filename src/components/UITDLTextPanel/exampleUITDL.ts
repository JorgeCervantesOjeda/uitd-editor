// src/components/UITDLTextPanel/exampleUITDL.ts
// Provides a compact, valid UITDL model for learning and experimentation.

export const EXAMPLE_UITDL = `UITD "Task flow" {
    UI 1 "Home" actions {
        clicks "Create task";
    }
    UI 2 "Task form" actions {
        submits "Task";
        clicks "Cancel";
    }
    UI 3 "Task saved" actions {
        clicks "Back home";
    }
    FRAGMENT "Task creation" {
        DRAW { 1, 2, 3 };
        TRANSITION from 1 to 2 if user clicks "Create task";
        TRANSITION from 2 to 3 if user submits "Task";
        TRANSITION from 2 to 1 if user clicks "Cancel";
        TRANSITION from 3 to 1 if user clicks "Back home";
    }
}
`;
