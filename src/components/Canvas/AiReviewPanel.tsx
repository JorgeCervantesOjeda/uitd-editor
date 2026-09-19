// src/components/Canvas/AiReviewPanel.tsx
// Lets users copy compact and complete AI review prompts for UITDL validation.

import { Brain, ClipboardCopy, Download, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import {
    AI_REVIEW_NOTEBOOK_URL,
    DEFAULT_AI_REVIEW_PROMPT,
    buildDiagramAiReviewPayload,
    buildDiagramAiReviewPromptText,
    buildFullDiagramAiReviewPromptText,
    hasOfficialUitdlIssues,
} from "../../ai/diagramAiReview";
import { useAppStore } from "../../state/store";
import "./AiReviewPanel.css";

type Props = {
    open: boolean;
    onClose: () => void;
    triggerRef?: RefObject<HTMLButtonElement | null>;
};

type CopyStatus = "idle" | "copying" | "copied" | "error";
type PromptKind = "notebook" | "full";

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
    const [ statusMessage, setStatusMessage ] = useState( "" );

    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const fragmentTitles = useAppStore( s => s.fragmentTitles );

    const summary = useMemo(
        () => `${nodes.length} UIs, ${actions.length} actions, ${conditions.length} conditions, ${edges.length} connections`,
        [ actions.length, conditions.length, edges.length, nodes.length ]
    );

    void fragmentTitles;
    const payload = buildDiagramAiReviewPayload( useAppStore.getState(), prompt );
    const hasValidatorIssues = hasOfficialUitdlIssues( payload );

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
        setStatusMessage( "" );
    }, [ open ] );

    const copyPrompt = async ( kind: PromptKind ) => {
        setCopyStatus( "copying" );
        setErrorMessage( "" );
        setStatusMessage( "" );
        await waitForVisibleUpdate();

        try {
            const promptText = kind === "notebook"
                ? buildDiagramAiReviewPromptText( payload )
                : buildFullDiagramAiReviewPromptText( payload );

            if ( navigator.clipboard?.writeText ) {
                await navigator.clipboard.writeText( promptText );
                setStatusMessage(
                    kind === "notebook"
                        ? "NotebookLM validation prompt copied. You can now paste it into NotebookLM."
                        : "Full prompt copied. You can now paste it into another AI with a large context window."
                );
                setCopyStatus( "copied" );
                return;
            }

            console.warn( "[AI review] Clipboard API unavailable.", {
                fallback: "Trying textarea selection clipboard fallback.",
                impact: "Copy may still fail if browser permissions block clipboard writes.",
            } );
            const copied = copyTextWithSelectionFallback( promptText );
            setCopyStatus( copied ? "copied" : "error" );
            if ( copied ) {
                setStatusMessage(
                    kind === "notebook"
                        ? "NotebookLM validation prompt copied. You can now paste it into NotebookLM."
                        : "Full prompt copied. You can now paste it into another AI with a large context window."
                );
            }
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

    const downloadFullPrompt = () => {
        try {
            const promptText = buildFullDiagramAiReviewPromptText( payload );
            const blob = new Blob( [ promptText ], { type: "text/markdown;charset=utf-8" } );
            const url = URL.createObjectURL( blob );
            const link = document.createElement( "a" );
            link.href = url;
            link.download = "uitd-full-ai-review-prompt.md";
            document.body.appendChild( link );
            link.click();
            document.body.removeChild( link );
            URL.revokeObjectURL( url );
            setStatusMessage( "Full prompt downloaded for use with another AI." );
            setCopyStatus( "copied" );
        } catch ( error ) {
            const message = error instanceof Error ? error.message : "Could not download the full prompt.";
            console.error( "[AI review] Full prompt download failed.", {
                cause: error,
                fallback: "Showing the error message in the AI review panel.",
                impact: "The full AI review prompt was not downloaded.",
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
                Copy a compact NotebookLM prompt with the validation checklist and validator output. When the validator
                has no errors or warnings, you can also copy or download a large full prompt for other AIs.
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
                        onClick={ () => void copyPrompt( "notebook" ) }
                    >
                        <ClipboardCopy size={ 16 } aria-hidden="true" />
                        { isCopying ? "Copying..." : "Copy NotebookLM prompt" }
                    </button>
                </div>
            </div>

            { !hasValidatorIssues && (
                <div className="aiReviewPanel__fullPromptActions">
                    <p className="aiReviewPanel__fullPromptNote">
                        The validator reported no errors or warnings. For a deeper review, use the full prompt with
                        another AI that supports large context.
                    </p>
                    <div className="aiReviewPanel__actionButtons">
                        <button
                            type="button"
                            className="aiReviewPanel__secondaryButton"
                            disabled={ isCopying }
                            onClick={ () => void copyPrompt( "full" ) }
                        >
                            <ClipboardCopy size={ 16 } aria-hidden="true" />
                            Copy full prompt
                        </button>
                        <button
                            type="button"
                            className="aiReviewPanel__secondaryButton"
                            onClick={ downloadFullPrompt }
                        >
                            <Download size={ 16 } aria-hidden="true" />
                            Download full prompt
                        </button>
                    </div>
                </div>
            ) }

            { copyStatus === "copying" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--loading" role="status">
                    Preparing and copying the prompt...
                </p>
            ) }

            { copyStatus === "copied" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--success" role="status">
                    { statusMessage }
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
