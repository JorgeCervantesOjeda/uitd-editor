// src/components/UITDLTextPanel/D2CodePanel.tsx
// Provides an editable and downloadable D2 artifact derived from valid UITDL.

import Editor from "@monaco-editor/react";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppStore } from "../../state/store";
import { useDialogFocusTrap } from "../Canvas/useDialogFocusTrap";
import { copyText } from "./textClipboard";
import { renderD2, type D2Layout } from "./renderD2";
import { translateUITDLToD2 } from "./uitdlToD2";

type Props = {
    text: string;
    theme: "light" | "dark";
    onClose: () => void;
};

type Status = {
    kind: "info" | "success" | "error";
    message: string;
};

const MIN_ZOOM_PERCENT = 25;
const MAX_ZOOM_PERCENT = 800;

function percentOfClampedZoom( zoomPercent: number ): number {
    return Math.min( MAX_ZOOM_PERCENT, Math.max( MIN_ZOOM_PERCENT, zoomPercent ) );
}

function percentOfWheelZoom( currentPercent: number, deltaY: number ): number {
    if ( deltaY === 0 ) return currentPercent;
    const factor = deltaY < 0 ? 1.1 : 0.9;
    return percentOfClampedZoom( currentPercent * factor );
}

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

export function D2CodePanel( { text, theme, onClose }: Props ) {
    const nodes = useAppStore( state => state.nodes );
    const colorsByUIID = useMemo( () => new Map(
        nodes
            .map( node => [
                ( node.displayId ?? "" ).trim(),
                {
                    fill: node.colorFill ?? "#f1f5f9",
                    stroke: node.colorStroke ?? "#94a3b8",
                    text: node.colorText ?? "#334155",
                },
            ] as const )
            .filter( ( [ uiid ] ) => uiid.length > 0 )
    ), [ nodes ] );
    const generatedD2 = useMemo(
        () => translateUITDLToD2( text, { colorsByUIID } ),
        [ colorsByUIID, text ]
    );
    const [ d2Text, setD2Text ] = useState( generatedD2 );
    const [ status, setStatus ] = useState<Status | null>( null );
    const [ layout, setLayout ] = useState<D2Layout>( "elk" );
    const [ svg, setSVG ] = useState( "" );
    const [ isRendering, setIsRendering ] = useState( false );
    const [ isMaximized, setIsMaximized ] = useState( false );
    const [ camera, setCamera ] = useState( { x: 0, y: 0, zoomPercent: 100 } );
    const [ isPanReady, setIsPanReady ] = useState( false );
    const dialogRef = useRef<HTMLElement | null>( null );
    const viewportRef = useRef<HTMLDivElement | null>( null );
    const cameraRef = useRef( camera );
    const panRef = useRef<{
        pointerId: number;
        clientX: number;
        clientY: number;
        panX: number;
        panY: number;
    } | null>( null );
    const [ isPanning, setIsPanning ] = useState( false );
    useDialogFocusTrap( true, dialogRef, { onEscape: onClose } );

    const applyCamera = useCallback( ( nextCamera: typeof camera ) => {
        cameraRef.current = nextCamera;
        setCamera( nextCamera );
    }, [] );

    useEffect( () => {
        const keyDown = ( event: KeyboardEvent ) => {
            if ( event.key === "Control" || event.key === "Meta" ) setIsPanReady( true );
        };
        const keyUp = ( event: KeyboardEvent ) => setIsPanReady( event.ctrlKey || event.metaKey );
        const clearPanReady = () => setIsPanReady( false );
        window.addEventListener( "keydown", keyDown );
        window.addEventListener( "keyup", keyUp );
        window.addEventListener( "blur", clearPanReady );
        return () => {
            window.removeEventListener( "keydown", keyDown );
            window.removeEventListener( "keyup", keyUp );
            window.removeEventListener( "blur", clearPanReady );
        };
    }, [] );

    useEffect( () => {
        const viewport = viewportRef.current;
        if ( !viewport || !svg ) return;
        const zoomWithWheel = ( event: WheelEvent ) => {
            event.preventDefault();
            const currentCamera = cameraRef.current;
            const currentPercent = currentCamera.zoomPercent;
            const nextPercent = percentOfWheelZoom( currentPercent, event.deltaY );
            if ( nextPercent === currentPercent ) return;
            const bounds = viewport.getBoundingClientRect();
            const pointerX = event.clientX - bounds.left;
            const pointerY = event.clientY - bounds.top;
            const currentScale = currentPercent / 100;
            const nextScale = nextPercent / 100;
            const anchorX = ( pointerX - currentCamera.x ) / currentScale;
            const anchorY = ( pointerY - currentCamera.y ) / currentScale;
            applyCamera( {
                x: currentCamera.x + ( currentScale - nextScale ) * anchorX,
                y: currentCamera.y + ( currentScale - nextScale ) * anchorY,
                zoomPercent: nextPercent,
            } );
        };
        viewport.addEventListener( "wheel", zoomWithWheel, { passive: false } );
        return () => viewport.removeEventListener( "wheel", zoomWithWheel );
    }, [ applyCamera, svg ] );

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
            applyCamera( { x: 0, y: 0, zoomPercent: 100 } );
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

    const startPan = ( event: ReactPointerEvent<HTMLDivElement> ) => {
        const isMiddleButton = event.button === 1;
        const isModifiedLeftButton = event.button === 0 && ( event.ctrlKey || event.metaKey );
        if ( ( !isMiddleButton && !isModifiedLeftButton ) || !svg ) return;
        const viewport = event.currentTarget;
        event.preventDefault();
        viewport.setPointerCapture( event.pointerId );
        panRef.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            panX: cameraRef.current.x,
            panY: cameraRef.current.y,
        };
        setIsPanning( true );
    };

    const panDiagram = ( event: ReactPointerEvent<HTMLDivElement> ) => {
        const pan = panRef.current;
        if ( !pan || pan.pointerId !== event.pointerId ) return;
        applyCamera( {
            ...cameraRef.current,
            x: pan.panX + event.clientX - pan.clientX,
            y: pan.panY + event.clientY - pan.clientY,
        } );
    };

    const stopPan = ( event: ReactPointerEvent<HTMLDivElement> ) => {
        const pan = panRef.current;
        if ( !pan || pan.pointerId !== event.pointerId ) return;
        if ( event.currentTarget.hasPointerCapture( event.pointerId ) ) {
            event.currentTarget.releasePointerCapture( event.pointerId );
        }
        panRef.current = null;
        setIsPanning( false );
    };

    return (
        <div
            className={ `d2CodePanel__backdrop${isMaximized ? " is-maximized" : ""}` }
            role="presentation"
        >
            <section
                ref={ dialogRef }
                className={ `d2CodePanel${isMaximized ? " is-maximized" : ""}` }
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
                    <div className="d2CodePanel__windowActions">
                        <button
                            type="button"
                            onClick={ () => setIsMaximized( current => !current ) }
                            aria-label={ isMaximized ? "Restore D2 window" : "Maximize D2 window" }
                            aria-pressed={ isMaximized }
                        >
                            { isMaximized ? "Restore" : "Maximize" }
                        </button>
                        <button type="button" onClick={ onClose } aria-label="Close D2 source editor">×</button>
                    </div>
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
                            theme={ theme === "dark" ? "vs-dark" : "vs" }
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
                        <div
                            ref={ viewportRef }
                            className={ `d2CodePanel__viewport${isPanReady ? " is-grab-ready" : ""}${isPanning ? " is-panning" : ""}` }
                            aria-label="D2 pan and zoom viewport"
                            onPointerDown={ startPan }
                            onPointerMove={ panDiagram }
                            onPointerUp={ stopPan }
                            onPointerCancel={ stopPan }
                        >
                            { svg ? (
                                <div
                                    className="d2CodePanel__svg"
                                    role="img"
                                    aria-label={ `D2 diagram rendered with ${layout.toUpperCase()}` }
                                    style={ {
                                        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoomPercent / 100})`,
                                    } }
                                    dangerouslySetInnerHTML={ { __html: svg } }
                                />
                            ) : (
                                <p>Choose a layout and render the current D2 source.</p>
                            ) }
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
