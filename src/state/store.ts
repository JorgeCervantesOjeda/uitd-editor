// src/state/store.ts
import { create, type StateCreator } from "zustand";
import {
    persist,
    createJSONStorage,
    type PersistOptions,
} from "zustand/middleware";
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
import { distributeSlice } from "./slices/distribute.slice";
import { alignSlice } from "./slices/align.slice";

const PERSIST_KEY = "uitd-editor/appstate";
const PERSIST_VERSION = 1;

/**
 * Alias de tipos para forzar el overload React (2 args) de `persist`
 * sin usar `any`. Expone el segundo genérico de PersistOptions (PartializeT).
 */
const asReactPersist = persist as unknown as <
    T,
    PartializeT = T,
    Mps extends [] = [],
    Mcs extends [] = []
>(
    config: StateCreator<T, Mps, Mcs>,
    options: PersistOptions<T, PartializeT>
) => StateCreator<T, Mps, Mcs>;

/** Opciones de persistencia: partialize/migrate operan sobre Partial<AppState> */
const persistOptions: PersistOptions<AppState, Partial<AppState>> = {
    name: PERSIST_KEY,
    version: PERSIST_VERSION,
    storage: createJSONStorage( () => localStorage ),

    /**
     * Guardamos SOLO el “modelo de proyecto”.
     * (Zustand serializa a JSON; Set/Map se pierden: excluir efímeros.)
     */
    partialize: ( s ): Partial<AppState> => ( {
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
        // ❌ No guardar: selection*, drag, pendingConnect, dragHoverParent, etc.
    } ),

    /** Migraciones por versión (si cambias el shape) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    migrate: ( persistedState: unknown, _version: number ): Partial<AppState> => {
        if ( !persistedState ) return {};
        // Mantén este switch si alguna vez migras estructuras
        return persistedState as Partial<AppState>;
    },
};

export const useAppStore = create<AppState>()(
    asReactPersist<AppState, Partial<AppState>, [], []>(
        ( set, get, _api ) => ( {
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
            ...rubberbandSlice( set, get, _api ),
            ...historySlice( set, get ),

            // Distribución (pasa _api si el slice está tipado como StateCreator)
            ...distributeSlice( set, get, _api ),
            ...alignSlice( set, get, _api ),

            // ✅ Utilidades opcionales para el usuario/menú
            resetProjectToBlank: () => {
                const s = useAppStore.getState();

                // Sólo claves que existan en HistoryKey:
                s.captureDelta?.(
                    [ "nodes", "actions", "conditions", "edges" ], // agrega "panzoom", "viewBox" si están en HistoryKey
                    () => {
                        set( () => ( {
                            // Modelo (sí queda en el historial)
                            nodes: [],
                            actions: [],
                            conditions: [],
                            edges: [],

                            // Estado efímero (no está en HistoryKey, pero igual lo limpiamos)
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
                    }
                );
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
        persistOptions
    )
);
