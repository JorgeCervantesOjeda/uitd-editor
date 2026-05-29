import { useEffect, useRef, useState, type RefObject } from "react";

type Props = {
    triggerRef?: RefObject<HTMLButtonElement | null>;
};

export function HelpPanel( { triggerRef }: Props ) {
    const [ open, setOpen ] = useState( false );
    const [ openSection, setOpenSection ] = useState<string>( "Basics" );
    const panelRef = useRef<HTMLDivElement | null>( null );

    useEffect( () => {
        if ( !open ) return;

        function onPointerDown( e: PointerEvent ) {
            const target = e.target as Node | null;
            if ( !target ) return;
            if ( panelRef.current?.contains( target ) ) return;
            if ( triggerRef?.current?.contains( target ) ) return;
            setOpen( false );
        }

        function onKeyDown( e: KeyboardEvent ) {
            if ( e.key !== "Escape" ) return;
            e.preventDefault();
            setOpen( false );
            requestAnimationFrame( () => triggerRef?.current?.focus() );
        }

        document.addEventListener( "pointerdown", onPointerDown, true );
        document.addEventListener( "keydown", onKeyDown, true );
        return () => {
            document.removeEventListener( "pointerdown", onPointerDown, true );
            document.removeEventListener( "keydown", onKeyDown, true );
        };
    }, [ open, triggerRef ] );

    useEffect( () => {
        if ( !open ) return;
        const id = window.requestAnimationFrame( () => {
            const firstButton = panelRef.current?.querySelector<HTMLButtonElement>( '[data-help-section="true"]' );
            firstButton?.focus();
        } );
        return () => window.cancelAnimationFrame( id );
    }, [ open ] );

    const sections = [
        {
            title: "Basics",
            items: [
                [ "Context menus", "Right-click canvas/node/action/condition." ],
                [ "Create & edit", "New node from canvas menu; double-click items to edit." ],
                [ "Actions & conditions", "Add from menus; Go to target to connect to a node." ],
                [ "Retarget", "Right-click condition -> Go to target to change destination." ],
            ],
        },
        {
            title: "Selection & Drag",
            items: [
                [ "Selection", "Click to select; Shift+click toggles; drag empty space to marquee; Shift+marquee adds." ],
                [ "Drag & fine drag", "Drag selection to move; hold Shift for fine movement." ],
                [ "Nesting", "Drag a node over another to insert; container resizes automatically." ],
            ],
        },
        {
            title: "View",
            items: [
                [ "Pan & Zoom", "Ctrl/Cmd + drag or middle button to pan; wheel to zoom to pointer." ],
                [ "Canvas dark", "Utils menu -> toggle dark canvas background (screen only)." ],
            ],
        },
        {
            title: "Edit & Clipboard",
            items: [
                [ "Undo / Redo", "Ctrl/Cmd+Z / Ctrl/Cmd+Y (or Shift+Ctrl/Cmd+Z)." ],
                [ "Copy / Cut / Paste", "Ctrl/Cmd+C, X, V (paste to visible center)." ],
                [ "Delete & cancel", "Del/Backspace deletes; Esc closes menus and cancels go-to-target." ],
            ],
        },
        {
            title: "Tools",
            items: [
                [ "Recolor", "Utils menu -> recolor selection or all by displayId." ],
                [ "Align / Distribute", "Toolbar menus apply to current selection." ],
                [ "Export & Simulation", "Export SVG/PNG/UITDL; run layout forces (optional)." ],
                [ "Diagnostics", "Top-right panel shows warnings/errors; click an item to center it." ],
            ],
        },
    ] as const;
    return (
        <div style={ { position: "relative", display: "inline-block" } }>
            <button
                ref={ triggerRef }
                type="button"
                onClick={ () => setOpen( ( v ) => !v ) }
                title="Help (Alt+H)"
                aria-label="Help"
                aria-expanded={ open }
                aria-haspopup="dialog"
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
                    color: open ? "#2563eb" : "#64748b",
                } }
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </button>

            { open && (
                <div
                    ref={ panelRef }
                    role="dialog"
                    aria-modal="false"
                    aria-label="Help"
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
                        UITD Editor - Help
                    </div>

                    <a
                        href="https://notebooklm.google.com/notebook/1c4545e3-9271-4806-8629-fd51e3d34447"
                        target="_blank"
                        rel="noreferrer"
                        style={ {
                            display: "grid",
                            gap: 4,
                            padding: "10px 12px",
                            border: "1px solid #bfdbfe",
                            borderRadius: 8,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            textDecoration: "none",
                        } }
                    >
                        <span style={ { fontWeight: 800 } }>Ask NotebookLM</span>
                        <span style={ { color: "#1f2937", fontSize: 13 } }>
                            Open the project notebook to ask questions about the editor, source code, and documentation.
                        </span>
                    </a>

                    <div style={ { display: "grid", gap: 8 } }>
                        { sections.map( ( section ) => {
                            const isOpen = openSection === section.title;
                            return (
                                <div key={ section.title } style={ { border: "1px solid #e2e8f0", borderRadius: 8 } }>
                                    <button
                                        type="button"
                                        data-help-section="true"
                                        onClick={ () => setOpenSection( isOpen ? "" : section.title ) }
                                        aria-expanded={ isOpen }
                                        style={ {
                                            width: "100%",
                                            textAlign: "left",
                                            padding: "8px 10px",
                                            border: "none",
                                            background: "#f8fafc",
                                            borderRadius: 8,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        } }
                                    >
                                        { section.title }
                                    </button>
                                    { isOpen && (
                                        <ul style={ { margin: 0, padding: "8px 12px 10px 18px", display: "grid", gap: 6 } }>
                                            { section.items.map( ( [ label, desc ] ) => (
                                                <li key={ label }>
                                                    <span
                                                        style={ {
                                                            fontWeight: 800,
                                                            color: "#0b1220",
                                                            letterSpacing: "0.2px",
                                                            marginRight: 6,
                                                            display: "inline-block",
                                                            padding: "0 6px",
                                                            lineHeight: 1.4,
                                                            background: "#bfcdfb",
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
                                    ) }
                                </div>
                            );
                        } ) }
                    </div>
                </div>
            ) }
        </div>
    );
}
