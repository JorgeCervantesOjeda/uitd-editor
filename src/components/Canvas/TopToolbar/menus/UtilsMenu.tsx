// src/components/Canvas/TopToolbar/menus/UtilsMenu.tsx
// Renders miscellaneous canvas utility commands.

import React, { useMemo } from "react";
import { menuItem } from "../styles";
import { useAppStore } from "../../../../state/store";
import { buildFragmentGroups } from "../../../../fragments/fragmentModel";
import type { UniformColorKey, UniformTone } from "../../../../colors/colorMode";
import { UNIFORM_COLOR_KEYS, UNIFORM_TONES } from "../../../../colors/colorMode";

const colorLabels: Record<UniformColorKey, string> = {
    blue: "Blue",
    green: "Green",
    amber: "Amber",
    cyan: "Cyan",
    red: "Red",
    violet: "Violet",
    gray: "Gray",
};

const toneLabels: Record<UniformTone, string> = {
    light: "Light",
    dark: "Dark",
};

export function UtilsMenu() {
    const canvasDark = useAppStore( ( s ) => s.canvasDark );
    const toggleCanvasDark = useAppStore( ( s ) => s.toggleCanvasDark );
    const nodes = useAppStore( ( s ) => s.nodes );
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );
    const edges = useAppStore( ( s ) => s.edges );
    const selNodeCount = useAppStore( ( s ) => s.selection?.size ?? 0 );
    const selActsCount = useAppStore( ( s ) => s.selectionActions?.size ?? 0 );
    const selCondsCount = useAppStore( ( s ) => s.selectionConds?.size ?? 0 );
    const isCanvasLocked = useAppStore( ( s ) => s.isCanvasLockedByUITDLLiveSync );
    const colorMode = useAppStore( ( s ) => s.colorMode );
    const uniformColorKey = useAppStore( ( s ) => s.uniformColorKey );
    const uniformTone = useAppStore( ( s ) => s.uniformTone );
    const uniformIncludesActions = useAppStore( ( s ) => s.uniformIncludesActions );
    const uniformIncludesConditions = useAppStore( ( s ) => s.uniformIncludesConditions );
    const setColorMode = useAppStore( ( s ) => s.setColorMode );
    const setUniformColorKey = useAppStore( ( s ) => s.setUniformColorKey );
    const setUniformTone = useAppStore( ( s ) => s.setUniformTone );
    const setUniformIncludesActions = useAppStore( ( s ) => s.setUniformIncludesActions );
    const setUniformIncludesConditions = useAppStore( ( s ) => s.setUniformIncludesConditions );
    const selAny = selNodeCount + selActsCount + selCondsCount > 0;
    const isUniformColorMode = colorMode === "uniform";
    const countOfFragments = useMemo(
        () => buildFragmentGroups( { nodes, actions, conditions, edges } ).length,
        [ nodes, actions, conditions, edges ]
    );
    const canCompactFragments = !isCanvasLocked && countOfFragments >= 2;

    const recolorSelection = () => useAppStore.getState().recolorSelectionRandomly?.();
    const recolorAll = () => useAppStore.getState().recolorAllNodesRandomly?.();
    const compactFragments = () => useAppStore.getState().compactFragmentsToGrid();
    const clearAll = () => {
        const s = useAppStore.getState();
        s.resetProjectToBlank?.();
        s.clearSavedProject?.();
    };
    const fieldStyle: React.CSSProperties = {
        width: "100%",
        height: 28,
        borderRadius: 6,
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        color: "#0f172a",
        fontSize: 12,
    };
    const checkLabelStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: "#0f172a",
    };
    const disabledStyle = isCanvasLocked ? { opacity: 0.6 } : {};

    return (
        <div style={ { display: "grid", gap: 4 } }>
            <div
                role="group"
                aria-label="Color mode"
                style={ {
                    display: "grid",
                    gap: 6,
                    padding: "6px 8px",
                    borderBottom: "1px solid #e2e8f0",
                    ...disabledStyle,
                } }
            >
                <label style={ checkLabelStyle }>
                    <input
                        type="checkbox"
                        checked={ isUniformColorMode }
                        disabled={ isCanvasLocked }
                        onChange={ e => setColorMode( e.currentTarget.checked ? "uniform" : "random" ) }
                    />
                    Uniform UI color
                </label>

                { isUniformColorMode && (
                    <>
                        <select
                            aria-label="Uniform UI color"
                            disabled={ isCanvasLocked }
                            value={ uniformColorKey }
                            onChange={ e => setUniformColorKey( e.currentTarget.value as UniformColorKey ) }
                            style={ fieldStyle }
                        >
                            { UNIFORM_COLOR_KEYS.map( key => (
                                <option key={ key } value={ key }>{ colorLabels[ key ] }</option>
                            ) ) }
                        </select>

                        <select
                            aria-label="Uniform UI tone"
                            disabled={ isCanvasLocked }
                            value={ uniformTone }
                            onChange={ e => setUniformTone( e.currentTarget.value as UniformTone ) }
                            style={ fieldStyle }
                        >
                            { UNIFORM_TONES.map( tone => (
                                <option key={ tone } value={ tone }>{ toneLabels[ tone ] }</option>
                            ) ) }
                        </select>

                        <label style={ checkLabelStyle }>
                            <input
                                type="checkbox"
                                checked={ uniformIncludesActions }
                                disabled={ isCanvasLocked }
                                onChange={ e => setUniformIncludesActions( e.currentTarget.checked ) }
                            />
                            Apply to actions
                        </label>

                        <label style={ checkLabelStyle }>
                            <input
                                type="checkbox"
                                checked={ uniformIncludesConditions }
                                disabled={ isCanvasLocked }
                                onChange={ e => setUniformIncludesConditions( e.currentTarget.checked ) }
                            />
                            Apply to conditions
                        </label>
                    </>
                ) }
            </div>

            <button
                role="menuitem"
                onClick={ () => toggleCanvasDark() }
                title="Invert canvas background and edge color (screen only)"
                style={ menuItem }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3a9 9 0 0 0 0 18Z" />
                </svg>
                Canvas dark background: { canvasDark ? "On" : "Off" }
            </button>

            <button
                role="menuitem"
                disabled={ !canCompactFragments }
                onClick={ () => canCompactFragments && compactFragments() }
                title={
                    isCanvasLocked
                        ? "Turn off Live to canvas to compact fragments"
                        : countOfFragments >= 2
                            ? "Arrange fragments in a compact grid"
                            : "At least two fragments are required"
                }
                style={ { ...menuItem, ...( canCompactFragments ? {} : { opacity: 0.6 } ) } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                </svg>
                Compact fragments to grid
            </button>

            <button
                role="menuitem"
                disabled={ isCanvasLocked || !selAny }
                onClick={ () => !isCanvasLocked && selAny && recolorSelection() }
                title={ isCanvasLocked ? "Turn off Live to canvas to recolor items" : selAny ? "Recolor selected nodes by displayId" : "Select items first" }
                style={ { ...menuItem, ...( isCanvasLocked || !selAny ? { opacity: 0.6 } : {} ) } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1a2 2 0 0 0-2 2v1c0 1.8-1.2 3-3 3z" />
                    <circle cx="6.5" cy="11.5" r="1.5" /><circle cx="9.5" cy="7.5" r="1.5" />
                    <circle cx="14.5" cy="7.5" r="1.5" /><circle cx="17.5" cy="11.5" r="1.5" />
                </svg>
                Recolor selection by displayId
            </button>

            <button
                role="menuitem"
                disabled={ isCanvasLocked }
                onClick={ () => !isCanvasLocked && recolorAll() }
                title={ isCanvasLocked ? "Turn off Live to canvas to recolor items" : "Recolor all nodes by displayId" }
                style={ { ...menuItem, ...( isCanvasLocked ? { opacity: 0.6 } : {} ) } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3h18v18H3z" />
                    <path d="M3 12h18" />
                    <path d="M12 3v18" />
                </svg>
                Recolor ALL (global)
            </button>

            <button
                role="menuitem"
                disabled={ isCanvasLocked }
                onClick={ () => !isCanvasLocked && clearAll() }
                title={ isCanvasLocked ? "Turn off Live to canvas to delete the diagram" : "Delete all the diagram" }
                style={ { ...menuItem, color: "#b91c1c", ...( isCanvasLocked ? { opacity: 0.6 } : {} ) } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete all the diagram
            </button>
        </div>
    );
}
