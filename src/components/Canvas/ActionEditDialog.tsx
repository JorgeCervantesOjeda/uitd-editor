// src/components/Canvas/ActionEditDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { ActionId } from "../../state/types";
import type { UiVerb } from "../../model/uiVerbs";
import { UI_VERBS } from "../../model/uiVerbs";
import { buildActionTitle, validateComplement } from "../../utils/actionLabel";
import { measureActionOval } from "../../layout/measurement";
import { useDialogFocusTrap } from "./useDialogFocusTrap";
import { TITLE_LINE_H } from "../../model/types";

export function ActionEditDialog( props: {
    open: boolean;
    actionId: number | null;
    onClose: () => void;
} ) {
    const { open, actionId, onClose } = props;

    const action = useAppStore( ( s ) =>
        actionId != null ? s.actions.find( ( a ) => a.id === actionId ) ?? null : null
    );

    const editActionVerbComplement = useAppStore( ( s ) => s.editActionVerbComplement );
    const editActionMeta = useAppStore( ( s ) => s.editActionMeta ); // wrap/title

    const beginEditingSession = useAppStore( s => s.beginEditingSession );
    const commitEditingSession = useAppStore( s => s.commitEditingSession );
    const sessionStartedRef = useRef( false );

    const panelRef = useRef<HTMLFormElement | null>( null );
    useDialogFocusTrap( open, panelRef );

    const [ localVerb, setLocalVerb ] = useState<UiVerb>( "clicks" );
    const [ localComp, setLocalComp ] = useState<string>( "X" );
    const [ localWrap, setLocalWrap ] = useState<number>( 22 );
    const [ err, setErr ] = useState<string | null>( null );

    // Iniciar / cerrar sesión de edición agrupada para acciones
    useEffect( () => {
        if ( open && actionId != null && !sessionStartedRef.current ) {
            sessionStartedRef.current = true;
            beginEditingSession( [ "actions" ] );
        }
        return () => {
            if ( sessionStartedRef.current ) {
                sessionStartedRef.current = false;
                commitEditingSession();
            }
        };
    }, [ open, actionId, beginEditingSession, commitEditingSession ] );

    // Sync al abrir/cambiar acción
    useEffect( () => {
        if ( !open || !action ) return;
        setLocalVerb( action.verb ?? "clicks" );
        setLocalComp( action.complement ?? "" );
        setErr( null );
        setLocalWrap( action.wrap ?? 22 );
    }, [ open, action ] );

    const previewTitle = useMemo( () => {
        return buildActionTitle( localVerb ?? "clicks", ( localComp ?? "" ).trim() );
    }, [ localVerb, localComp ] );

    const previewWrap = useMemo(
        () => Math.max( 6, Math.min( 80, Math.round( localWrap ) ) ),
        [ localWrap ]
    );

    const previewMeasure = useMemo(
        () => measureActionOval( previewTitle, previewWrap ),
        [ previewTitle, previewWrap ]
    );

    if ( !open || !action ) return null;

    const applyIfValid = ( verb: UiVerb, comp: string ) => {
        const chk = validateComplement( comp );
        if ( !chk.ok ) {
            setErr( chk.reason );
            return false;
        }
        setErr( null );
        editActionVerbComplement( action.id as ActionId, verb, comp.trim() );
        return true;
    };

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
                    const ok = applyIfValid( localVerb, localComp );
                    if ( ok ) onClose(); // Enter = guardar y cerrar
                } }
                onKeyDown={ ( e ) => {
                    const tag = ( e.target as HTMLElement )?.tagName;
                    if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.ctrlKey &&
                        !e.altKey &&
                        !e.metaKey &&
                        ( tag === "INPUT" || tag === "SELECT" )
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
                    Edit action
                </div>

                {/* Campos */ }
                <div style={ { display: "grid", gap: 12 } }>
                    {/* Verb */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>Verb</span>
                        <select
                            value={ localVerb }
                            onChange={ ( e ) => {
                                const v = e.target.value as UiVerb;
                                setLocalVerb( v );
                                applyIfValid( v, localComp );
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                fontSize: 14,
                                background: "#fff",
                            } }
                        >
                            { UI_VERBS.map( ( v ) => (
                                <option key={ v } value={ v }>
                                    { v }
                                </option>
                            ) ) }
                        </select>
                    </label>

                    {/* Complement */ }
                    <label style={ { display: "grid", gap: 6 } }>
                        <span style={ { fontSize: 12, color: "#475569" } } tabIndex={ -1 }>
                            Complement (without quotes)
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={ localComp }
                            onChange={ ( e ) => {
                                const raw = e.target.value;
                                setLocalComp( raw );
                                applyIfValid( localVerb, raw );
                            } }
                            onBlur={ () => {
                                applyIfValid( localVerb, localComp );
                            } }
                            style={ {
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: err ? "1px solid #ef4444" : "1px solid #cbd5e1",
                                fontSize: 14,
                            } }
                            placeholder="Ej: Login"
                        />
                        { err && <div style={ { fontSize: 12, color: "#ef4444" } }>{ err }</div> }
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
                                editActionMeta( action.id as ActionId, { wrap: n } );
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
