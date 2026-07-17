// src/import/uitdl/officialValidator.ts
// Converts official UITDL validator diagnostics into editor parse issues.

import { parseUITDL as parseOfficialUITDL, type OfficialValidationMarker } from "uitdl-validator";
import type { ParseIssue } from "./types";

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
        return ( parsed.errors ?? [] ).map( markerToIssue );
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
