// src/import/uitdl/officialValidatorCaller.ts
// Calls the official UITDL validator and maps its diagnostics into editor parse issues.

import { parseUITDL as parseOfficialUITDL, type OfficialValidationMarker } from "uitdl-validator";
import {
    inferOfficialDiagnosticCode,
    type DiagnosticSource,
} from "../../validation/uitdlDiagnostics";
import type { ParseIssue } from "./types";

function positiveMarkerPosition( value: number | undefined, fallback: number ) {
    if ( !Number.isFinite( value ) || value == null || value < 1 ) return fallback;
    return Math.floor( value );
}

function markerToIssue( marker: OfficialValidationMarker, source: DiagnosticSource ): ParseIssue {
    const line = positiveMarkerPosition( marker.startLineNumber ?? marker.lineNumber, 1 );
    const col = positiveMarkerPosition( marker.startColumn, 1 );
    return {
        kind: marker.severity >= 8 ? "error" : "warning",
        code: inferOfficialDiagnosticCode( marker.message, marker.code ),
        message: marker.message,
        line,
        col,
        source,
    };
}

export function callOfficialUITDLValidator(
    text: string,
    source: DiagnosticSource = "uitdl-text"
): ParseIssue[] {
    try {
        const parsed = parseOfficialUITDL( text );
        return ( parsed.errors ?? [] ).map( marker => markerToIssue( marker, source ) );
    } catch ( err ) {
        console.error( "UITDL validation failed; validation is blocked to avoid accepting an ambiguous model.", err );
        return [
            {
                kind: "error",
                code: "official-validator-runtime-error",
                message: err instanceof Error ? err.message : String( err ),
                source,
            },
        ];
    }
}
