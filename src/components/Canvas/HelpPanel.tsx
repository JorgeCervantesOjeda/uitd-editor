import { useEffect, useState } from "react";


export function HelpPanel() {
    const [ open, setOpen ] = useState( false );
    return (
        <div style={ { position: "relative", display: "inline-block" } }>
            <button
                onClick={ () => setOpen( v => !v ) }
                title="Help"
                aria-label="Help"
                style={ {
                    padding: 6,
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                } }
            >
                {/* Icono: círculo con ? */ }
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </button>

            { open && (
                <div
                    style={ {
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        width: 360,
                        maxWidth: "80vw",
                        border: "1px solid #cbd5e1",
                        borderRadius: 10,
                        background: "#ffffff",
                        boxShadow: "0 8px 24px rgba(2,6,23,.18)",
                        padding: 12,
                        display: "grid",
                        gap: 8,
                        zIndex: 10,
                    } }
                >
                    <div style={ { fontWeight: 700, marginBottom: 8, fontSize: 16 } }>
                        UITD Editor — Help
                    </div>

                    <ul style={ { margin: 0, paddingLeft: 18, display: "grid", gap: 6 } }>
                        { [
                            [ "Create node", <>right-click canvas → “New node”.</> ],
                            [ "Edit node", <>double-click node (title, displayId, colors).</> ],
                            [ "Add action", <>right-click node → “Add action”.</> ],
                            [ "Add condition", <>right-click action → “Add condition”.</> ],
                            [ "Go to target", <>action/condition → “Go to target”, then click the destination node.</> ],
                            [ "Pan", <>hold <kbd>Ctrl</kbd> (or <kbd>⌘</kbd>) to show <i>grab</i>, then drag; or <b>middle click</b> and drag.</> ],
                            [ "Zoom", <>mouse wheel (zooms to pointer).</> ],
                            [ "Selection", <>left-drag on empty space draws a marquee. <kbd>Shift</kbd> adds/removes.</> ],
                            [ "Nesting", <>drag a node over another to insert; container resizes automatically.</> ],
                            [ "Drag groups", <>select multiple items and drag; nested children move with their parent.</> ],
                            [ "Diagnostics", <>top-right panel shows warnings/errors; click an item to center it.</> ],
                        ].map( ( [ label, desc ] ) => (
                            <li key={ String( label ) }>
                                <span
                                    style={ {
                                        fontWeight: 800,
                                        color: "#0b1220",          // más oscuro que el cuerpo
                                        letterSpacing: "0.2px",
                                        marginRight: 6,
                                        display: "inline-block",
                                        padding: "0 6px",
                                        lineHeight: 1.4,
                                        background: "#eef2ff",     // pill suave
                                        border: "1px solid #e2e8f0",
                                        borderRadius: 6,
                                    } }
                                >
                                    { label }
                                </span>
                                <span style={ { color: "#1f2937" } }>{ desc }</span>
                            </li>
                        ) ) }
                    </ul>

                    <div style={ { marginTop: 10, fontSize: 12, color: "#334155" } }>
                        Tip: Press <kbd>Shift</kbd> + <kbd>/</kbd> to toggle this Help.
                    </div>
                </div>
            ) }
        </div>
    );
}
