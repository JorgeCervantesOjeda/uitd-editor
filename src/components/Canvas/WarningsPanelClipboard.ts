// src/components/Canvas/WarningsPanelClipboard.ts
// Formats validation issues as clipboard-ready plain text.

import type { DiagramIssue, IssueRef } from "../../validation/diagramValidation";
import { DIAGNOSTIC_SOURCE_LABELS } from "../../validation/uitdlDiagnostics";

const refLabel = ( ref?: IssueRef ): string => {
    if ( !ref ) return "";
    switch ( ref.kind ) {
        case "node":
            return `UI ${ref.id}`;
        case "action":
            return `Action ${ref.id}`;
        case "condition":
            return `Condition ${ref.id}`;
        default:
            return "";
    }
};

const issueLineForClipboard = ( issue: DiagramIssue, indexOfIssue: number ): string => {
    const ref = issue.refLabel ?? refLabel( issue.ref );
    const fragment = issue.fragmentTitle ? `Fragment "${issue.fragmentTitle}"` : "";
    const details = [ ref, fragment ].filter( Boolean ).join( ", " );
    const location = details ? ` (${details})` : "";

    return `${indexOfIssue + 1}. [${issue.code}] ${issue.message}${location}`;
};

export const formatValidationIssuesForClipboard = ( issues: DiagramIssue[] ): string => {
    const errors = issues.filter( issue => issue.kind === "error" );
    const warnings = issues.filter( issue => issue.kind === "warning" );
    const lines = [
        "Validation report",
        `Source: ${DIAGNOSTIC_SOURCE_LABELS[ "canvas-model" ]}`,
        `Errors: ${errors.length}`,
        `Warnings: ${warnings.length}`,
        "",
        `Errors (${errors.length})`,
        ...( errors.length
            ? errors.map( issueLineForClipboard )
            : [ "- None" ] ),
        "",
        `Warnings (${warnings.length})`,
        ...( warnings.length
            ? warnings.map( issueLineForClipboard )
            : [ "- None" ] ),
    ];

    return lines.join( "\n" );
};
