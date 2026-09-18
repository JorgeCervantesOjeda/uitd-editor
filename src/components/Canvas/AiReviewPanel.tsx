// src/components/Canvas/AiReviewPanel.tsx
// Lets users copy a compact NotebookLM review prompt with UITDL validator context.

import { Brain, ClipboardCopy, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import {
    AI_REVIEW_NOTEBOOK_URL,
    DEFAULT_AI_REVIEW_PROMPT,
    buildDiagramAiReviewPayload,
    buildDiagramAiReviewPromptText,
} from "../../ai/diagramAiReview";
import { useAppStore } from "../../state/store";
import "./AiReviewPanel.css";

type Props = {
    open: boolean;
    onClose: () => void;
    triggerRef?: RefObject<HTMLButtonElement | null>;
};

type CopyStatus = "idle" | "copying" | "copied" | "error";

function waitForVisibleUpdate(): Promise<void> {
    return new Promise( resolve => {
        window.requestAnimationFrame( () => resolve() );
    } );
}

function copyTextWithSelectionFallback( text: string ): boolean {
    const textarea = document.createElement( "textarea" );
    textarea.value = text;
    textarea.setAttribute( "readonly", "true" );
    textarea.className = "aiReviewPanel__clipboardFallback";
    document.body.appendChild( textarea );
    textarea.select();

    try {
        return document.execCommand( "copy" );
    } finally {
        document.body.removeChild( textarea );
    }
}

export function AiReviewPanel( { open, onClose, triggerRef }: Props ) {
    const [ prompt, setPrompt ] = useState( DEFAULT_AI_REVIEW_PROMPT );
    const [ copyStatus, setCopyStatus ] = useState<CopyStatus>( "idle" );
    const [ errorMessage, setErrorMessage ] = useState( "" );

    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );

    const summary = useMemo(
        () => `${nodes.length} UIs, ${actions.length} actions, ${conditions.length} conditions, ${edges.length} connections`,
        [ actions.length, conditions.length, edges.length, nodes.length ]
    );

    useEffect( () => {
        if ( !open ) return;
        function onKeyDown( event: KeyboardEvent ) {
            if ( event.key !== "Escape" ) return;
            event.preventDefault();
            onClose();
            requestAnimationFrame( () => triggerRef?.current?.focus() );
        }
        document.addEventListener( "keydown", onKeyDown, true );
        return () => document.removeEventListener( "keydown", onKeyDown, true );
    }, [ onClose, open, triggerRef ] );

    useEffect( () => {
        if ( open ) return;
        setCopyStatus( "idle" );
        setErrorMessage( "" );
    }, [ open ] );

    const copyPrompt = async () => {
        setCopyStatus( "copying" );
        setErrorMessage( "" );
        await waitForVisibleUpdate();

        try {
            const state = useAppStore.getState();
            const payload = buildDiagramAiReviewPayload( state, prompt );
            const promptText = buildDiagramAiReviewPromptText( payload );

            if ( navigator.clipboard?.writeText ) {
                await navigator.clipboard.writeText( promptText );
                setCopyStatus( "copied" );
                return;
            }

            console.warn( "[AI review] Clipboard API unavailable.", {
                fallback: "Trying textarea selection clipboard fallback.",
                impact: "Copy may still fail if browser permissions block clipboard writes.",
            } );
            const copied = copyTextWithSelectionFallback( promptText );
            setCopyStatus( copied ? "copied" : "error" );
            if ( !copied ) {
                setErrorMessage( "Could not copy the prompt. Check clipboard permissions." );
            }
        } catch ( error ) {
            const message = error instanceof Error ? error.message : "Could not copy the prompt.";
            console.error( "[AI review] Prompt copy failed.", {
                cause: error,
                fallback: "Showing the error message in the AI review panel.",
                impact: "The AI review prompt was not copied.",
            } );
            setErrorMessage( message );
            setCopyStatus( "error" );
        }
    };

    if ( !open ) return null;

    const isCopying = copyStatus === "copying";

    return (
        <section className="aiReviewPanel" aria-label="AI diagram review">
            <div className="aiReviewPanel__header">
                <h2 className="aiReviewPanel__title">
                    <Brain size={ 16 } aria-hidden="true" /> AI review
                </h2>
                <button
                    type="button"
                    className="aiReviewPanel__close"
                    onClick={ onClose }
                    aria-label="Close AI review"
                >
                    <X size={ 16 } aria-hidden="true" />
                </button>
            </div>

            <p className="aiReviewPanel__note">
                The app will copy a compact prompt with the project notebook link, generated UITDL, and official
                validator output.
            </p>

            <label className="aiReviewPanel__field">
                <span className="aiReviewPanel__label">AI instruction</span>
                <textarea
                    className="aiReviewPanel__textarea"
                    value={ prompt }
                    onChange={ event => setPrompt( event.target.value ) }
                />
            </label>

            <div className="aiReviewPanel__actions">
                <span className="aiReviewPanel__summary">{ summary }</span>
                <div className="aiReviewPanel__actionButtons">
                    <a
                        className="aiReviewPanel__notebookLink"
                        href={ AI_REVIEW_NOTEBOOK_URL }
                        target="_blank"
                        rel="noreferrer"
                    >
                        <ExternalLink size={ 16 } aria-hidden="true" />
                        Open UITD expert AI
                    </a>
                    <button
                        type="button"
                        className="aiReviewPanel__submit"
                        disabled={ isCopying }
                        onClick={ () => void copyPrompt() }
                    >
                        <ClipboardCopy size={ 16 } aria-hidden="true" />
                        { isCopying ? "Copying..." : "Copy prompt" }
                    </button>
                </div>
            </div>

            { copyStatus === "copying" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--loading" role="status">
                    Preparing and copying the prompt...
                </p>
            ) }

            { copyStatus === "copied" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--success" role="status">
                    Prompt copied. You can now paste it into NotebookLM.
                </p>
            ) }

            { copyStatus === "error" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--error" role="alert">
                    { errorMessage }
                </p>
            ) }
        </section>
    );
}

export default AiReviewPanel;
