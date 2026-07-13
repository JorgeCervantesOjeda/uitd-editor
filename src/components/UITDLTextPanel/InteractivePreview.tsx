// src/components/UITDLTextPanel/InteractivePreview.tsx
// Presents actions inside their declaring UI and resolves conditional branches in a modal.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAppStore } from "../../state/store";
import { useDialogFocusTrap } from "../Canvas/useDialogFocusTrap";
import {
    buildInteractivePreviewModel,
    groupPreviewActions,
    previewActionMode,
    type PreviewAction,
    type PreviewTransition,
} from "./interactivePreviewModel";

type Props = {
    text: string;
    onClose: () => void;
};

type PreviewColorStyle = CSSProperties & Record<`--preview-${string}`, string>;
type PreviewWindowStyle = CSSProperties & {
    "--interactive-preview-width": string;
    "--interactive-preview-height": string;
};

type PreviewWindowSize = {
    width: number;
    height: number;
};

const PREVIEW_SIZE_STORAGE_KEY = "uitd-editor/interactive-preview-size";
const DEFAULT_PREVIEW_SIZE: PreviewWindowSize = { width: 920, height: 760 };

function sizeOfClampedPreview( size: PreviewWindowSize ): PreviewWindowSize {
    const maxWidth = Math.max( 320, window.innerWidth - 16 );
    const maxHeight = Math.max( 240, window.innerHeight - 16 );
    return {
        width: Math.min( maxWidth, Math.max( Math.min( 480, maxWidth ), size.width ) ),
        height: Math.min( maxHeight, Math.max( Math.min( 360, maxHeight ), size.height ) ),
    };
}

function readStoredPreviewSize(): PreviewWindowSize {
    try {
        const stored = localStorage.getItem( PREVIEW_SIZE_STORAGE_KEY );
        if ( !stored ) return sizeOfClampedPreview( DEFAULT_PREVIEW_SIZE );
        const parsed = JSON.parse( stored ) as Partial<PreviewWindowSize>;
        if ( !Number.isFinite( parsed.width ) || !Number.isFinite( parsed.height ) ) {
            console.warn( "[Interactive preview] Stored window size is invalid.", {
                cause: "Saved width or height is not a finite number.",
                fallback: "Use the default preview size.",
                impact: "The previous window size cannot be restored.",
            } );
            return sizeOfClampedPreview( DEFAULT_PREVIEW_SIZE );
        }
        return sizeOfClampedPreview( { width: parsed.width!, height: parsed.height! } );
    } catch ( error ) {
        console.warn( "[Interactive preview] Window size recovery failed.", {
            cause: error,
            fallback: "Use the default preview size.",
            impact: "The previous window size cannot be restored.",
        } );
        return sizeOfClampedPreview( DEFAULT_PREVIEW_SIZE );
    }
}

function savePreviewSize( size: PreviewWindowSize ) {
    try {
        localStorage.setItem( PREVIEW_SIZE_STORAGE_KEY, JSON.stringify( size ) );
    } catch ( error ) {
        console.warn( "[Interactive preview] Window size persistence failed.", {
            cause: error,
            fallback: "Keep the current size until the preview closes.",
            impact: "The resized window may reopen at its previous saved size.",
        } );
    }
}

