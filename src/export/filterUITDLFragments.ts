// src/export/filterUITDLFragments.ts
// Filters a complete UITDL export by whole fragment source-map ranges.

import type { UITDLExportResult } from "./uitdl";

export type UITDLFragmentSourceRange = {
    id: string;
    title?: string;
    lineNumber: number;
    endLineNumber: number;
};

export type UITDLFragmentSource = {
    text: string;
    fragments: UITDLFragmentSourceRange[];
};

export function filterUITDLSourceToSelectedFragments(
    source: UITDLFragmentSource,
    selectedFragmentIds: ReadonlySet<string>
): string {
    const selectedLocations = source.fragments.filter( fragment => selectedFragmentIds.has( fragment.id ) );
    const selectedLocationIds = new Set( selectedLocations.map( fragment => fragment.id ) );
    const missingFragmentIds = Array.from( selectedFragmentIds ).filter(
        fragmentId => !selectedLocationIds.has( fragmentId )
    );

    if ( missingFragmentIds.length > 0 ) {
        console.warn( "[UITDL export] Some selected fragments were not found in the complete export.", {
            cause: "The selection and exported UITDL source map do not describe the same fragment set.",
            fallback: "Abort fragment filtering instead of exporting an incomplete model.",
            impact: "No filtered UITDL is returned for a stale or inconsistent selection.",
            missingFragmentIds,
        } );
        throw new Error( "The selected fragments are no longer available in the UITDL export." );
    }

    const fragmentRanges = source.fragments.map( fragment => ( {
        startLineNumber: fragment.lineNumber,
        endLineNumber: fragment.endLineNumber,
    } ) );
    const selectedRanges = selectedLocations.map( fragment => ( {
        startLineNumber: fragment.lineNumber,
        endLineNumber: fragment.endLineNumber,
    } ) );
    const lines = source.text.split( "\n" );

    return lines
        .filter( ( _line, indexOfLine ) => {
            const lineNumber = indexOfLine + 1;
            const isSelectedFragmentLine = selectedRanges.some( range =>
                lineNumber >= range.startLineNumber && lineNumber <= range.endLineNumber
            );
            const isAnyFragmentLine = fragmentRanges.some( range =>
                lineNumber >= range.startLineNumber && lineNumber <= range.endLineNumber
            );
            return isSelectedFragmentLine || !isAnyFragmentLine;
        } )
        .join( "\n" );
}

export function filterUITDLToSelectedFragments(
    exported: UITDLExportResult,
    selectedFragmentIds: ReadonlySet<string>
): string {
    return filterUITDLSourceToSelectedFragments( {
        text: exported.text,
        fragments: exported.locations.fragments,
    }, selectedFragmentIds );
}
