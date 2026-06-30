// src/components/UITDLTextPanel/InteractivePreview.tsx
// Presents actions inside their declaring UI and resolves conditional branches in a modal.

import { useMemo, useRef, useState } from "react";
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

export function InteractivePreview( { text, onClose }: Props ) {
    const dialogRef = useRef<HTMLElement | null>( null );
    const conditionDialogRef = useRef<HTMLElement | null>( null );
    const model = useMemo( () => buildInteractivePreviewModel( text ), [ text ] );
    const [ currentKey, setCurrentKey ] = useState( model.uis[ 0 ]?.key ?? "" );
    const [ lastTransition, setLastTransition ] = useState<PreviewTransition | null>( null );
    const [ selectedAction, setSelectedAction ] = useState<PreviewAction | null>( null );
    const currentUI = model.uis.find( ui => ui.key === currentKey );
    useDialogFocusTrap( selectedAction == null, dialogRef, { onEscape: onClose } );
    useDialogFocusTrap( selectedAction != null, conditionDialogRef, {
        onEscape: () => setSelectedAction( null ),
    } );

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
        <div className="interactivePreview__backdrop" role="presentation">
            <section
                ref={ dialogRef }
                className="interactivePreview"
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
                    <button type="button" onClick={ onClose } aria-label="Close interactive preview">×</button>
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
                    { currentUI && renderInterface( currentUI.key, true, new Set<string>() ) }
                    { lastTransition && (
                        <p className="interactivePreview__result" role="status">
                            Navigated from { lastTransition.fromName } via { lastTransition.verb } “{ lastTransition.complement }”.
                        </p>
                    ) }
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
