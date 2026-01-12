// src/components/Canvas/NodeEditDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { NodeId } from "../../state/types";
import { measureNodeSizeWithId } from "../../layout/measurement";
import { TITLE_LINE_H } from "../../model/types";

type Swatch = string[];

/**
 * Paletas ampliadas (36–40 tonos aprox.) para que el grid 18xN se vea lleno.
 * BG: tonos claros / pastel (útiles de fondo)
 * BORDER: tonos medios/osc/acentos
 * TEXT: tonos legibles en fondo claro + algunos acentos
 */
const PALETTE_BG: Swatch = [
    // grises / slate / stone / zinc / neutral (200~300)
    "#f3f4f6", "#e5e7eb", "#e2e8f0", "#e7e5e4", "#e4e4e7", "#e5e5e5",
    // rojos / naranjas / ámbar / amarillos (100~200)
    "#fee2e2", "#fecaca", "#ffe4e6", "#ffd7d2", "#fed7aa", "#fde68a",
    // verdes / limes / esmeralda (100~200)
    "#dcfce7", "#bbf7d0", "#d9f99d", "#bef264", "#a7f3d0", "#ccfbf1",
    // azules / sky / cyan (100~200)
    "#dbeafe", "#bfdbfe", "#bae6fd", "#e0f2fe", "#cffafe", "#e0f7ff",
    // índigo / violeta / púrpura / fucsia / rosa (100~200)
    "#e0e7ff", "#c7d2fe", "#ede9fe", "#e9d5ff", "#f5d0fe", "#fce7f3",
    // extras suaves
    "#fff7ed", "#fafaf9",
];


const PALETTE_BORDER: Swatch = [
    // ✅ claros (útiles cuando el background es oscuro o para bordes sutiles)
    "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8",
    "#e5e7eb", "#d1d5db", "#9ca3af",
    "#fafaf9", "#e7e5e4", "#d6d3d1",

    // neutros y oscuros útiles para bordes
    "#64748b", "#334155", "#0f172a",
    "#6b7280", "#4b5563", "#111827",
    "#525252", "#3f3f46", "#0a0a0a",

    // acentos cálidos
    "#ef4444", "#dc2626", "#f97316", "#f59e0b", "#d97706", "#eab308",

    // acentos fríos
    "#22c55e", "#16a34a", "#059669", "#3b82f6", "#2563eb", "#1d4ed8",
    "#0ea5e9", "#06b6d4", "#10b981", "#14b8a6", "#06aed4", "#6366f1",
    "#8b5cf6", "#a855f7", "#d946ef", "#f43f5e",
];

const PALETTE_TEXT: Swatch = [
    // legibles
    "#0f172a", "#111827", "#1f2937", "#334155", "#374151", "#3f3f46",
    // acentos moderados para títulos
    "#2563eb", "#1d4ed8", "#0284c7",
    "#16a34a",
    "#6366f1", "#7c3aed", "#db2777", "#be185d", "#ef4444", "#dc2626",
];

