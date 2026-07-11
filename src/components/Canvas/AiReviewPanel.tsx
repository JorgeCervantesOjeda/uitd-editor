// src/components/Canvas/AiReviewPanel.tsx
// Lets users copy a complete AI review prompt with bundled UITDL skill context.

import { Brain, ClipboardCopy, X } from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import {
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
        () => `${nodes.length} UIs, ${actions.length} acciones, ${conditions.length} condiciones, ${edges.length} conexiones`,
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
                setErrorMessage( "No se pudo copiar el prompt. Revisa los permisos del portapapeles." );
            }
        } catch ( error ) {
            const message = error instanceof Error ? error.message : "No se pudo copiar el prompt.";
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
                    <Brain size={ 16 } aria-hidden="true" /> Opinión de IA
                </h2>
                <button
                    type="button"
                    className="aiReviewPanel__close"
                    onClick={ onClose }
                    aria-label="Cerrar opinión de IA"
                >
                    <X size={ 16 } aria-hidden="true" />
                </button>
            </div>

            <p className="aiReviewPanel__note">
                La app copiará un prompt completo con el JSON del diagrama, un UITDL temporal generado desde ese JSON,
                los errores del verificador y el skill completo `uitdl-authoring` incluido en la app.
            </p>

            <label className="aiReviewPanel__field">
                <span className="aiReviewPanel__label">Instrucción para la IA</span>
                <textarea
                    className="aiReviewPanel__textarea"
                    value={ prompt }
                    onChange={ event => setPrompt( event.target.value ) }
                />
            </label>

            <div className="aiReviewPanel__actions">
                <span className="aiReviewPanel__summary">{ summary }</span>
                <button
                    type="button"
                    className="aiReviewPanel__submit"
                    disabled={ isCopying }
                    onClick={ () => void copyPrompt() }
                >
                    <ClipboardCopy size={ 16 } aria-hidden="true" />
                    { isCopying ? "Copiando..." : "Copiar prompt" }
                </button>
            </div>

            { copyStatus === "copying" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--loading" role="status">
                    Preparando y copiando el prompt completo...
                </p>
            ) }

            { copyStatus === "copied" && (
                <p className="aiReviewPanel__status aiReviewPanel__status--success" role="status">
                    Prompt copiado. Ahora puedes pegarlo en ChatGPT o en tu IA preferida.
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
