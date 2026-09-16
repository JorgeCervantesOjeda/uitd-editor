// src/colors/colorMode.ts
// Defines deterministic color-mode settings and palette assignment for new elements.

export type ColorMode = "random" | "uniform";
export type UniformColorKey = "blue" | "green" | "amber" | "cyan" | "red" | "violet" | "gray";
export type UniformTone = "light" | "dark";
export type ElementColorKind = "ui" | "action" | "condition";

export type ElementColors = {
    fill: string;
    stroke: string;
    text: string;
};

export type ColorModeSettings = {
    colorMode: ColorMode;
    uniformColorKey: UniformColorKey;
    uniformTone: UniformTone;
    uniformIncludesActions: boolean;
    uniformIncludesConditions: boolean;
};

export const DEFAULT_COLOR_MODE_SETTINGS: ColorModeSettings = {
    colorMode: "random",
    uniformColorKey: "blue",
    uniformTone: "light",
    uniformIncludesActions: false,
    uniformIncludesConditions: false,
};

export const UNIFORM_COLOR_KEYS: UniformColorKey[] = [
    "blue",
    "green",
    "amber",
    "cyan",
    "red",
    "violet",
    "gray",
];

export const UNIFORM_TONES: UniformTone[] = [ "light", "dark" ];

const RANDOM_UI_PALETTES: ElementColors[] = [
    { fill: "#dbeafe", stroke: "#2563eb", text: "#172554" },
    { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d" },
    { fill: "#fef3c7", stroke: "#d97706", text: "#78350f" },
    { fill: "#cffafe", stroke: "#0891b2", text: "#164e63" },
    { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d" },
    { fill: "#ede9fe", stroke: "#7c3aed", text: "#2e1065" },
    { fill: "#f1f5f9", stroke: "#64748b", text: "#0f172a" },
];

const UNIFORM_ELEMENT_PALETTES: Record<
    UniformColorKey,
    Record<UniformTone, Record<ElementColorKind, ElementColors>>
> = {
    blue: {
        light: {
            ui: { fill: "#dbeafe", stroke: "#2563eb", text: "#172554" },
            action: { fill: "#eff6ff", stroke: "#3b82f6", text: "#172554" },
            condition: { fill: "#f8fafc", stroke: "#60a5fa", text: "#172554" },
        },
        dark: {
            ui: { fill: "#1e3a8a", stroke: "#bfdbfe", text: "#eff6ff" },
            action: { fill: "#1d4ed8", stroke: "#dbeafe", text: "#eff6ff" },
            condition: { fill: "#0f172a", stroke: "#93c5fd", text: "#eff6ff" },
        },
    },
    green: {
        light: {
            ui: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d" },
            action: { fill: "#f0fdf4", stroke: "#22c55e", text: "#14532d" },
            condition: { fill: "#f8fafc", stroke: "#4ade80", text: "#14532d" },
        },
        dark: {
            ui: { fill: "#14532d", stroke: "#bbf7d0", text: "#f0fdf4" },
            action: { fill: "#166534", stroke: "#dcfce7", text: "#f0fdf4" },
            condition: { fill: "#052e16", stroke: "#86efac", text: "#f0fdf4" },
        },
    },
    amber: {
        light: {
            ui: { fill: "#fef3c7", stroke: "#d97706", text: "#78350f" },
            action: { fill: "#fffbeb", stroke: "#f59e0b", text: "#78350f" },
            condition: { fill: "#f8fafc", stroke: "#fbbf24", text: "#78350f" },
        },
        dark: {
            ui: { fill: "#78350f", stroke: "#fde68a", text: "#fffbeb" },
            action: { fill: "#92400e", stroke: "#fef3c7", text: "#fffbeb" },
            condition: { fill: "#451a03", stroke: "#fcd34d", text: "#fffbeb" },
        },
    },
    cyan: {
        light: {
            ui: { fill: "#cffafe", stroke: "#0891b2", text: "#164e63" },
            action: { fill: "#ecfeff", stroke: "#06b6d4", text: "#164e63" },
            condition: { fill: "#f8fafc", stroke: "#22d3ee", text: "#164e63" },
        },
        dark: {
            ui: { fill: "#164e63", stroke: "#a5f3fc", text: "#ecfeff" },
            action: { fill: "#155e75", stroke: "#cffafe", text: "#ecfeff" },
            condition: { fill: "#083344", stroke: "#67e8f9", text: "#ecfeff" },
        },
    },
    red: {
        light: {
            ui: { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d" },
            action: { fill: "#fef2f2", stroke: "#ef4444", text: "#7f1d1d" },
            condition: { fill: "#f8fafc", stroke: "#f87171", text: "#7f1d1d" },
        },
        dark: {
            ui: { fill: "#7f1d1d", stroke: "#fecaca", text: "#fef2f2" },
            action: { fill: "#991b1b", stroke: "#fee2e2", text: "#fef2f2" },
            condition: { fill: "#450a0a", stroke: "#fca5a5", text: "#fef2f2" },
        },
    },
    violet: {
        light: {
            ui: { fill: "#ede9fe", stroke: "#7c3aed", text: "#2e1065" },
            action: { fill: "#f5f3ff", stroke: "#8b5cf6", text: "#2e1065" },
            condition: { fill: "#f8fafc", stroke: "#a78bfa", text: "#2e1065" },
        },
        dark: {
            ui: { fill: "#4c1d95", stroke: "#ddd6fe", text: "#f5f3ff" },
            action: { fill: "#5b21b6", stroke: "#ede9fe", text: "#f5f3ff" },
            condition: { fill: "#2e1065", stroke: "#c4b5fd", text: "#f5f3ff" },
        },
    },
    gray: {
        light: {
            ui: { fill: "#f1f5f9", stroke: "#64748b", text: "#0f172a" },
            action: { fill: "#f8fafc", stroke: "#94a3b8", text: "#0f172a" },
            condition: { fill: "#ffffff", stroke: "#cbd5e1", text: "#0f172a" },
        },
        dark: {
            ui: { fill: "#334155", stroke: "#cbd5e1", text: "#f8fafc" },
            action: { fill: "#475569", stroke: "#e2e8f0", text: "#f8fafc" },
            condition: { fill: "#0f172a", stroke: "#94a3b8", text: "#f8fafc" },
        },
    },
};

export function isColorMode( value: unknown ): value is ColorMode {
    return value === "random" || value === "uniform";
}

export function isUniformColorKey( value: unknown ): value is UniformColorKey {
    return typeof value === "string" && UNIFORM_COLOR_KEYS.includes( value as UniformColorKey );
}

export function isUniformTone( value: unknown ): value is UniformTone {
    return value === "light" || value === "dark";
}

export function normalizedColorModeSettings( settings: Partial<ColorModeSettings> ): ColorModeSettings {
    return {
        colorMode: isColorMode( settings.colorMode ) ? settings.colorMode : DEFAULT_COLOR_MODE_SETTINGS.colorMode,
        uniformColorKey: isUniformColorKey( settings.uniformColorKey )
            ? settings.uniformColorKey
            : DEFAULT_COLOR_MODE_SETTINGS.uniformColorKey,
        uniformTone: isUniformTone( settings.uniformTone )
            ? settings.uniformTone
            : DEFAULT_COLOR_MODE_SETTINGS.uniformTone,
        uniformIncludesActions: typeof settings.uniformIncludesActions === "boolean"
            ? settings.uniformIncludesActions
            : DEFAULT_COLOR_MODE_SETTINGS.uniformIncludesActions,
        uniformIncludesConditions: typeof settings.uniformIncludesConditions === "boolean"
            ? settings.uniformIncludesConditions
            : DEFAULT_COLOR_MODE_SETTINGS.uniformIncludesConditions,
    };
}

export function colorsForNewElement(
    kind: ElementColorKind,
    settings: Partial<ColorModeSettings>,
    random: () => number = Math.random
): ElementColors | null {
    const normalized = normalizedColorModeSettings( settings );
    if ( normalized.colorMode === "uniform" ) {
        if ( kind === "action" && !normalized.uniformIncludesActions ) return null;
        if ( kind === "condition" && !normalized.uniformIncludesConditions ) return null;
        return UNIFORM_ELEMENT_PALETTES[ normalized.uniformColorKey ][ normalized.uniformTone ][ kind ];
    }

    if ( kind !== "ui" ) return null;
    const indexOfPalette = Math.min(
        RANDOM_UI_PALETTES.length - 1,
        Math.max( 0, Math.floor( random() * RANDOM_UI_PALETTES.length ) )
    );
    return RANDOM_UI_PALETTES[ indexOfPalette ];
}