function SwatchesRow( props: {
    label: string;
    value: string;
    options: Swatch;
    onPick: ( hex: string ) => void;
    size?: number;
    columns?: number; // cuántos por renglón (default 18)
} ) {
    const { label, value, options, onPick, size = 18, columns = 18 } = props;
    const cell = `${size}px`;

    return (
        <div style={ { display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "start", gap: 8 } }>
            <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                { label }
            </span>

            <div style={ { display: "grid", gridTemplateColumns: `repeat(${columns}, ${cell})`, gap: 6 } }>
                { options.map( ( hex ) => (
                    <button
                        key={ `${label}-${hex}` }
                        type="button"
                        tabIndex={ -1 }
                        onMouseDown={ ( e ) => e.preventDefault() } // no roba foco
                        onClick={ () => onPick( hex ) }
                        title={ hex }
                        style={ {
                            width: size,
                            height: size,
                            borderRadius: 4,
                            border: hex.toLowerCase() === value.toLowerCase()
                                ? "2px solid #0ea5e9"
                                : "1px solid #cbd5e1",
                            outline: "none",
                            padding: 0,
                            cursor: "pointer",
                            background: hex,
                        } }
                    />
                ) ) }

                {/* “More…” ocupa 3 celdas para que no rompa la rejilla visual */ }
                <div style={ { display: "inline-flex", alignItems: "center", gap: 6, gridColumn: `span 3` } }>
                    <label style={ { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" } } tabIndex={ -1 }
                        onMouseDown={ ( e ) => e.preventDefault() }>
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
        </div>
    );
}

export function NodeEditDialog( props: {
    open: boolean;
    nodeId: number | null;
    onClose: () => void;
} ) {
    const { open, nodeId, onClose } = props;

    const node = useAppStore( ( s ) =>
        nodeId != null ? s.nodes.find( ( n ) => n.id === nodeId ) ?? null : null
    );
    const editNodeMeta = useAppStore( ( s ) => s.editNodeMeta );
    const setNodeColors = useAppStore( ( s ) => s.setNodeColors );
    const nodesAll = useAppStore( ( s ) => s.nodes );

    const panelRef = useRef<HTMLFormElement | null>( null );
    const [ localDisplay, setLocalDisplay ] = useState<string>( "" );
    const [ localTitle, setLocalTitle ] = useState<string>( "" );
    const [ localWrap, setLocalWrap ] = useState<number>( 22 );

    // Sync locales
    useEffect( () => {
        if ( !open || !node ) return;

        const wantDisp = node.displayId ?? String( node.id );
        if ( wantDisp !== localDisplay ) setLocalDisplay( wantDisp );

        const wantTitle = node.title ?? "";
        if ( wantTitle !== localTitle ) setLocalTitle( wantTitle );

        setLocalWrap( node.wrap ?? 22 );
    }, [ open, node?.id, node?.displayId, node?.title, node?.wrap ] );

    // ESC global
    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            if ( e.key === "Escape" ) onClose();
        }
        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ onClose ] );

    // Medición / preview (igual que diagrama)
    const previewWrap = useMemo(
        () => Math.max( 6, Math.min( 80, Math.round( localWrap ) ) ),
        [ localWrap ]
    );
    const displayHeader = node?.displayId ?? node?.id ?? "";
    const previewMeasure = useMemo(
        () => measureNodeSizeWithId( displayHeader as any, localTitle ?? "", previewWrap ),
        [ displayHeader, localTitle, previewWrap ]
    );

    if ( !open || node == null ) return null;

    const fill = node.colorFill ?? "#f1f5f9";
    const stroke = node.colorStroke ?? "#94a3b8";
    const text = node.colorText ?? "#334155";

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={ {
                position: "fixed",
                inset: 0,
                zIndex: 100,
                display: "grid",
                placeItems: "center",
                background: "rgba(15, 23, 42, 0.25)",
            } }
            // bloquear backdrop: no cerrar por click afuera ni cambiar foco
            onMouseDown={ ( e ) => {
                if ( e.target === e.currentTarget ) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } }
            onKeyDown={ ( e ) => {
                if ( e.key === "Escape" ) {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose();
                }
            } }
        >
            <form
                ref={ panelRef }
                onPointerDown={ ( e ) => e.stopPropagation() }
                onSubmit={ ( e ) => {
                    e.preventDefault();
                    onClose(); // Enter guarda (ya aplicaste cambios) y cierra
                } }
                onKeyDown={ ( e ) => {
                    // Enter solo desde inputs
                    const tag = ( e.target as HTMLElement )?.tagName;
                    if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.ctrlKey &&
                        !e.altKey &&
                        !e.metaKey &&
                        tag === "INPUT"
                    ) {
                        e.preventDefault();
                        ( e.currentTarget as HTMLFormElement ).requestSubmit();
                    }
                } }
                // Evitar que clicks en áreas no editables roben foco
                onMouseDown={ ( e ) => {
                    const tag = ( e.target as HTMLElement )?.tagName;
                    if ( tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA" ) e.preventDefault();
                } }
                style={ {
                    width: 720,
                    maxWidth: "92vw",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 20px 60px rgba(2,6,23,.25)",
                    padding: 16,
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: "1fr",        // formulario arriba
                    gridTemplateRows: "auto auto",     // preview abajo
                    alignItems: "start",
                } }
                tabIndex={ -1 }
            >
                {/* submit invisible para Enter */ }
                <button
                    type="submit"
                    tabIndex={ -1 }
                    aria-hidden="true"
                    style={ { position: "absolute", width: 0, height: 0, padding: 0, margin: 0, border: 0, opacity: 0 } }
                />

                {/* Encabezado (no enfocable) */ }
                <div style={ { fontWeight: 700, fontSize: 16 } } tabIndex={ -1 }>
                    Edit node
                </div>

                {/* Campos */ }
                <div style={ { display: "grid", gap: 12 } }>
                    {/* Display ID — instant apply */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                            Display ID
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={ localDisplay }
                            onChange={ ( e ) => {
                                const raw = e.target.value;
                                setLocalDisplay( raw );
                                const key = raw.trim();
                                if ( key.length === 0 ) return;

                                const match = nodesAll.find(
                                    ( n ) => n.id !== node.id && ( ( n.displayId ?? "" ).trim() === key )
                                );
                                if ( match ) {
                                    const newTitle = match.title ?? "";
                                    setLocalTitle( newTitle );
                                    editNodeMeta( node.id as NodeId, { displayId: key, title: newTitle } );
                                } else {
                                    editNodeMeta( node.id as NodeId, { displayId: key } );
                                }
                            } }
                            onBlur={ () => {
                                const key = ( localDisplay ?? "" ).trim();
                                if ( key.length > 0 ) return;
                                const fallback = ( node.displayId?.trim().length ? node.displayId!.trim() : String( node.id ) );
                                editNodeMeta( node.id as NodeId, { displayId: fallback } );
                                setLocalDisplay( fallback );
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 14,
                            } }
                            placeholder="Unique ID (no spaces)"
                        />
                    </label>

                    {/* Title — instant apply */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                            Title
                        </span>
                        <input
                            type="text"
                            value={ localTitle }
                            onChange={ ( e ) => {
                                const v = e.target.value;
                                setLocalTitle( v );
                                editNodeMeta( node.id as NodeId, { title: v } );
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 14,
                            } }
                            placeholder="Node title"
                        />
                    </label>

                    {/* Wrap — instant apply */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                            Wrap
                        </span>
                        <input
                            type="number"
                            min={ 6 }
                            max={ 80 }
                            step={ 1 }
                            value={ localWrap }
                            onChange={ ( e ) => {
                                const n = Math.max( 6, Math.min( 80, Math.round( Number( e.target.value ) ) ) );
                                setLocalWrap( n );
                                editNodeMeta( node.id as NodeId, { wrap: n } );
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 14,
                                width: 140,
                            } }
                        />
                    </label>

                    {/* Colors: 3 filas con grid 18 columnas */ }
                    <div style={ { display: "grid", gap: 10 } }>
                        <div style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                            Colors
                        </div>

                        <SwatchesRow
                            label="Background"
                            value={ fill }
                            options={ PALETTE_BG }
                            onPick={ ( hex ) => setNodeColors( node.id as NodeId, { fill: hex } ) }
                            columns={ 20 }
                            size={ 20 }
                        />

                        <SwatchesRow
                            label="Border"
                            value={ stroke }
                            options={ PALETTE_BORDER }
                            onPick={ ( hex ) => setNodeColors( node.id as NodeId, { stroke: hex } ) }
                            columns={ 20 }
                            size={ 20 }
                        />

                        <SwatchesRow
                            label="Text"
                            value={ text }
                            options={ PALETTE_TEXT }
                            onPick={ ( hex ) => setNodeColors( node.id as NodeId, { text: hex } ) }
                            columns={ 20 }
                            size={ 20 }
                        />
                    </div>
                </div>

                {/* Preview (abajo, igual que diagrama) */ }
                <div
                    style={ {
                        border: "1px dashed #cbd5e1",
                        borderRadius: 10,
                        padding: 12,
                        background: "#f8fafc",
                        width: Math.ceil( previewMeasure.w ), // mismo ancho que mediría el nodo
                        justifySelf: "start",
                    } }
                    tabIndex={ -1 }
                    onMouseDown={ ( e ) => e.preventDefault() }
                >
                    <div style={ { fontSize: 11, color: "#64748b", marginBottom: 8 } } tabIndex={ -1 }>
                        Preview (diagram)
                    </div>
                    <div
                        style={ {
                            fontSize: 16,
                            lineHeight: `${TITLE_LINE_H}px`,
                            userSelect: "none",
                            whiteSpace: "pre-wrap",
                            wordBreak: "normal",
                            color: "#0f172a",
                            minHeight: TITLE_LINE_H * 2,
                        } }
                        tabIndex={ -1 }
                    >
                        { previewMeasure.lines.length ? (
                            previewMeasure.lines.map( ( ln, i ) => <div key={ i }>{ ln }</div> )
                        ) : (
                            <div>&nbsp;</div>
                        ) }
                    </div>
                </div>
            </form>
        </div>
    );
}
