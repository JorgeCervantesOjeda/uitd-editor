// src/import/uitdl/officialValidatorCaller.ts
// Calls the canonical project-owned UITDL validator and maps its diagnostics into editor parse issues.

import {
    parseUITDL as parseCanonicalUITDL,
    type UITDLValidationMarker,
} from "../../validation/uitdlCanonical";
import {
    inferOfficialDiagnosticCode,
    type DiagnosticSource,
} from "../../validation/uitdlDiagnostics";
import {
    createSequenceTraceCorrelationId,
    emitSequenceTrace,
} from "../../debug/sequenceTrace";
import type { ParseIssue } from "./types";

export interface ValidatorTraceContext {
    correlationId?: string;
    from?: string;
    to?: string;
    reason?: string;
}

function positiveMarkerPosition( value: number | undefined, fallback: number ) {
    if ( !Number.isFinite( value ) || value == null || value < 1 ) return fallback;
    return Math.floor( value );
}

function markerToIssue( marker: UITDLValidationMarker, source: DiagnosticSource ): ParseIssue {
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
    source: DiagnosticSource = "uitdl-text",
    traceContext: ValidatorTraceContext = {}
): ParseIssue[] {
    const operation = "callOfficialUITDLValidator";
    const correlationId = traceContext.correlationId ?? createSequenceTraceCorrelationId( operation );
    const tracePayload = {
        source,
        textLength: text.length,
        ...( traceContext.reason ? { reason: traceContext.reason } : {} ),
    };

    emitSequenceTrace( {
        kind: "entry",
        correlationId,
        from: traceContext.from ?? "UITDLTextPanel",
        to: traceContext.to ?? "UITDLCanonicalValidator",
        operation,
        payload: tracePayload,
    } );

    try {
        const parsed = parseCanonicalUITDL( text );
        const issues = ( parsed.errors ?? [] ).map( marker => markerToIssue( marker, source ) );
        emitSequenceTrace( {
            kind: "exit",
            correlationId,
            from: traceContext.to ?? "UITDLCanonicalValidator",
            to: traceContext.from ?? "UITDLTextPanel",
            operation,
            outcome: "response",
            payload: {
                ...tracePayload,
                issueCount: issues.length,
                errorCount: issues.filter( issue => issue.kind === "error" ).length,
                warningCount: issues.filter( issue => issue.kind === "warning" ).length,
            },
        } );
        return issues;
    } catch ( err ) {
        console.error( "UITDL validation failed; validation is blocked to avoid accepting an ambiguous model.", err );
        emitSequenceTrace( {
            kind: "exit",
            correlationId,
            from: traceContext.to ?? "UITDLCanonicalValidator",
            to: traceContext.from ?? "UITDLTextPanel",
            operation,
            outcome: "error",
            payload: {
                ...tracePayload,
                error: err instanceof Error ? err.message : String( err ),
            },
        } );
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
