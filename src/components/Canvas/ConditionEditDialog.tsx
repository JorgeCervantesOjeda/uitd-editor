// src/components/Canvas/ConditionEditDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { ConditionId } from "../../state/types";
import { measureConditionOval } from "../../layout/measurement";
import { TITLE_LINE_H } from "../../model/types";

export function ConditionEditDialog( props: {
    open: boolean;
    conditionId: number | null;
    onClose: () => void;
} ) {
    const { open, conditionId, onClose } = props;

    const cond = useAppStore( ( s ) =>
        conditionId != null ? s.conditions.find( ( c ) => c.id === conditionId ) ?? null : null
    );

    const editConditionMeta = useAppStore( ( s ) => s.editConditionMeta );

    const panelRef = useRef<HTMLFormElement | null>( null );
    const [ localTitle, setLocalTitle ] = useState<string>( "" );
    const [ localWrap, setLocalWrap ] = useState<number>( 22 );

    // Sync al abrir/cambiar condición
    useEffect( () => {
        if ( !open || !cond ) return;
        setLocalTitle( cond.title ?? "" );
        setLocalWrap( cond.wrap ?? 22 );
    }, [ open, cond?.id, cond?.title, cond?.wrap ] );

    // Cerrar por ESC (global)
    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            if ( e.key === "Escape" ) onClose();
        }
        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ onClose ] );

    const previewWrap = useMemo(
        () => Math.max( 6, Math.min( 80, Math.round( localWrap ) ) ),
        [ localWrap ]
    );

    const previewMeasure = useMemo(
        () => measureConditionOval( ( localTitle ?? "" ).trim(), previewWrap ),
        [ localTitle, previewWrap ]
    );

    if ( !open || cond == null ) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={ {
                position: "fixed",
                inset: 0,
                zIndex: 120,
                display: "grid",
                placeItems: "center",
                background: "rgba(15, 23, 42, 0.25)",
            } }
            // bloquear backdrop (no cerrar por click ni robar foco)
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
                    onClose(); // Enter = guardar y cerrar (ya aplicaste cambios)
                } }
                onKeyDown={ ( e ) => {
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
                // Evitar foco en elementos no editables dentro del form
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
                    gridTemplateColumns: "1fr",      // formulario arriba
                    gridTemplateRows: "auto auto",   // preview abajo
                    alignItems: "start",
                } }
                tabIndex={ -1 }
            >
                {/* Submit invisible para Enter */ }
                <button
                    type="submit"
                    tabIndex={ -1 }
                    aria-hidden="true"
                    style={ { position: "absolute", width: 0, height: 0, padding: 0, margin: 0, border: 0, opacity: 0 } }
                />

                {/* Encabezado (no enfocable) */ }
                <div style={ { fontWeight: 700, fontSize: 16 } } tabIndex={ -1 }>
                    Edit condition
                </div>

                {/* Campos */ }
                <div style={ { display: "grid", gap: 12 } }>
                    {/* Title — instant apply */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>Title</span>
                        <input
                            autoFocus
                            type="text"
                            value={ localTitle }
                            onChange={ ( e ) => {
                                const v = e.target.value;
                                setLocalTitle( v );
                                editConditionMeta( cond.id as ConditionId, { title: v } );
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 14,
                            } }
                            placeholder="Condition title"
                        />
                    </label>

                    {/* Wrap — instant apply */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>Wrap</span>
                        <input
                            type="number"
                            min={ 6 }
                            max={ 80 }
                            step={ 1 }
                            value={ localWrap }
                            onChange={ ( e ) => {
                                const n = Math.max( 6, Math.min( 80, Math.round( Number( e.target.value ) ) ) );
                                setLocalWrap( n );
                                editConditionMeta( cond.id as ConditionId, { wrap: n } );
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
                </div>

                {/* Preview (abajo, igual que diagrama) */ }
                <div
                    style={ {
                        border: "1px dashed #cbd5e1",
                        borderRadius: 10,
                        padding: 12,
                        background: "#f8fafc",
                        width: Math.ceil( previewMeasure.w ),
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
                            previewMeasure.lines.map( ( line, i ) => <div key={ i }>{ line }</div> )
                        ) : (
                            <div>&nbsp;</div>
                        ) }
                    </div>
                </div>
            </form>
        </div>
    );
}
