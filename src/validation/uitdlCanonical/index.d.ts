// src/validation/uitdlCanonical/index.d.ts
// Public type surface for the project-owned UITDL validator.

export interface UITDLValidationMarker {
    severity: number;
    message: string;
    startLineNumber?: number;
    lineNumber?: number;
    startColumn?: number;
    endLineNumber?: number;
    endColumn?: number;
    code?: string;
}

export interface ParsedUITDL {
    name: string;
    errors: UITDLValidationMarker[];
    fragments?: Array<{
        name: string;
        line: number;
        endLineNumber?: number;
    }>;
}

export function parseUITDL( text: string ): ParsedUITDL;
