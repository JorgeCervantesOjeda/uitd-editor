// src/import/uitdl/uiIdValidation.ts
// Provides shared UIID helpers for editor input guards and import parsing.

export function hasLeadingZeroUIID( value: string ): boolean {
    return /^0\d+$/.test( value );
}

export function leadingZeroUIIDMessage( value: string ): string {
    return `Invalid UIID "${value}": UI IDs must not contain leading zeros.`;
}
