import type React from "react";

// Estilos compartidos, sin fondos oscuros ni texto claro
export const btn = ( enabled = true, accent = "#64748b" ) => ( {
    padding: 6,
    borderRadius: 6,
    border: `1px solid ${enabled ? accent : "#cbd5e1"}`,
    background: enabled ? "#f8fafc" : "#f1f5f9",
    color: enabled ? "#0f172a" : "#9ca3af",
    cursor: enabled ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
} );

export const menuWrap: React.CSSProperties = {
    position: "absolute",
    top: "110%",
    left: 0,
    zIndex: 1000,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    padding: 6,
    minWidth: 130,
    overflow: "visible",
};

export const menuItem: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
};
