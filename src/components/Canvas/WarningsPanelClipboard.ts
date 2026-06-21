// src/components/Canvas/WarningsPanelClipboard.ts
// Formats validation issues as clipboard-ready plain text.

import type { DiagramIssue, IssueRef } from "../../validation/diagramValidation";

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
    const ref = refLabel( issue.ref );
    const details = [ ref, issue.fragmentId ].filter( Boolean ).join( ", " );
    const location = details ? ` (${details})` : "";

    return `${indexOfIssue + 1}. [${issue.code}] ${issue.message}${location}`;
};

export const formatValidationIssuesForClipboard = ( issues: DiagramIssue[] ): string => {
    const errors = issues.filter( issue => issue.kind === "error" );
    const warnings = issues.filter( issue => issue.kind === "warning" );
    const lines = [
        "Validation report",
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
