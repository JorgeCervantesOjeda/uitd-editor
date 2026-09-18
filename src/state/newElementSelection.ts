// src/state/newElementSelection.ts
// Selects one created element without expanding to related elements or descendants.

import type { AppState, DiagramFocusTarget } from "./types";

export function newElementSelection( target: NonNullable<DiagramFocusTarget> ): Pick<
    AppState, "selection" | "selectionActions" | "selectionConds" | "focusTarget" | "keyboardMarquee" | "marqueeSeed"
> {
    return {
        selection: new Set( target.kind === "node" ? [ target.id ] : [] ),
        selectionActions: new Set( target.kind === "action" ? [ target.id ] : [] ),
        selectionConds: new Set( target.kind === "condition" ? [ target.id ] : [] ),
        focusTarget: target,
        keyboardMarquee: null,
        marqueeSeed: null,
    };
}
