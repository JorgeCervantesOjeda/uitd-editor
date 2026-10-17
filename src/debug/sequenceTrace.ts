// src/debug/sequenceTrace.ts
// Emits redacted entry and exit events for approved boundary diagnostics.

const SEQUENCE_TRACE_STORAGE_KEY = "uitd-editor/sequence-trace-enabled";

export type SequenceTraceKind = "entry" | "exit";
export type SequenceTraceOutcome = "response" | "error" | "cancelled" | "no-response";

export interface SequenceTraceEvent {
    kind: SequenceTraceKind;
    correlationId: string;
    from: string;
    to: string;
    operation: string;
    outcome?: SequenceTraceOutcome;
    payload: Record<string, unknown>;
}

interface EmittedSequenceTraceEvent extends SequenceTraceEvent {
    sequence: number;
    timestamp: string;
}

let sequenceNumber = 0;
let correlationNumber = 0;
let enabledOverride: boolean | null = null;

function readConfiguredTraceState(): boolean {
    if ( enabledOverride != null ) return enabledOverride;

    try {
        return localStorage.getItem( SEQUENCE_TRACE_STORAGE_KEY ) !== "false";
    } catch ( error ) {
        console.warn( "[sequence-trace] Could not read trace configuration; emission remains enabled.", {
            cause: error instanceof Error ? error.message : String( error ),
            fallback: "Keep trace emission enabled.",
            impact: "Trace configuration could not be read.",
        } );
        return true;
    }
}

export function setSequenceTraceEnabled( enabled: boolean ): void {
    enabledOverride = enabled;

    try {
        localStorage.setItem( SEQUENCE_TRACE_STORAGE_KEY, String( enabled ) );
    } catch ( error ) {
        console.warn( "[sequence-trace] Could not persist trace configuration; using the current runtime value.", {
            cause: error instanceof Error ? error.message : String( error ),
            fallback: `Keep sequence tracing ${enabled ? "enabled" : "disabled"} for this runtime.`,
            impact: "Trace configuration will not survive this runtime.",
        } );
    }
}

export function createSequenceTraceCorrelationId( operation: string ): string {
    correlationNumber += 1;
    return `${operation}-${correlationNumber}`;
}

export function emitSequenceTrace( event: SequenceTraceEvent ): void {
    if ( !readConfiguredTraceState() ) return;

    const emittedEvent: EmittedSequenceTraceEvent = {
        ...event,
        sequence: ++sequenceNumber,
        timestamp: new Date().toISOString(),
    };

    console.info( "[sequence-trace]", emittedEvent );
}

export function resetSequenceTraceForTests(): void {
    sequenceNumber = 0;
    correlationNumber = 0;
    enabledOverride = null;
}
