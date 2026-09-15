// src/validation/uitdlDiagnostics.ts
// Centralizes UITDL diagnostic codes, messages, severities, and source labels.

import type { UiVerb } from "../model/uiVerbs";

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticSource =
    | "uitdl-text"
    | "canvas-model"
    | "generated-uitdl";

export type DiagnosticCore = {
    kind: DiagnosticSeverity;
    code: string;
    message: string;
};

export const DIAGNOSTIC_SOURCE_LABELS: Record<DiagnosticSource, string> = {
    "uitdl-text": "UITDL text",
    "canvas-model": "Canvas model",
    "generated-uitdl": "Generated UITDL",
};

const quote = ( value: string | number ): string => `"${value}"`;

export const formatDiagnosticAction = ( verb: UiVerb | string, complement: string ): string =>
    `${verb} "${complement}"`;

export const invalidUiIdDiagnostic = ( uiId: string ): DiagnosticCore => ( {
    kind: "error",
    code: "invalid-uiid",
    message: `Invalid UIID "${uiId}": it must contain digits only (NUMBER).`,
} );

export const invalidWidthDiagnostic = ( target: string, width: unknown ): DiagnosticCore => ( {
    kind: "error",
    code: "invalid-width",
    message: `${target} has invalid WIDTH ${quote( String( width ) )}. WIDTH must be a positive integer.`,
} );

export const mixedConditionalTransitionDiagnostic = (
    uiId: string,
    verb: UiVerb | string,
    complement: string
): DiagnosticCore => ( {
    kind: "error",
    code: "nondeterministic-transition",
    message: `Action ${quote( formatDiagnosticAction( verb, complement ) )} from UI ${quote( uiId )} mixes conditional and unconditional transitions.`,
} );

export const multipleTransitionDestinationsDiagnostic = (
    uiId: string,
    verb: UiVerb | string,
    complement: string,
    condition: string | null
): DiagnosticCore => ( {
    kind: "error",
    code: "nondeterministic-transition",
    message: `Action ${quote( formatDiagnosticAction( verb, complement ) )} from UI ${quote( uiId )} has multiple destinations for ${condition ? `condition ${quote( condition )}` : "the unconditional branch"}.`,
} );

export const duplicateTransitionDiagnostic = (
    fromUiRef: string,
    toUiRef: string,
    verb: UiVerb | string,
    complement: string,
    condition: string | null
): DiagnosticCore => ( {
    kind: "error",
    code: "duplicate-transition",
    message: `Duplicate transition found from ${quote( fromUiRef )} to ${quote( toUiRef )}, action ${quote( formatDiagnosticAction( verb, complement ) )}${condition ? ` AND "${condition}"` : ""}.`,
} );

export const unusedActionDiagnostic = (
    uiId: string,
    verb: UiVerb | string,
    complement: string
): DiagnosticCore => ( {
    kind: "warning",
    code: "unused-action",
    message: `Unused action: ${quote( formatDiagnosticAction( verb, complement ) )} in UI ${quote( uiId )}.`,
} );

export const uiNoEffectiveOutgoingDiagnostic = ( uiId: string ): DiagnosticCore => ( {
    kind: "warning",
    code: "ui-no-effective-outgoing",
    message: `UI ${quote( uiId )} has no effective outgoing transitions.`,
} );

export function inferOfficialDiagnosticCode( message: string, markerCode?: string ): string {
    if ( markerCode ) return markerCode;
    if ( message === "Double space" ) return "style-double-space";
    if ( message === "There are no UIs defined." ) return "no-uis-defined";
    if ( message.startsWith( "Duplicate UI ID: " ) ) return "duplicate-ui-id";
    if ( message.startsWith( "Duplicate UI name: " ) ) return "duplicate-ui-name";
    if ( message.startsWith( "Duplicate fragment name: " ) ) return "duplicate-fragment-name";
    if ( message.startsWith( "Duplicate transition found from " ) ) return "duplicate-transition";
    if ( message.startsWith( "Undrawn UI " ) ) return "undrawn-transition-ui";
    if ( message.startsWith( 'Referenced "from" UI ' ) && message.endsWith( " does not exist." ) ) {
        return "missing-ui-reference";
    }
    if ( message.startsWith( 'Referenced "to" UI ' ) && message.endsWith( " does not exist." ) ) {
        return "missing-ui-reference";
    }
    if ( message.startsWith( "Referenced UI " ) && message.includes( " in DRAW does not exist." ) ) {
        return "missing-ui-reference";
    }
    if ( message.startsWith( "Unused action: " ) ) return "unused-action";
    if ( message.includes( " is not drawn in any fragment." ) ) return "ui-not-drawn";
    if ( message.includes( " has no effective outgoing transitions." ) ) return "ui-no-effective-outgoing";
    return "official-validator";
}
