// src/components/UITDLTextPanel/D2CodePanel.tsx
// Provides an editable and downloadable D2 artifact derived from valid UITDL.

import Editor from "@monaco-editor/react";
import { useRef, useState } from "react";
import { useDialogFocusTrap } from "../Canvas/useDialogFocusTrap";
import { copyText } from "./textClipboard";
import { renderD2, type D2Layout } from "./renderD2";
import { translateUITDLToD2 } from "./uitdlToD2";

type Props = {
    text: string;
    onClose: () => void;
};

type Status = {
    kind: "info" | "success" | "error";
    message: string;
};

function downloadD2( text: string ) {
    const url = URL.createObjectURL( new Blob( [ text ], { type: "text/plain;charset=utf-8" } ) );
    const anchor = document.createElement( "a" );
    anchor.href = url;
    anchor.download = "diagram.d2";
    document.body.appendChild( anchor );
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL( url );
}

function downloadSVG( svg: string ) {
    const url = URL.createObjectURL( new Blob( [ svg ], { type: "image/svg+xml;charset=utf-8" } ) );
    const anchor = document.createElement( "a" );
    anchor.href = url;
    anchor.download = "diagram.d2.svg";
    document.body.appendChild( anchor );
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL( url );
}

function waitForVisibleFeedback(): Promise<void> {
    return new Promise( resolve => {
        window.requestAnimationFrame( () => {
            window.requestAnimationFrame( () => resolve() );
        } );
    } );
}

export function D2CodePanel( { text, onClose }: Props ) {
    const generatedD2 = translateUITDLToD2( text );
    const [ d2Text, setD2Text ] = useState( generatedD2 );
    const [ status, setStatus ] = useState<Status | null>( null );
    const [ layout, setLayout ] = useState<D2Layout>( "elk" );
    const [ svg, setSVG ] = useState( "" );
    const [ isRendering, setIsRendering ] = useState( false );
    const dialogRef = useRef<HTMLElement | null>( null );
    useDialogFocusTrap( true, dialogRef, { onEscape: onClose } );

    const copyD2 = async () => {
        setStatus( { kind: "info", message: "Copying D2 source…" } );
        try {
            await copyText( d2Text );
            setStatus( { kind: "success", message: "D2 source copied." } );
        } catch ( error ) {
            console.error( "[D2 source] Copy failed after all clipboard methods.", error );
            setStatus( { kind: "error", message: "Could not copy D2 source." } );
        }
    };

    const renderDiagram = async () => {
        if ( isRendering || !d2Text.trim() ) return;
        setIsRendering( true );
        setStatus( { kind: "info", message: `Rendering D2 with ${layout.toUpperCase()}…` } );
        await waitForVisibleFeedback();
        try {
            const renderedSVG = await renderD2( d2Text, layout );
            setSVG( renderedSVG );
            setStatus( { kind: "success", message: `D2 rendered with ${layout.toUpperCase()}.` } );
        } catch ( error ) {
            console.error( "[D2 render] Compilation or rendering failed.", {
                cause: error,
                layout,
                fallback: "Keep the last successful SVG, if one exists.",
                impact: "The current D2 source is not displayed.",
            } );
            setStatus( {
                kind: "error",
                message: error instanceof Error ? error.message : "D2 could not compile the current source.",
            } );
        } finally {
            setIsRendering( false );
        }
    };

    return (
        <div className="d2CodePanel__backdrop" role="presentation">
            <section
                ref={ dialogRef }
                className="d2CodePanel"
                role="dialog"
                aria-modal="true"
                aria-label="D2 source editor"
                tabIndex={ -1 }
            >
                <header className="d2CodePanel__header">
                    <div>
                        <strong>D2 source</strong>
                        <span>Derived presentation artifact; edits do not change UITDL.</span>
                    </div>
                    <button type="button" onClick={ onClose } aria-label="Close D2 source editor">×</button>
                </header>
                <div className="d2CodePanel__actions">
                    <label htmlFor="d2-layout">Layout</label>
                    <select
                        id="d2-layout"
                        value={ layout }
                        onChange={ event => setLayout( event.target.value as D2Layout ) }
                        disabled={ isRendering }
                    >
                        <option value="elk">ELK</option>
                        <option value="dagre">Dagre</option>
                    </select>
                    <button type="button" onClick={ renderDiagram } disabled={ isRendering || !d2Text.trim() }>
                        { isRendering ? "Rendering…" : "Render diagram" }
                    </button>
                    <button type="button" onClick={ () => {
                        setStatus( { kind: "info", message: "D2 source regenerated from UITDL." } );
                        setD2Text( generatedD2 );
                    } } disabled={ isRendering }>
                        Regenerate
                    </button>
                    <button type="button" onClick={ copyD2 } disabled={ isRendering }>Copy D2</button>
                    <button type="button" onClick={ () => {
                        setStatus( { kind: "info", message: "Preparing diagram.d2…" } );
                        downloadD2( d2Text );
                        setStatus( { kind: "success", message: "diagram.d2 downloaded." } );
                    } } disabled={ isRendering }>
                        Download .d2
                    </button>
                    <button type="button" onClick={ () => downloadSVG( svg ) } disabled={ isRendering || !svg }>
                        Download SVG
                    </button>
                </div>
                { status && (
                    <div className={ `d2CodePanel__status is-${status.kind}` } role="status">
                        <span>{ status.message }</span>
                        <button type="button" onClick={ () => setStatus( null ) } aria-label="Dismiss D2 status">×</button>
                    </div>
                ) }
                <div className="d2CodePanel__workspace">
                    <div className="d2CodePanel__editor">
                        <Editor
                            defaultLanguage="plaintext"
                            value={ d2Text }
                            onChange={ value => setD2Text( value ?? "" ) }
                            loading="Loading D2 editor…"
                            options={ {
                                automaticLayout: true,
                                minimap: { enabled: false },
                                fontSize: 14,
                                wordWrap: "off",
                                scrollBeyondLastLine: false,
                            } }
                        />
                    </div>
                    <div className="d2CodePanel__preview" aria-label="Rendered D2 diagram">
                        { svg ? (
                            <div
                                className="d2CodePanel__svg"
                                role="img"
                                aria-label={ `D2 diagram rendered with ${layout.toUpperCase()}` }
                                dangerouslySetInnerHTML={ { __html: svg } }
                            />
                        ) : (
                            <p>Choose a layout and render the current D2 source.</p>
                        ) }
                    </div>
                </div>
            </section>
        </div>
    );
}
