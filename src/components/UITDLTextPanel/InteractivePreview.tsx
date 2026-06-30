// src/components/UITDLTextPanel/InteractivePreview.tsx
// Presents a keyboard-accessible interactive walkthrough of a valid UITDL model.

import { useMemo, useRef, useState } from "react";
import { useDialogFocusTrap } from "../Canvas/useDialogFocusTrap";
import {
    buildInteractivePreviewModel,
    effectiveTransitions,
    effectiveUIKeys,
    groupPreviewActions,
    type PreviewTransition,
} from "./interactivePreviewModel";

type Props = {
    text: string;
    onClose: () => void;
};

export function InteractivePreview( { text, onClose }: Props ) {
    const dialogRef = useRef<HTMLElement | null>( null );
    const model = useMemo( () => buildInteractivePreviewModel( text ), [ text ] );
    const [ currentKey, setCurrentKey ] = useState( model.uis[ 0 ]?.key ?? "" );
    const [ lastTransition, setLastTransition ] = useState<PreviewTransition | null>( null );
    const [ activeActionKey, setActiveActionKey ] = useState<string | null>( null );
    const currentUI = model.uis.find( ui => ui.key === currentKey );
    const visibleKeys = effectiveUIKeys( currentKey, model.containedKeysByUI );
    const visibleUIs = model.uis.filter( ui => visibleKeys.has( ui.key ) );
    const transitions = effectiveTransitions( model, currentKey );
    const actions = groupPreviewActions( transitions );
    useDialogFocusTrap( true, dialogRef, { onEscape: onClose } );

    const navigate = ( transition: PreviewTransition ) => {
        setLastTransition( transition );
        setActiveActionKey( null );
        setCurrentKey( transition.toKey );
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
                            setActiveActionKey( null );
                        } }
                    >
                        { model.uis.map( ui => (
                            <option key={ ui.key } value={ ui.key }>UI { ui.key } · { ui.name }</option>
                        ) ) }
                    </select>
                    <span>The first declared UI is selected initially because UITDL has no initial-state declaration.</span>
                </div>

                <div className="interactivePreview__content">
                    <article className="interactivePreview__screen">
                        <span className="interactivePreview__eyebrow">Current interface</span>
                        <h2>UI { currentUI?.key } · { currentUI?.name }</h2>
                        { visibleUIs.length > 1 && (
                            <div className="interactivePreview__included">
                                <strong>Included interfaces</strong>
                                { visibleUIs
                                    .filter( ui => ui.key !== currentKey )
                                    .map( ui => <span key={ ui.key }>UI { ui.key } · { ui.name }</span> ) }
                            </div>
                        ) }
                        { lastTransition && (
                            <p className="interactivePreview__result" role="status">
                                Navigated from { lastTransition.fromName } via { lastTransition.verb } “{ lastTransition.complement }”.
                            </p>
                        ) }
                    </article>

                    <aside className="interactivePreview__actions" aria-label="Available UITDL actions">
                        <h3>Available actions</h3>
                        { actions.length === 0 ? (
                            <p>This UI has no direct or inherited outgoing actions.</p>
                        ) : actions.map( ( action, indexOfAction ) => {
                            const isActive = activeActionKey === action.key;
                            const conditionsId = `preview-action-${indexOfAction}-conditions`;
                            return (
                                <div className="interactivePreview__actionGroup" key={ action.key }>
                                    <button
                                        type="button"
                                        className="interactivePreview__actionButton"
                                        onClick={ () => setActiveActionKey( isActive ? null : action.key ) }
                                        aria-expanded={ isActive }
                                        aria-controls={ conditionsId }
                                    >
                                        <strong>{ action.verb } “{ action.complement }”</strong>
                                        <span>{ isActive ? "Hide conditions" : "Choose a condition" }</span>
                                    </button>
                                    { isActive && (
                                        <div
                                            id={ conditionsId }
                                            className="interactivePreview__conditions"
                                            aria-label={ `Conditions for ${action.verb} ${action.complement}` }
                                        >
                                            { action.transitions.map( transition => (
                                                <button
                                                    type="button"
                                                    key={ transition.key }
                                                    onClick={ () => navigate( transition ) }
                                                >
                                                    <strong>{ transition.condition ?? "No condition" }</strong>
                                                    { transition.fromKey !== currentKey && (
                                                        <span>Inherited from { transition.fromName }</span>
                                                    ) }
                                                    <span>Go to UI { transition.toKey } · { transition.toName }</span>
                                                </button>
                                            ) ) }
                                        </div>
                                    ) }
                                </div>
                            );
                        } ) }
                    </aside>
                </div>
            </section>
        </div>
    );
}
