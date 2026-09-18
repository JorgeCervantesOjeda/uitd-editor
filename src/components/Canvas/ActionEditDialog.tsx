// src/components/Canvas/ActionEditDialog.tsx
// Edits element content and colors; text width is adjusted by dragging the preview edge.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import { trimElementText } from "../../state/trimElementText";
import type { ActionId } from "../../state/types";
import type { UiVerb } from "../../model/uiVerbs";
import { UI_VERBS } from "../../model/uiVerbs";
import { validateComplement } from "../../utils/actionLabel";
import { measureActionOval } from "../../layout/measurement";
import { useDialogFocusTrap } from "./useDialogFocusTrap";
import { ElementWidthPreview } from "./ElementWidthPreview";

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

    const beginEditingSession = useAppStore( s => s.beginEditingSession );
    const commitEditingSession = useAppStore( s => s.commitEditingSession );
    const sessionStartedRef = useRef( false );

    const panelRef = useRef<HTMLFormElement | null>( null );

    const [ localVerb, setLocalVerb ] = useState<UiVerb>( "clicks" );
    const [ localComp, setLocalComp ] = useState<string>( "X" );
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
    useLayoutEffect( () => {
        if ( !open || actionId == null ) return;
        const currentAction = useAppStore.getState().actions.find( ( a ) => a.id === actionId );
        if ( !currentAction ) return;
        setLocalVerb( currentAction.verb ?? "clicks" );
        setLocalComp( currentAction.complement ?? "" );
        setErr( null );
    }, [ open, actionId ] );

    const previewTitle = useMemo( () => {
        return `${localVerb ?? "clicks"} "${localComp ?? ""}"`;
    }, [ localVerb, localComp ] );

    const previewWrap = action?.wrap ?? 22;

    const previewMeasure = useMemo(
        () => measureActionOval( previewTitle, previewWrap ),
        [ previewTitle, previewWrap ]
    );

    const applyIfValid = ( verb: UiVerb, comp: string, trimOnSave = false ) => {
        if ( action == null ) return false;
        const chk = validateComplement( comp );
        if ( !chk.ok ) {
            setErr( chk.reason );
            return false;
        }
        setErr( null );
        const complement = trimOnSave ? comp.trim() : comp;
        if ( verb !== action.verb || complement !== action.complement ) {
            if ( trimOnSave && verb === action.verb && complement === action.complement.trim() ) {
                trimElementText( { kind: "action", id: action.id } );
            } else editActionVerbComplement( action.id as ActionId, verb, complement );
        }
        return true;
    };

    const closeAndNormalize = () => {
        if ( action == null ) {
            onClose();
            return;
        }
        const chk = validateComplement( localComp );
        if ( chk.ok ) applyIfValid( localVerb, localComp, true );
        onClose();
    };

    useDialogFocusTrap( open, panelRef, { onEscape: closeAndNormalize } );

    if ( !open || !action ) return null;

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
                if ( e.target === e.currentTarget ) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeAndNormalize();
                }
            } }
        >
            <form
                ref={ panelRef }
                onPointerDown={ ( e ) => e.stopPropagation() }
                onSubmit={ ( e ) => {
                    e.preventDefault();
                    const ok = applyIfValid( localVerb, localComp, true );
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
                            placeholder="Example: Login"
                        />
                        { err && <div style={ { fontSize: 12, color: "#ef4444" } }>{ err }</div> }
                    </label>

                    <p style={ { fontSize: 12, color: "#475569" } }>Drag the right edge in the preview to adjust text wrapping.</p>
                </div>

                <div style={ { minWidth: 0, maxWidth: "100%", padding: 12, border: "1px dashed #cbd5e1", borderRadius: 10, background: "#f8fafc" } }>
                    <div style={ { fontSize: 11, color: "#64748b", marginBottom: 8 } }>Preview (diagram)</div>
                    <ElementWidthPreview target={ { kind: "action", id: action.id } }
                        measured={ previewMeasure } width={ action.w }
                        fill={ action.colorFill } stroke={ action.colorStroke } textColor={ action.colorText } />
                </div>
            </form>
        </div>
    );
}
