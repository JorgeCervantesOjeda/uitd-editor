// src/components/UITDLTextPanel/textDiagnosticsClipboard.ts
// Formats UITDL editor text and diagnostics as clipboard-ready plain text.

import type { ParseIssue } from "../../import/uitdl/types";

const issueLocationForClipboard = ( issue: ParseIssue ): string => {
    if ( issue.line == null ) return "General";
    return issue.col == null ? `L${issue.line}` : `L${issue.line}:C${issue.col}`;
};

const issueLineForClipboard = ( issue: ParseIssue, indexOfIssue: number ): string =>
    `${indexOfIssue + 1}. ${issueLocationForClipboard( issue )} ${issue.message}`;

export const formatUITDLTextWithDiagnosticsForClipboard = (
    text: string,
    issues: ParseIssue[]
): string => {
    if ( issues.length === 0 ) return text;

    const errors = issues.filter( issue => issue.kind === "error" );
    const warnings = issues.filter( issue => issue.kind === "warning" );
    const diagnostics = [
        "UITDL text diagnostics",
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
    ].join( "\n" );
    const separator = text.endsWith( "\n" ) ? "\n" : "\n\n";

    return `${text}${separator}${diagnostics}`;
};
