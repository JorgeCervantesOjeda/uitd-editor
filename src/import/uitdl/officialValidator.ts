import { parseUITDL as parseOfficialUITDL, type OfficialValidationMarker } from "uitdl-validator";
import type { ParseIssue } from "./types";
import { validateTransitionDeterminism } from "./transitionDeterminism";

function markerToIssue( marker: OfficialValidationMarker ): ParseIssue {
    return {
        kind: marker.severity >= 8 ? "error" : "warning",
        message: marker.message,
        line: marker.startLineNumber ?? marker.lineNumber,
        col: marker.startColumn,
    };
}

export function validateWithOfficialValidator( text: string ): ParseIssue[] {
    try {
        const parsed = parseOfficialUITDL( text );
        const officialIssues = ( parsed.errors ?? [] ).map( markerToIssue );
        if ( officialIssues.some( issue => issue.kind === "error" ) ) return officialIssues;
        return [ ...officialIssues, ...validateTransitionDeterminism( text ) ];
    } catch ( err ) {
        console.error( "UITDL validation failed; validation is blocked to avoid accepting an ambiguous model.", err );
        return [
            {
                kind: "error",
                message: err instanceof Error ? err.message : String( err ),
            },
        ];
    }
}
