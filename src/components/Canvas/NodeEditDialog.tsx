import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { NodeId } from "../../state/types";

type Swatch = string[];
const PALETTE_BG: Swatch = [
    "#f1f5f9", "#ffffff", "#fee2e2", "#ffedd5", "#fef9c3",
    "#dcfce7", "#e0f2fe", "#ede9fe", "#f3e8ff", "#f5f5f4"
];
const PALETTE_BORDER: Swatch = [
    "#94a3b8", "#0f172a", "#ef4444", "#f59e0b", "#eab308",
    "#22c55e", "#3b82f6", "#6366f1", "#a855f7", "#525252"
];
const PALETTE_TEXT: Swatch = [
    "#334155", "#0f172a", "#1f2937", "#111827", "#374151",
    "#2563eb", "#1d4ed8", "#dc2626", "#166534", "#0ea5e9"
];

function SwatchesRow( props: {
    label: string;
    value: string;
    options: Swatch;
    onPick: ( hex: string ) => void;
    size?: number;
} ) {
    const { label, value, options, onPick, size = 18 } = props;
    return (
        <div style={ { display: "flex", alignItems: "center", gap: 8 } }>
            <span style={ { width: 110, fontSize: 12, color: "#475569" } }>{ label }</span>
            <div style={ { display: "flex", gap: 6, flexWrap: "wrap" } }>
                { options.map( ( hex ) => (
                    <button
                        key={ hex }
                        type="button"
                        onClick={ () => onPick( hex ) }
                        title={ hex }
                        style={ {
                            width: size, height: size, borderRadius: 4,
                            border: hex.toLowerCase() === value.toLowerCase() ? "2px solid #0ea5e9" : "1px solid #cbd5e1",
                            outline: "none", padding: 0, cursor: "pointer",
                            background: hex
                        } }
                    />
                ) ) }
                {/* fallback nativo, pero ya no dependemos de él para cerrar */ }
                <label style={ { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" } }>
                    More…
                    <input
                        type="color"
                        value={ value }
                        onChange={ ( e ) => onPick( e.target.value ) }
                        style={ { width: size, height: size, padding: 0, border: "1px solid #cbd5e1", borderRadius: 4 } }
                    />
                </label>
            </div>
        </div>
    );
}

export function NodeEditDialog( props: {
    open: boolean;
    nodeId: number | null;
    onClose: () => void;
} ) {
    const { open, nodeId, onClose } = props;

    // Hooks SIEMPRE en el mismo orden
    const node = useAppStore( ( s ) =>
        nodeId != null ? s.nodes.find( ( n ) => n.id === nodeId ) ?? null : null
    );
    const editNodeMeta = useAppStore( ( s ) => s.editNodeMeta );
    const setNodeColors = useAppStore( ( s ) => s.setNodeColors );

    const panelRef = useRef<HTMLDivElement | null>( null );
    const [ localDisplay, setLocalDisplay ] = useState<string>( "" );
    const [ localTitle, setLocalTitle ] = useState<string>( "" );

    // Sincroniza estados locales al abrir/cambiar nodo (para inputs controlados)
    useEffect( () => {
        if ( !open || !node ) return;
        setLocalDisplay( node.displayId ?? String( node.id ) );
        setLocalTitle( node.title ?? "" );
    }, [ open, node?.id ] );

    // Cerrar por ESC
    useEffect( () => {
        function onKey( e: KeyboardEvent ) { if ( e.key === "Escape" ) onClose(); }
        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ onClose ] );

    // Cerrar al hacer click FUERA del panel (captura real en DOM)
    useEffect( () => {
        function onPointerDown( e: PointerEvent ) {
            if ( !open ) return;
            const el = panelRef.current;
            if ( !el ) return;
            const target = e.target as Node | null;
            if ( target && !el.contains( target ) ) onClose();
        }
        document.addEventListener( "pointerdown", onPointerDown, true );
        return () => document.removeEventListener( "pointerdown", onPointerDown, true );
    }, [ open, onClose ] );

    if ( !open || node == null ) return null;

    // Valores actuales (desde store) para mostrar selección en swatches
    const fill = node.colorFill ?? "#f1f5f9";
    const stroke = node.colorStroke ?? "#94a3b8";
    const text = node.colorText ?? "#334155";

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={ {
                position: "fixed", inset: 0, zIndex: 100,
                display: "grid", placeItems: "center",
                background: "rgba(15, 23, 42, 0.25)",
            } }
            // El backdrop soporta click para cerrar (además del listener global)
            onMouseDown={ ( e ) => { if ( e.target === e.currentTarget ) onClose(); } }
        >
            <div
                ref={ panelRef }
                onPointerDown={ ( e ) => e.stopPropagation() }
                style={ {
                    width: 460, maxWidth: "90vw",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 20px 60px rgba(2,6,23,.25)",
                    padding: 16, display: "grid", gap: 12
                } }
            >
                <div style={ { fontWeight: 700, fontSize: 16 } }>Edit node</div>

                {/* Display ID — instant apply */ }
                <label style={ { display: "grid", gap: 6 } }>
                    <span style={ { fontSize: 12, color: "#475569" } }>Display ID</span>
                    <input
                        autoFocus
                        type="text"
                        value={ localDisplay }
                        onChange={ ( e ) => {
                            const v = e.target.value;
                            setLocalDisplay( v );
                            editNodeMeta( node.id as NodeId, { displayId: v } );
                        } }
                        style={ {
                            padding: "8px 10px", borderRadius: 8,
                            border: "1px solid #cbd5e1", fontSize: 14,
                        } }
                        placeholder="Unique ID (no spaces)"
                    />
                </label>

                {/* Title — instant apply */ }
                <label style={ { display: "grid", gap: 6 } }>
                    <span style={ { fontSize: 12, color: "#475569" } }>Title</span>
                    <input
                        type="text"
                        value={ localTitle }
                        onChange={ ( e ) => {
                            const v = e.target.value;
                            setLocalTitle( v );
                            editNodeMeta( node.id as NodeId, { title: v } );
                        } }
                        style={ {
                            padding: "8px 10px", borderRadius: 8,
                            border: "1px solid #cbd5e1", fontSize: 14,
                        } }
                        placeholder="Node title"
                    />
                </label>

                {/* Colors — instant apply, sin depender del picker nativo */ }
                <div style={ { display: "grid", gap: 10 } }>
                    <div style={ { fontSize: 12, color: "#475569" } }>Colors</div>
                    <SwatchesRow
                        label="Background"
                        value={ fill }
                        options={ PALETTE_BG }
                        onPick={ ( hex ) => setNodeColors( node.id as NodeId, { fill: hex } ) }
                    />
                    <SwatchesRow
                        label="Border"
                        value={ stroke }
                        options={ PALETTE_BORDER }
                        onPick={ ( hex ) => setNodeColors( node.id as NodeId, { stroke: hex } ) }
                    />
                    <SwatchesRow
                        label="Text"
                        value={ text }
                        options={ PALETTE_TEXT }
                        onPick={ ( hex ) => setNodeColors( node.id as NodeId, { text: hex } ) }
                    />
                </div>
            </div>
        </div>
    );
}
