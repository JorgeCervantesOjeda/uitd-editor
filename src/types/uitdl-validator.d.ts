declare module "uitdl-validator" {
    export interface OfficialValidationMarker {
        severity: number;
        message: string;
        startLineNumber?: number;
        lineNumber?: number;
        startColumn?: number;
        endLineNumber?: number;
        endColumn?: number;
        code?: string;
    }

    export interface OfficialParsedUITDL {
        errors?: OfficialValidationMarker[];
    }

    export function parseUITDL( text: string ): OfficialParsedUITDL;
}
