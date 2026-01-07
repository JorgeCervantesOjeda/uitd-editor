// src/components/Canvas/ConditionEditDialog.tsx
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { ConditionId } from "../../state/types";
import { measureActionOval } from "../../layout/measurement";
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

    const panelRef = useRef<HTMLDivElement | null>( null );
    const [ localTitle, setLocalTitle ] = useState<string>( "" );
    const [ localWrap, setLocalWrap ] = useState<string>( "22" );

    // Sync al abrir/cambiar condición
    useEffect( () => {
        if ( !open || !cond ) return;
        setLocalTitle( cond.title ?? "" );
        setLocalWrap( String( cond.wrap ?? 22 ) );
    }, [ open, cond?.id, cond?.title, cond?.wrap ] );

    // Cerrar por ESC
    useEffect( () => {
        function onKey( e: KeyboardEvent ) { if ( e.key === "Escape" ) onClose(); }
        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ onClose ] );

    // Cerrar al click fuera
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

    if ( !open || cond == null ) return null;

    const wrapPreview = ( () => {
        const n = Number( localWrap );
        if ( !Number.isFinite( n ) ) return 22;
        return Math.max( 6, Math.min( 80, Math.round( n ) ) );
    } )();

    const m = measureActionOval( ( localTitle ?? "" ).trim(), wrapPreview );

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
            onMouseDown={ ( e ) => {
                if ( e.target === e.currentTarget ) onClose();
            } }
        >
            <form
                ref={ panelRef as any }
                onPointerDown={ ( e ) => e.stopPropagation() }
                onSubmit={ ( e ) => {
                    e.preventDefault();
                    onClose();
                } }
                onKeyDown={ ( e ) => {
                    // Enter en inputs de texto => submit
                    if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.ctrlKey &&
                        !e.altKey &&
                        !e.metaKey &&
                        ( e.target as HTMLElement )?.tagName === "INPUT"
                    ) {
                        e.preventDefault();
                        ( e.currentTarget as HTMLFormElement ).requestSubmit();
                    }
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

                    // ✅ 2 columnas: form / preview (preview NO afecta layout de captura)
                    gridTemplateColumns: "1fr 260px",
                    alignItems: "start",
                } }
            >
                {/* Submit invisible para Enter */ }
                <button
                    type="submit"
                    tabIndex={ -1 }
                    aria-hidden="true"
                    style={ {
                        position: "absolute",
                        width: 0,
                        height: 0,
                        padding: 0,
                        margin: 0,
                        border: 0,
                        opacity: 0,
                    } }
                />

                {/* Columna izquierda: campos */ }
                <div style={ { display: "grid", gap: 12 } }>
                    <div style={ { fontWeight: 700, fontSize: 16 } }>Edit condition</div>

                    {/* Title — instant apply */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } }>Title</span>
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
                        <span style={ { fontSize: 12, color: "#475569" } }>Wrap</span>
                        <input
                            type="number"
                            value={ localWrap }
                            onChange={ ( e ) => {
                                const raw = e.target.value;
                                setLocalWrap( raw );
                                const n = Number( raw );
                                if ( Number.isFinite( n ) ) {
                                    editConditionMeta( cond.id as ConditionId, {
                                        wrap: Math.max( 6, Math.min( 80, Math.round( n ) ) ),
                                    } );
                                }
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 14,
                                width: 140,
                            } }
                            min={ 6 }
                            max={ 80 }
                        />
                    </label>
                </div>

                {/* Columna derecha: preview (independiente) */ }
                <div
                    style={ {
                        border: "1px dashed #cbd5e1",
                        borderRadius: 10,
                        padding: 12,
                        background: "#f8fafc",
                    } }
                >
                    <div style={ { fontSize: 11, color: "#64748b", marginBottom: 8 } }>
                        Preview (diagram)
                    </div>

                    <div
                        style={ {
                            fontSize: 16, // igual que en el SVG
                            lineHeight: `${TITLE_LINE_H}px`,
                            userSelect: "none",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            color: "#0f172a",
                            minHeight: TITLE_LINE_H * 2,
                        } }
                    >
                        { m.lines.length ? (
                            m.lines.map( ( line, i ) => <div key={ i }>{ line }</div> )
                        ) : (
                            <div>&nbsp;</div>
                        ) }
                    </div>
                </div>
            </form>
        </div>
    );
}
