// src/fragments/compactFragmentGrid.ts
// Arranges fragment bounds in a compact grid while preserving each fragment's internal layout.

import type { FragmentBounds } from "./fragmentBounds";

export const FRAGMENT_GRID_GAP_X = 160;
export const FRAGMENT_GRID_GAP_Y = 140;
export const FRAGMENT_CELL_GAP_X = 72;
export const FRAGMENT_CELL_GAP_Y = 60;

export type FragmentGridPlacement = {
    id: string;
    x: number;
    y: number;
};

type PackedCellItem = {
    fragment: FragmentBounds;
    x: number;
    y: number;
};

type PackedCell = {
    fragments: FragmentBounds[];
    items: PackedCellItem[];
};

type PackedRow = {
    fragments: FragmentBounds[];
    w: number;
    h: number;
};

function countOfGridColumns( countOfCells: number ): number {
    return Math.max( 1, Math.ceil( Math.sqrt( countOfCells ) ) );
}

function topLeftSort( a: FragmentBounds, b: FragmentBounds ): number {
    return a.y - b.y || a.x - b.x || a.id.localeCompare( b.id );
}

function buildPackedRows(
    fragments: FragmentBounds[],
    cellWidth: number,
    cellHeight: number
): PackedRow[] | null {
    const rows: PackedRow[] = [];

    for ( const fragment of fragments ) {
        if ( fragment.w > cellWidth || fragment.h > cellHeight ) return null;

        const currentRow = rows[ rows.length - 1 ];
        if (
            currentRow &&
            currentRow.w + FRAGMENT_CELL_GAP_X + fragment.w <= cellWidth
        ) {
            currentRow.fragments.push( fragment );
            currentRow.w += FRAGMENT_CELL_GAP_X + fragment.w;
            currentRow.h = Math.max( currentRow.h, fragment.h );
        } else {
            rows.push( {
                fragments: [ fragment ],
                w: fragment.w,
                h: fragment.h,
            } );
        }

        const usedHeight = rows.reduce(
            ( total, row, index ) => total + row.h + ( index > 0 ? FRAGMENT_CELL_GAP_Y : 0 ),
            0
        );
        if ( usedHeight > cellHeight ) return null;
    }

    return rows;
}

function packFragmentsInCell(
    fragments: FragmentBounds[],
    cellWidth: number,
    cellHeight: number
): PackedCell | null {
    const rows = buildPackedRows( fragments, cellWidth, cellHeight );
    if ( !rows ) return null;

    const usedHeight = rows.reduce(
        ( total, row, index ) => total + row.h + ( index > 0 ? FRAGMENT_CELL_GAP_Y : 0 ),
        0
    );
    const items: PackedCellItem[] = [];
    let y = ( cellHeight - usedHeight ) / 2;

    for ( const row of rows ) {
        let x = ( cellWidth - row.w ) / 2;
        for ( const fragment of row.fragments ) {
            items.push( {
                fragment,
                x,
                y: y + ( row.h - fragment.h ) / 2,
            } );
            x += fragment.w + FRAGMENT_CELL_GAP_X;
        }
        y += row.h + FRAGMENT_CELL_GAP_Y;
    }

    return { fragments, items };
}

function buildPackedCells(
    fragments: FragmentBounds[],
    cellWidth: number,
    cellHeight: number
): PackedCell[] {
    const cells: PackedCell[] = [];

    for ( const fragment of fragments ) {
        let packed = false;

        for ( let index = 0; index < cells.length; index++ ) {
            const candidate = packFragmentsInCell(
                [ ...cells[ index ].fragments, fragment ],
                cellWidth,
                cellHeight
            );
            if ( !candidate ) continue;

            cells[ index ] = candidate;
            packed = true;
            break;
        }

        if ( !packed ) {
            const cell = packFragmentsInCell( [ fragment ], cellWidth, cellHeight );
            if ( cell ) {
                cells.push( cell );
            } else {
                console.warn( "[Fragments] Could not pack fragment into grid cell.", {
                    cause: "The fragment is larger than the computed maximum fragment cell.",
                    fallback: "Keeping the fragment in its own uncentered cell.",
                    impact: "The grid may leave more space around that fragment.",
                    fragmentId: fragment.id,
                } );
                cells.push( {
                    fragments: [ fragment ],
                    items: [ { fragment, x: 0, y: 0 } ],
                } );
            }
        }
    }

    return cells;
}

export function compactFragmentBoundsToGrid( fragments: FragmentBounds[] ): FragmentGridPlacement[] {
    if ( fragments.length === 0 ) return [];

    const sorted = [ ...fragments ].sort( topLeftSort );
    const cellWidth = Math.max( ...sorted.map( fragment => fragment.w ) );
    const cellHeight = Math.max( ...sorted.map( fragment => fragment.h ) );
    const cells = buildPackedCells( sorted, cellWidth, cellHeight );
    const countOfColumns = countOfGridColumns( cells.length );
    const minX = Math.min( ...sorted.map( fragment => fragment.x ) );
    const minY = Math.min( ...sorted.map( fragment => fragment.y ) );
    const placements: FragmentGridPlacement[] = [];

    for ( let index = 0; index < cells.length; index++ ) {
        const cell = cells[ index ];
        const columnIndex = index % countOfColumns;
        const rowIndex = Math.floor( index / countOfColumns );
        const cellX = minX + columnIndex * ( cellWidth + FRAGMENT_GRID_GAP_X );
        const cellY = minY + rowIndex * ( cellHeight + FRAGMENT_GRID_GAP_Y );

        for ( const item of cell.items ) {
            placements.push( {
                id: item.fragment.id,
                x: cellX + item.x,
                y: cellY + item.y,
            } );
        }
    }

    return placements;
}
