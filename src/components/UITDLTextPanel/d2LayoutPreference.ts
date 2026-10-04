// Persists the D2 layout choice shared by the text and canvas flows.

import type { D2Layout } from "./renderD2";

const D2_LAYOUT_STORAGE_KEY = "uitd-editor/d2-layout";

function isD2Layout( value: string | null ): value is D2Layout {
    return value === "elk" || value === "dagre";
}

export function readD2LayoutPreference(): D2Layout {
    try {
        const storedLayout = window.localStorage.getItem( D2_LAYOUT_STORAGE_KEY );
        return isD2Layout( storedLayout ) ? storedLayout : "elk";
    } catch ( error ) {
        console.warn( "[D2 layout] Could not read the saved layout preference.", {
            cause: error,
            fallback: "Use ELK for this D2 panel.",
            impact: "The layout choice will not be restored in this browser context.",
        } );
        return "elk";
    }
}

export function writeD2LayoutPreference( layout: D2Layout ): void {
    try {
        window.localStorage.setItem( D2_LAYOUT_STORAGE_KEY, layout );
    } catch ( error ) {
        console.warn( "[D2 layout] Could not save the layout preference.", {
            cause: error,
            fallback: "Keep the selected layout for the current panel only.",
            impact: "The choice will not be shared with the other D2 flow after reopening.",
        } );
    }
}

export { D2_LAYOUT_STORAGE_KEY };
