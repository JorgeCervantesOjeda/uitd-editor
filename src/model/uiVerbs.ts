// src/model/uiVerbs.ts
// Fuente única de verdad para verbos UITDL/UI.

export const UI_VERBS = [
    "clicks",
    "submits",
    "selects",
    "types",
    "toggles",
    "uploads",
    "downloads",
    "saves",
    "deletes",
    "waits",
] as const;

export type UiVerb = typeof UI_VERBS[ number ];

export function isUiVerb( x: string ): x is UiVerb {
    return ( UI_VERBS as readonly string[] ).includes( x );
}
