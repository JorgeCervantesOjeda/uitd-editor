// src/components/Canvas/NodeEditDialog.tsx
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppStore } from "../../state/store";
import type { NodeId } from "../../state/types";
import { measureNodeSizeWithId } from "../../layout/measurement";
import { PAD_X, TITLE_LINE_H } from "../../model/types";
import {
    SAT_RANGE,
    LIGHT_RANGE_BG,
    LIGHT_RANGE_BORDER_LIGHT,
    hslToHex,
    forbidPair,
    pickDarkTextHexForBg,
} from "../../colors/palette";

type Hsl = { h: number; s: number; l: number };

function clamp( n: number, min: number, max: number ) {
    return Math.min( max, Math.max( min, n ) );
}
function normalizeHue( h: number ) {
    const x = h % 360;
    return x < 0 ? x + 360 : x;
}
function clampHsl( hsl: Hsl, sRange: [ number, number ], lRange: [ number, number ] ): Hsl {
    return {
        h: normalizeHue( hsl.h ),
        s: clamp( hsl.s, sRange[ 0 ], sRange[ 1 ] ),
        l: clamp( hsl.l, lRange[ 0 ], lRange[ 1 ] ),
    };
}
function hexToRgb( hex: string ) {
    const h = hex.replace( "#", "" ).trim();
    const full = h.length === 3 ? h.split( "" ).map( ( ch ) => ch + ch ).join( "" ) : h;
    const n = parseInt( full, 16 );
    if ( Number.isNaN( n ) ) return null;
    return { r: ( n >> 16 ) & 255, g: ( n >> 8 ) & 255, b: n & 255 };
}
function rgbToHsl( r: number, g: number, b: number ): Hsl {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max( rn, gn, bn );
    const min = Math.min( rn, gn, bn );
    const d = max - min;
    const l = ( max + min ) / 2;
    let h = 0;
    let s = 0;
    if ( d !== 0 ) {
        s = l > 0.5 ? d / ( 2 - max - min ) : d / ( max + min );
        switch ( max ) {
            case rn: h = ( ( gn - bn ) / d + ( gn < bn ? 6 : 0 ) ) * 60; break;
            case gn: h = ( ( bn - rn ) / d + 2 ) * 60; break;
            default: h = ( ( rn - gn ) / d + 4 ) * 60; break;
        }
    }
    return { h, s, l };
}
function hexToHsl( hex: string, fallback: Hsl ): Hsl {
    const rgb = hexToRgb( hex );
    if ( !rgb ) return fallback;
    return rgbToHsl( rgb.r, rgb.g, rgb.b );
}
function isForbiddenPair( bg: Hsl, bd: Hsl ) {
    return forbidPair( bg.h, bg.s, bg.l, bd.h, bd.s, bd.l );
}
function findAllowedBorder( bg: Hsl, bd: Hsl, sRange: [ number, number ], lRange: [ number, number ] ): Hsl | null {
    const base = clampHsl( bd, sRange, lRange );
    if ( !isForbiddenPair( bg, base ) ) return base;
    const step = 7;
    for ( let i = 1; i <= 36; i++ ) {
        const candA = { ...base, h: normalizeHue( base.h + i * step ) };
        if ( !isForbiddenPair( bg, candA ) ) return candA;
        const candB = { ...base, h: normalizeHue( base.h - i * step ) };
        if ( !isForbiddenPair( bg, candB ) ) return candB;
    }
    return null;
}
function ColorPickerRow( props: {
    label: string;
    valueHex: string;
    onPick: ( hex: string ) => void;
    extra?: ReactNode;
    warning?: string | null;
} ) {
    const { label, valueHex, onPick, extra, warning } = props;

    return (
        <div style={ { display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "start", gap: 8 } }>
            <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                { label }
            </span>
            <div style={ { display: "grid", gap: 8 } }>
                <div style={ { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } }>
                    <input
                        type="color"
                        value={ valueHex }
                        onChange={ ( e ) => onPick( e.target.value ) }
                        style={ { width: 30, height: 30, padding: 0, border: "1px solid #cbd5e1", borderRadius: 6 } }
                    />
                    { extra }
                </div>

                { warning ? (
                    <div style={ { fontSize: 11, color: "#b91c1c" } }>{ warning }</div>
                ) : null }
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

    const beginEditingSession = useAppStore( s => s.beginEditingSession );
    const commitEditingSession = useAppStore( s => s.commitEditingSession );

    const panelRef = useRef<HTMLFormElement | null>( null );
    const [ localDisplay, setLocalDisplay ] = useState<string>( "" );
    const [ localTitle, setLocalTitle ] = useState<string>( "" );
    const [ localWrap, setLocalWrap ] = useState<number>( 22 );
    const [ bgHsl, setBgHsl ] = useState<Hsl>( { h: 210, s: 0.2, l: 0.9 } );
    const [ borderHsl, setBorderHsl ] = useState<Hsl>( { h: 210, s: 0.2, l: 0.55 } );
    const [ borderWarning, setBorderWarning ] = useState<string | null>( null );

    // Iniciar / cerrar sesión de edición agrupada (solo nodos)
    useEffect( () => {
        if ( open && node ) {
            beginEditingSession( [ "nodes" ] );
        }
        return () => {
            if ( open && node ) {
                commitEditingSession();
            }
        };
    }, [ open, node?.id, beginEditingSession, commitEditingSession ] );

    // Sync locales
    useEffect( () => {
        if ( !open || !node ) return;

        const wantDisp = node.displayId ?? String( node.id );
        if ( wantDisp !== localDisplay ) setLocalDisplay( wantDisp );

        const wantTitle = node.title ?? "";
        if ( wantTitle !== localTitle ) setLocalTitle( wantTitle );

        setLocalWrap( node.wrap ?? 22 );

        const fillHex = node.colorFill ?? "#f1f5f9";
        const strokeHex = node.colorStroke ?? "#94a3b8";
        const nextBg = clampHsl( hexToHsl( fillHex, bgHsl ), SAT_RANGE, LIGHT_RANGE_BG );
        const rawBorder = hexToHsl( strokeHex, borderHsl );
        const nextBorder = clampHsl( rawBorder, SAT_RANGE, LIGHT_RANGE_BORDER_LIGHT );

        setBgHsl( nextBg );
        setBorderHsl( nextBorder );
        setBorderWarning( null );
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

    const applyBackground = ( next: Hsl ) => {
        const clamped = clampHsl( next, SAT_RANGE, LIGHT_RANGE_BG );
        setBgHsl( clamped );

        const lRange = LIGHT_RANGE_BORDER_LIGHT;
        const allowedBorder = findAllowedBorder( clamped, borderHsl, SAT_RANGE, lRange );
        const fillHex = hslToHex( clamped.h, clamped.s, clamped.l );
        const textHex = pickDarkTextHexForBg( clamped.h, clamped.s, clamped.l );

        if ( allowedBorder ) {
            setBorderWarning( null );
            const borderChanged =
                Math.abs( allowedBorder.h - borderHsl.h ) > 0.001 ||
                Math.abs( allowedBorder.s - borderHsl.s ) > 0.001 ||
                Math.abs( allowedBorder.l - borderHsl.l ) > 0.001;
            if ( borderChanged ) {
                setBorderHsl( allowedBorder );
                const strokeHex = hslToHex( allowedBorder.h, allowedBorder.s, allowedBorder.l );
                setNodeColors( node.id as NodeId, { fill: fillHex, stroke: strokeHex, text: textHex } );
                return;
            }
        } else {
            setBorderWarning( "La combinacion borde/fondo no esta permitida." );
        }

        setNodeColors( node.id as NodeId, { fill: fillHex, text: textHex } );
    };

    const applyBorder = ( next: Hsl ) => {
        const lRange = LIGHT_RANGE_BORDER_LIGHT;
        const allowed = findAllowedBorder( bgHsl, next, SAT_RANGE, lRange );
        if ( !allowed ) {
            setBorderWarning( "La combinacion borde/fondo no esta permitida." );
            return;
        }
        setBorderWarning( null );
        setBorderHsl( allowed );
        setNodeColors( node.id as NodeId, { stroke: hslToHex( allowed.h, allowed.s, allowed.l ) } );
    };

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

                    {/* Colors + preview (lado a lado) */ }
                    <div style={ { display: "flex", gap: 8, alignItems: "stretch" } }>
                        <div style={ { display: "grid", gap: 10, minWidth: 260 } }>
                            <div style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                                Colors
                            </div>

                            <ColorPickerRow
                                label="Background"
                                valueHex={ hslToHex( bgHsl.h, bgHsl.s, bgHsl.l ) }
                                onPick={ ( hex ) => applyBackground( hexToHsl( hex, bgHsl ) ) }
                            />

                            <ColorPickerRow
                                label="Border"
                                valueHex={ hslToHex( borderHsl.h, borderHsl.s, borderHsl.l ) }
                                onPick={ ( hex ) => applyBorder( hexToHsl( hex, borderHsl ) ) }
                                warning={ borderWarning }
                            />

                        </div>

                        {/* Preview (derecha, igual que diagrama) */ }
                        <div
                            style={ {
                                border: "1px dashed #cbd5e1",
                                borderRadius: 10,
                                padding: 12,
                                background: "#f8fafc",
                                flex: 1,
                            } }
                            tabIndex={ -1 }
                            onMouseDown={ ( e ) => e.preventDefault() }
                        >
                            <div style={ { fontSize: 11, color: "#64748b", marginBottom: 8 } } tabIndex={ -1 }>
                                Preview (diagram)
                            </div>
                            <svg
                                width={ Math.ceil( previewMeasure.w ) }
                                height={ Math.ceil( previewMeasure.h ) }
                                viewBox={ `0 0 ${previewMeasure.w} ${previewMeasure.h}` }
                                style={ { display: "block" } }
                            >
                                <rect
                                    x={ 0 }
                                    y={ 0 }
                                    width={ previewMeasure.w }
                                    height={ previewMeasure.h }
                                    rx={ 4 }
                                    ry={ 4 }
                                    fill={ hslToHex( bgHsl.h, bgHsl.s, bgHsl.l ) }
                                    stroke={ hslToHex( borderHsl.h, borderHsl.s, borderHsl.l ) }
                                    strokeWidth={ 4 }
                                />
                                <text
                                    x={ PAD_X }
                                    y={ 9 + 18 }
                                    style={ { fontSize: 18, fill: pickDarkTextHexForBg( bgHsl.h, bgHsl.s, bgHsl.l ) } }
                                >
                                    { previewMeasure.lines.map( ( line, i ) => (
                                        <tspan key={ i } x={ PAD_X } dy={ i === 0 ? 0 : TITLE_LINE_H }>
                                            { line }
                                        </tspan>
                                    ) ) }
                                </text>
                            </svg>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