export function InteractivePreview( { text, onClose }: Props ) {
    const dialogRef = useRef<HTMLElement | null>( null );
    const initialWindowSizeRef = useRef( readStoredPreviewSize() );
    const conditionDialogRef = useRef<HTMLElement | null>( null );
    const model = useMemo( () => buildInteractivePreviewModel( text ), [ text ] );
    const canvasNodes = useAppStore( state => state.nodes );
    const canvasActions = useAppStore( state => state.actions );
    const canvasConditions = useAppStore( state => state.conditions );
    const [ currentKey, setCurrentKey ] = useState( model.uis[ 0 ]?.key ?? "" );
    const [ lastTransition, setLastTransition ] = useState<PreviewTransition | null>( null );
    const [ selectedAction, setSelectedAction ] = useState<PreviewAction | null>( null );
    const [ isMaximized, setIsMaximized ] = useState( false );
    const currentUI = model.uis.find( ui => ui.key === currentKey );
    useDialogFocusTrap( selectedAction == null, dialogRef, { onEscape: onClose } );
    useDialogFocusTrap( selectedAction != null, conditionDialogRef, {
        onEscape: () => setSelectedAction( null ),
    } );

    useEffect( () => {
        const saveCurrentPreviewSize = () => {
            if ( isMaximized ) return;
            const bounds = dialogRef.current?.getBoundingClientRect();
            if ( !bounds || bounds.width <= 0 || bounds.height <= 0 ) return;
            savePreviewSize( { width: bounds.width, height: bounds.height } );
        };
        window.addEventListener( "pointerup", saveCurrentPreviewSize );
        return () => {
            saveCurrentPreviewSize();
            window.removeEventListener( "pointerup", saveCurrentPreviewSize );
        };
    }, [ isMaximized ] );

    const previewWindowStyle: PreviewWindowStyle = {
        "--interactive-preview-width": `${initialWindowSizeRef.current.width}px`,
        "--interactive-preview-height": `${initialWindowSizeRef.current.height}px`,
    };

    const navigate = ( transition: PreviewTransition ) => {
        setLastTransition( transition );
        setSelectedAction( null );
        setCurrentKey( transition.toKey );
    };

    const activateAction = ( action: PreviewAction ) => {
        const mode = previewActionMode( action );
        if ( mode === "unconditional" ) {
            navigate( action.transitions[ 0 ] );
            return;
        }
        if ( mode === "conditional" ) setSelectedAction( action );
    };

    const uiColorStyle = ( key: string ): PreviewColorStyle => {
        const node = canvasNodes.find( candidate => candidate.displayId?.trim() === key );
        return {
            "--preview-ui-fill": node?.colorFill ?? "#f1f5f9",
            "--preview-ui-stroke": node?.colorStroke ?? "#94a3b8",
            "--preview-ui-text": node?.colorText ?? "#334155",
        };
    };

    const actionColorStyle = ( action: PreviewAction ): PreviewColorStyle => {
        const nodeIds = new Set(
            canvasNodes
                .filter( node => node.displayId?.trim() === action.transitions[ 0 ]?.fromKey )
                .map( node => node.id )
        );
        const canvasAction = canvasActions.find( candidate =>
            nodeIds.has( candidate.originNodeId ) &&
            candidate.verb === action.verb &&
            candidate.complement === action.complement
        );
        return {
            "--preview-action-fill": canvasAction?.colorFill ?? "var(--diagram-action-fill)",
            "--preview-action-stroke": canvasAction?.colorStroke ?? "var(--diagram-action-stroke)",
            "--preview-action-text": canvasAction?.colorText ?? "var(--diagram-action-text)",
        };
    };

    const conditionColorStyle = ( transition: PreviewTransition ): PreviewColorStyle => {
        const nodeIds = new Set(
            canvasNodes
                .filter( node => node.displayId?.trim() === transition.fromKey )
                .map( node => node.id )
        );
        const actionIds = new Set(
            canvasActions
                .filter( action =>
                    nodeIds.has( action.originNodeId ) &&
                    action.verb === transition.verb &&
                    action.complement === transition.complement
                )
                .map( action => action.id )
        );
        const condition = canvasConditions.find( candidate =>
            actionIds.has( candidate.originActionId ) &&
            candidate.title.trim() === transition.condition?.trim()
        );
        return {
            "--preview-condition-fill": condition?.colorFill ?? "var(--diagram-action-fill)",
            "--preview-condition-stroke": condition?.colorStroke ?? "var(--diagram-action-stroke)",
            "--preview-condition-text": condition?.colorText ?? "var(--diagram-action-text)",
        };
    };

    const renderInterface = ( key: string, isCurrent: boolean, ancestors: Set<string> ) => {
        const ui = model.uis.find( candidate => candidate.key === key );
        if ( !ui ) return null;
        if ( ancestors.has( key ) ) {
            console.error( "Interactive preview found cyclic UI inclusion.", {
                cause: `UI ${key} appears in its own inclusion ancestry.`,
                fallback: "Stop rendering the cyclic branch.",
                impact: "The invalid nested UI branch is omitted from the preview.",
            } );
            return null;
        }

        const nextAncestors = new Set( ancestors );
        nextAncestors.add( key );
        const actions = groupPreviewActions(
            model.transitions.filter( transition => transition.fromKey === key )
        );
        const childKeys = model.containedKeysByUI.get( key ) ?? new Set<string>();
        const children = model.uis.filter( candidate => childKeys.has( candidate.key ) );

        return (
            <section
                key={ key }
                className={ `interactivePreview__ui ${isCurrent ? "is-current" : "is-inserted"}` }
                aria-label={ `${isCurrent ? "Current" : "Inserted"} UI ${key}: ${ui.name}` }
                style={ uiColorStyle( key ) }
            >
                <header className="interactivePreview__uiHeader">
                    <span>{ isCurrent ? "Current UI" : "Inserted UI" }</span>
                    <strong>UI { key } · { ui.name }</strong>
                </header>

                <div className="interactivePreview__uiActions" aria-label={ `Actions in UI ${key}` }>
                    { actions.length === 0 ? (
                        <p>No available actions in this UI.</p>
                    ) : actions.map( action => {
                        const mode = previewActionMode( action );
                        return (
                            <button
                                type="button"
                                key={ action.key }
                                onClick={ () => activateAction( action ) }
                                disabled={ mode === "invalid" }
                                style={ actionColorStyle( action ) }
                                aria-label={ `${action.verb} “${action.complement}” ${
                                    mode === "conditional"
                                        ? "Choose a condition"
                                        : mode === "unconditional"
                                            ? `Go to UI ${action.transitions[ 0 ].toKey} · ${action.transitions[ 0 ].toName}`
                                            : "Resolve validation errors"
                                }` }
                            >
                                <strong>{ action.verb } “{ action.complement }”</strong>
                                <span>{ mode === "conditional"
                                    ? "Choose a condition"
                                    : mode === "unconditional"
                                        ? `Go to UI ${action.transitions[ 0 ].toKey} · ${action.transitions[ 0 ].toName}`
                                        : "Resolve validation errors"
                                }</span>
                            </button>
                        );
                    } ) }
                </div>

                { children.length > 0 && (
                    <div className="interactivePreview__insertedInterfaces">
                        { children.map( child => renderInterface( child.key, false, nextAncestors ) ) }
                    </div>
                ) }
            </section>
        );
    };

    return (
        <div
            className={ `interactivePreview__backdrop${isMaximized ? " is-maximized" : ""}` }
            role="presentation"
        >
            <section
                ref={ dialogRef }
                className={ `interactivePreview${isMaximized ? " is-maximized" : ""}` }
                style={ previewWindowStyle }
                role="dialog"
                aria-modal="true"
                aria-label="Interactive UITDL preview"
                tabIndex={ -1 }
            >
                <header className="interactivePreview__header">
                    <div>
                        <strong>{ model.title }</strong>
                        <span>Interactive UITDL preview</span>
                    </div>
                    <div className="interactivePreview__windowActions">
                        <button
                            type="button"
                            onClick={ () => setIsMaximized( current => !current ) }
                            aria-label={ isMaximized ? "Restore interactive preview" : "Maximize interactive preview" }
                            aria-pressed={ isMaximized }
                        >
                            { isMaximized ? "Restore" : "Maximize" }
                        </button>
                        <button type="button" onClick={ onClose } aria-label="Close interactive preview">×</button>
                    </div>
                </header>

                <div className="interactivePreview__controls">
                    <label htmlFor="interactive-preview-state">Current UI</label>
                    <select
                        id="interactive-preview-state"
                        value={ currentKey }
                        onChange={ event => {
                            setCurrentKey( event.target.value );
                            setLastTransition( null );
                            setSelectedAction( null );
                        } }
                    >
                        { model.uis.map( ui => (
                            <option key={ ui.key } value={ ui.key }>UI { ui.key } · { ui.name }</option>
                        ) ) }
                    </select>
                    <span>The first declared UI is selected initially because UITDL has no initial-state declaration.</span>
                </div>

                <main className="interactivePreview__content">
                    { lastTransition && (
                        <p className="interactivePreview__result" role="status">
                            Navigated from { lastTransition.fromName } via { lastTransition.verb } “{ lastTransition.complement }”.
                        </p>
                    ) }
                    { currentUI && renderInterface( currentUI.key, true, new Set<string>() ) }
                </main>
            </section>

            { selectedAction && (
                <div className="interactivePreview__conditionBackdrop" role="presentation">
                    <section
                        ref={ conditionDialogRef }
                        className="interactivePreview__conditionDialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="interactive-preview-condition-title"
                        tabIndex={ -1 }
                    >
                        <header>
                            <div>
                                <span>Select a condition</span>
                                <h2 id="interactive-preview-condition-title">
                                    { selectedAction.verb } “{ selectedAction.complement }”
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={ () => setSelectedAction( null ) }
                                aria-label="Close condition selection"
                            >×</button>
                        </header>
                        <div className="interactivePreview__conditionOptions">
                            { selectedAction.transitions.map( transition => (
                                <button
                                    type="button"
                                    key={ transition.key }
                                    onClick={ () => navigate( transition ) }
                                    aria-label={ `${transition.condition} Go to UI ${transition.toKey} · ${transition.toName}` }
                                    style={ conditionColorStyle( transition ) }
                                >
                                    <strong>{ transition.condition }</strong>
                                    <span>Go to UI { transition.toKey } · { transition.toName }</span>
                                </button>
                            ) ) }
                        </div>
                        <button
                            type="button"
                            className="interactivePreview__conditionCancel"
                            onClick={ () => setSelectedAction( null ) }
                        >Cancel</button>
                    </section>
                </div>
            ) }
        </div>
    );
}
