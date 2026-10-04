// src/validation/sharedUITDLRules.d.ts
// Public types for shared source-independent UITDL rules.

export type SharedTransition = {
    scope?: string;
    from: string;
    to: string;
    verb: string;
    complement: string;
    condition?: string | null;
};

export type DuplicateValue = {
    value: string;
    index: number;
    firstIndex: number;
};

export type TransitionAnalysis = {
    uniqueIndices: number[];
    duplicateIndices: number[];
    mixedActionGroups: Array<{ indices: number[] }>;
    multipleDestinationGroups: Array<{
        condition: string;
        destinations: string[];
        indices: number[];
    }>;
};

export function hasLeadingZeroUIID( value: string | number ): boolean;
export function leadingZeroUIIDMessage( value: string | number ): string;
export function isPositiveInteger( value: unknown ): boolean;
export function normalizeComparableText( value?: string | null ): string;
export function duplicateCaseSensitiveValues( values: string[] ): DuplicateValue[];
export function analyzeTransitionSet( transitions: SharedTransition[] ): TransitionAnalysis;
