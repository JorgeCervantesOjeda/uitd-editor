// src/components/Canvas/TopToolbar/styles.ts
// Provides theme-aware shared styles for toolbar buttons and popup menus.

import type React from "react";

export const btn = ( enabled = true, accent = "#64748b", isDark = false ) => ( {
    padding: 6,
    borderRadius: 6,
    border: `1px solid ${enabled ? accent : ( isDark ? "#334155" : "#cbd5e1" )}`,
    background: enabled ? ( isDark ? "#1e293b" : "#f8fafc" ) : ( isDark ? "#172033" : "#f1f5f9" ),
    color: enabled ? ( isDark ? "#e2e8f0" : "#0f172a" ) : ( isDark ? "#64748b" : "#9ca3af" ),
    cursor: enabled ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
} );

export const menuWrap = ( isDark = false ): React.CSSProperties => ( {
    position: "absolute",
    top: "110%",
    left: 0,
    zIndex: 1000,
    background: isDark ? "#111827" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#0f172a",
    border: `1px solid ${isDark ? "#475569" : "#cbd5e1"}`,
    borderRadius: 8,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    padding: 6,
    minWidth: 130,
    overflow: "visible",
} );

export const menuItem: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
};
