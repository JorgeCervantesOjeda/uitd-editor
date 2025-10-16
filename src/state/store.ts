// Estado global (Zustand) para el editor UITD.
// Mantiene la API pública original: exporta useAppStore, AppState, PendingConnect.

import { create } from "zustand";

// Re-export de tipos para no romper imports existentes
export type { AppState, PendingConnect } from "./types";

// Estado inicial
import { initialState } from "./initial";

// Slices
import { cameraSlice } from "./slices/camera.slice";
import { viewboxSlice } from "./slices/viewbox.slice";
import { selectionSlice } from "./slices/selection.slice";
import { createSlice } from "./slices/create.slice";
import { conditionsSlice } from "./slices/conditions.slice";
import { rubberbandSlice } from "./slices/rubberband.slice";
import { dragSlice } from "./slices/drag.slice";
import { editSlice } from "./slices/edit.slice";
import { colorsSlice } from "./slices/colors.slice";

import type { AppState as _AppState } from "./types";

// ...imports existentes...
import { nestingSlice } from "./slices/nesting.slice";

export const useAppStore = create<_AppState>()( ( set, get ) => ( {
    // --- estado base ---
    ...initialState,

    // --- cámara ---
    ...cameraSlice( set, get ),

    // --- viewBox ---
    ...viewboxSlice( set ),

    // --- selección ---
    ...selectionSlice( set, get ),

    // --- creación de entidades ---
    ...createSlice( set, get ),
    ...conditionsSlice( set, get ),

    // --- conexiones / rubber-banding ---
    ...rubberbandSlice( set, get ),

    // --- drag combinado ---
    ...dragSlice( set, get ),

    // --- edición ---
    ...editSlice( set, get ),

    // --- colores ---
    ...colorsSlice( set ),

    // --- anidamiento / layout / hover ---
    ...nestingSlice( set, get ),
} ) );
