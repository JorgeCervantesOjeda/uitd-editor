// src/state/store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppState, NodeId, ActionId, ConditionId } from "./types";

import { initialState } from "./initial";
import { cameraSlice } from "./slices/camera.slice";
import { viewboxSlice } from "./slices/viewbox.slice";
import { selectionSlice } from "./slices/selection.slice";
import { createSlice } from "./slices/create.slice";
import { conditionsSlice } from "./slices/conditions.slice";
import { dragSlice } from "./slices/drag.slice";
import { editSlice } from "./slices/edit.slice";
import { colorsSlice } from "./slices/colors.slice";
import { nestingSlice } from "./slices/nesting.slice";
import { rubberbandSlice } from "./slices/rubberband.slice";
import { historySlice } from "./slices/history.slice";

const PERSIST_KEY = "uitd-editor/appstate";
const PERSIST_VERSION = 1;

export const useAppStore = create<AppState>()(
    persist(
        ( set, get ) => ( {
            // --- Estado base (no efímero) ---
            ...initialState,

            // --- Slices (lógica/acciones) ---
            ...cameraSlice( set, get ),
            ...viewboxSlice( set, get ),
            ...selectionSlice( set, get ),
            ...createSlice( set, get ),
            ...conditionsSlice( set, get ),
            ...dragSlice( set, get ),
            ...editSlice( set, get ),
            ...colorsSlice( set, get ),
            ...nestingSlice( set, get ),
            ...rubberbandSlice( set, get ),
            ...historySlice( set, get ),

            // ✅ Utilidades opcionales para el usuario/menú
            resetProjectToBlank: () => {
                set( () => ( {
                    nodes: [],
                    actions: [],
                    conditions: [],
                    edges: [],

                    selection: new Set<NodeId>(),
                    selectionActions: new Set<ActionId>(),
                    selectionConds: new Set<ConditionId>(),

                    drag: {
                        active: false,
                        anchor: { x: 0, y: 0 },
                        startNodes: new Map(),
                        startActions: new Map(),
                        startConds: new Map(),
                    },
                    pendingConnect: null,
                    dragHoverParent: null,
                } ) );
            },
            clearSavedProject: () => {
                try {
                    localStorage.removeItem( PERSIST_KEY );
                    // No tocamos el estado actual del store; sólo vaciamos el persistido.
                } catch ( err ) {
                    console.warn( "[persist] clearSavedProject error:", err );
                }
            },
        } ),
        {
            name: PERSIST_KEY,
            version: PERSIST_VERSION,
            storage: createJSONStorage( () => localStorage ),
            /**
             * Guardamos SOLO el “modelo de proyecto”.
             * (Zustand serializa a JSON, así que Set/Map se pierden: excluir estado efímero.)
             */
            partialize: ( s ) => ( {
                // Proyecto (modelo)
                nodes: s.nodes,
                actions: s.actions,
                conditions: s.conditions,
                edges: s.edges,

                // Contadores
                nextId: s.nextId,
                nextActionId: s.nextActionId,
                nextEdgeId: s.nextEdgeId,

                // Vista
                panzoom: s.panzoom,
                viewBox: s.viewBox,

                // (Los colores están dentro de nodes; no hay que duplicar)
                // ❌ No guardar: selection*, drag, pendingConnect, dragHoverParent, etc.
            } ),
            /**
             * Migraciones por versión (si cambias el shape).
             * Retorna el objeto migrado.
             */
            migrate: ( persisted, version ) => {
                if ( !persisted ) return persisted;
                switch ( version ) {
                    // Ejemplo (si alguna vez cambias claves):
                    // case 0:
                    //   return { ...persisted, viewBox: persisted.viewbox ?? persisted.viewBox };
                    default:
                        return persisted;
                }
            },
        }
    )
);
