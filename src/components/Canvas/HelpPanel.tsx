import { useEffect, useState } from "react";

export function HelpPanel( props: { defaultOpen?: boolean } = {} ) {
    const [ open, setOpen ] = useState<boolean>( props.defaultOpen ?? false );

    // Atajo: tecla "?" (Shift+/) para abrir/cerrar
    useEffect( () => {
        const onKey = ( e: KeyboardEvent ) => {
            // Shift+/ suele ser "?"
            if ( ( e.key === "?" || ( e.key === "/" && e.shiftKey ) ) && !e.repeat ) {
                e.preventDefault();
                setOpen( v => !v );
            }
        };
        window.addEventListener( "keydown", onKey );
        return () => window.removeEventListener( "keydown", onKey );
    }, [] );

    return (
        <div
            style={ {
                position: "fixed",
                left: 200,
                top: 12,
                zIndex: 4,
                pointerEvents: "none",
            } }
        >
            <button
                style={ {
                    pointerEvents: "auto",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 4px 16px rgba(2,6,23,.12)",
                    fontWeight: 600,
                    cursor: "pointer"
                } }
                onClick={ () => setOpen( v => !v ) }
                aria-expanded={ open }
                aria-controls="help-panel"
                title="Help (Shift+/)"
            >
                { open ? "Hide Help" : "Show Help" }
            </button>

            { open && (
                <div
                    id="help-panel"
                    style={ {
                        pointerEvents: "auto",
                        marginTop: 8,
                        width: 560,
                        maxHeight: "60vh",
                        overflow: "auto",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        boxShadow: "0 12px 36px rgba(2,6,23,.16)",
                        padding: 12,
                        color: "#0f172a",
                        lineHeight: 1.35
                    } }
                >
                    <div style={ { fontWeight: 700, marginBottom: 8, fontSize: 16 } }>
                        UITD Editor — Help
                    </div>

                    <ul style={ { margin: 0, paddingLeft: 18, display: "grid", gap: 6 } }>
                        { [
                            [ "Pan", <>hold <kbd>Ctrl</kbd> (or <kbd>⌘</kbd>) to show <i>grab</i>, then drag; or <b>middle click</b> and drag.</> ],
                            [ "Zoom", <>mouse wheel (zooms to pointer).</> ],
                            [ "Selection", <>left-drag on empty space draws a marquee. <kbd>Shift</kbd> adds/removes.</> ],
                            [ "Context menu", <>right-click on canvas, node, action, or condition.</> ],
                            [ "Create node", <>right-click canvas → “New node”.</> ],
                            [ "Edit node", <>double-click node (title, displayId, colors).</> ],
                            [ "Add action", <>right-click node → “Add action”.</> ],
                            [ "Add condition", <>right-click action → “Add condition”.</> ],
                            [ "Go to target", <>action/condition → “Go to target”, then click the destination node.</> ],
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
