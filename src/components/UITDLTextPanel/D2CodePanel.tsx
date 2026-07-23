// src/components/UITDLTextPanel/D2CodePanel.tsx
// Provides an editable and downloadable D2 artifact derived from valid UITDL.

import Editor from "@monaco-editor/react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppStore } from "../../state/store";
import { useDialogFocusTrap } from "../Canvas/useDialogFocusTrap";
import { ZoomSlider } from "../ZoomSlider";
import { DiagramScrollbar, DiagramScrollbarCorner } from "../DiagramScrollbar/DiagramScrollbar";
import {
    CANONICAL_ZOOM_PERCENT,
    cameraOffsetOfScroll,
    computeAxisScrollMetrics,
    type AxisScrollMetrics,
} from "../DiagramScrollbar/diagramCameraMetrics";
import { copyText } from "./textClipboard";
import {
    cropRectOfInteraction,
    type D2CropDragMode,
    type D2CropInteraction,
    type DiagramDimensions,
    type DiagramPoint,
} from "./d2CropGeometry";
import { exportD2CropToJpeg, rasterSizeOfD2Crop, type D2CropRect } from "./d2JpegExport";
import type { D2Layout } from "./renderD2";
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

type Camera = {
    x: number;
    y: number;
    zoomPercent: number;
};

const MIN_ZOOM_PERCENT = 25;
const MAX_ZOOM_PERCENT = 1200;
const FIT_TO_WIDTH_ZOOM_PERCENT = CANONICAL_ZOOM_PERCENT;
const EMPTY_SCROLL_METRICS: AxisScrollMetrics = { maxOffset: 0, offset: 0, startCameraOffset: 0 };
const FIT_TO_WIDTH_CAMERA: Camera = { x: 0, y: 0, zoomPercent: FIT_TO_WIDTH_ZOOM_PERCENT };
const DEFAULT_D2_SOURCE_WIDTH = 420;
const MIN_D2_SOURCE_WIDTH = 260;
const MIN_D2_PREVIEW_WIDTH = 320;

type D2RendererModule = typeof import( "./renderD2" );

let d2RendererModule: D2RendererModule | null = null;
let d2RendererModulePromise: Promise<D2RendererModule> | null = null;

async function loadD2RendererModule(): Promise<D2RendererModule> {
    if ( d2RendererModule ) return d2RendererModule;

    if ( !d2RendererModulePromise ) {
        d2RendererModulePromise = import( "./renderD2" )
            .then( loadedModule => {
                d2RendererModule = loadedModule;
                return loadedModule;
            } )
            .catch( error => {
                d2RendererModulePromise = null;
                throw error;
            } );
    }

    return d2RendererModulePromise;
}

function percentOfClampedZoom( zoomPercent: number ): number {
    return Math.min( MAX_ZOOM_PERCENT, Math.max( MIN_ZOOM_PERCENT, zoomPercent ) );
}

function percentOfWheelZoom( currentPercent: number, deltaY: number ): number {
    if ( deltaY === 0 ) return currentPercent;
    const factor = deltaY < 0 ? 1.1 : 0.9;
    return percentOfClampedZoom( currentPercent * factor );
}

function dimensionsOfSVGViewBox( svg: string ): DiagramDimensions {
    const documentOfSVG = new DOMParser().parseFromString( svg, "image/svg+xml" );
    const svgElement = documentOfSVG.documentElement;
    const viewBoxParts = ( svgElement.getAttribute( "viewBox" ) ?? "" )
        .trim()
        .split( /[\s,]+/ )
        .map( Number );
    const width = viewBoxParts[ 2 ];
    const height = viewBoxParts[ 3 ];
    if ( viewBoxParts.length === 4 && Number.isFinite( width ) && width > 0 && Number.isFinite( height ) && height > 0 ) {
        return { width, height };
    }
    console.warn( "[D2 render] SVG viewBox dimensions are unavailable.", {
        cause: "The rendered SVG has no positive four-value viewBox.",
        fallback: "Use a square base size for fit-to-width zoom.",
        impact: "The initial diagram aspect ratio may not match the rendered D2 layout.",
    } );
    return { width: 1, height: 1 };
}

function diagramPointOfClientPosition(
    clientX: number,
    clientY: number,
    diagram: HTMLDivElement,
    dimensions: DiagramDimensions
): DiagramPoint {
    const bounds = diagram.getBoundingClientRect();
    if ( bounds.width <= 0 || bounds.height <= 0 ) {
        console.warn( "[D2 JPG crop] Diagram bounds are unavailable.", {
            cause: "The rendered SVG container has no positive screen size.",
            fallback: "Use the origin as the crop pointer coordinate.",
            impact: "The JPG crop selection may need to be restarted after layout settles.",
        } );
        return { x: 0, y: 0 };
    }
    return {
        x: Math.min( dimensions.width, Math.max( 0, ( ( clientX - bounds.left ) / bounds.width ) * dimensions.width ) ),
        y: Math.min( dimensions.height, Math.max( 0, ( ( clientY - bounds.top ) / bounds.height ) * dimensions.height ) ),
    };
}

function isD2CropDragMode( value: string | undefined ): value is D2CropDragMode {
    return value === "create"
        || value === "move"
        || value === "n"
        || value === "ne"
        || value === "e"
        || value === "se"
        || value === "s"
        || value === "sw"
        || value === "w"
        || value === "nw";
}

function cropDragModeOfTarget( target: EventTarget | null ): D2CropDragMode | null {
    if ( !( target instanceof HTMLElement ) ) return null;
    const cropElement = target.closest<HTMLElement>( "[data-d2-crop-drag]" );
    const mode = cropElement?.dataset.d2CropDrag;
    return isD2CropDragMode( mode ) ? mode : null;
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

function clampedD2SourceWidth( width: number, workspaceWidth: number ): number {
    const maxWidth = Math.max( MIN_D2_SOURCE_WIDTH, workspaceWidth - MIN_D2_PREVIEW_WIDTH );
    return Math.min( maxWidth, Math.max( MIN_D2_SOURCE_WIDTH, width ) );
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
    const [ diagramDimensions, setDiagramDimensions ] = useState<DiagramDimensions>( { width: 1, height: 1 } );
    const [ isRendering, setIsRendering ] = useState( false );
    const [ isMaximized, setIsMaximized ] = useState( false );
    const [ camera, setCamera ] = useState<Camera>( FIT_TO_WIDTH_CAMERA );
    const [ verticalScroll, setVerticalScroll ] = useState<AxisScrollMetrics>( EMPTY_SCROLL_METRICS );
    const [ horizontalScroll, setHorizontalScroll ] = useState<AxisScrollMetrics>( EMPTY_SCROLL_METRICS );
    const [ isPanReady, setIsPanReady ] = useState( false );
    const dialogRef = useRef<HTMLElement | null>( null );
    const workspaceRef = useRef<HTMLDivElement | null>( null );
    const viewportRef = useRef<HTMLDivElement | null>( null );
    const diagramRef = useRef<HTMLDivElement | null>( null );
    const cameraRef = useRef( camera );
    const renderedCameraRef = useRef( camera );
    const panRef = useRef<{
        pointerId: number;
        clientX: number;
        clientY: number;
        panX: number;
        panY: number;
    } | null>( null );
    const [ isPanning, setIsPanning ] = useState( false );
    const [ isCropMode, setIsCropMode ] = useState( false );
    const [ cropInteraction, setCropInteraction ] = useState<D2CropInteraction | null>( null );
    const [ cropSelection, setCropSelection ] = useState<D2CropRect | null>( null );
    const [ isExportingCrop, setIsExportingCrop ] = useState( false );
    const [ isSourceCollapsed, setIsSourceCollapsed ] = useState( false );
    const [ sourcePanelWidth, setSourcePanelWidth ] = useState( DEFAULT_D2_SOURCE_WIDTH );
    const sourceResizeRef = useRef<{
        pointerId: number;
        startX: number;
        startWidth: number;
    } | null>( null );
    useDialogFocusTrap( true, dialogRef, { onEscape: onClose } );

    const applyCamera = useCallback( ( nextCamera: Camera ) => {
        cameraRef.current = nextCamera;
        setCamera( nextCamera );
    }, [] );

    const activeCropSelection = useMemo( () => (
        cropInteraction
            ? cropRectOfInteraction( cropInteraction, diagramDimensions )
            : cropSelection
    ), [ cropInteraction, cropSelection, diagramDimensions ] );

    const cropRasterSize = useMemo( () => (
        cropSelection ? rasterSizeOfD2Crop( cropSelection ) : null
    ), [ cropSelection ] );

    const refreshDiagramScroll = useCallback( () => {
        const viewport = viewportRef.current;
        const diagram = diagramRef.current;
        if ( !viewport || !diagram ) {
            setVerticalScroll( EMPTY_SCROLL_METRICS );
            setHorizontalScroll( EMPTY_SCROLL_METRICS );
            return;
        }

        const viewportStyle = window.getComputedStyle( viewport );
        const paddingTop = Number.parseFloat( viewportStyle.paddingTop ) || 0;
        const paddingRight = Number.parseFloat( viewportStyle.paddingRight ) || 0;
        const paddingBottom = Number.parseFloat( viewportStyle.paddingBottom ) || 0;
        const paddingLeft = Number.parseFloat( viewportStyle.paddingLeft ) || 0;
        const availableHeight = Math.max( 0, viewport.clientHeight - paddingTop - paddingBottom );
        const availableWidth = Math.max( 0, viewport.clientWidth - paddingLeft - paddingRight );
        const scale = cameraRef.current.zoomPercent / CANONICAL_ZOOM_PERCENT;

        setVerticalScroll( computeAxisScrollMetrics( {
            geometryStart: 0,
            geometrySize: diagram.offsetHeight,
            cameraOffset: cameraRef.current.y,
            zoom: scale,
            visibleStart: 0,
            visibleSize: availableHeight,
        } ) ?? EMPTY_SCROLL_METRICS );
        setHorizontalScroll( computeAxisScrollMetrics( {
            geometryStart: 0,
            geometrySize: diagram.offsetWidth,
            cameraOffset: cameraRef.current.x,
            zoom: scale,
            visibleStart: 0,
            visibleSize: availableWidth,
        } ) ?? EMPTY_SCROLL_METRICS );
    }, [] );

    const resetToFitWidth = useCallback( () => {
        const viewport = viewportRef.current;
        if ( viewport ) {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
        }
        applyCamera( FIT_TO_WIDTH_CAMERA );
    }, [ applyCamera ] );

    useLayoutEffect( () => {
        renderedCameraRef.current = camera;
    }, [ camera ] );

    const applyAnchoredZoom = useCallback( ( nextZoomPercent: number, clientX: number, clientY: number ) => {
        const diagram = diagramRef.current;
        if ( !diagram ) return;
        const currentCamera = cameraRef.current;
        const nextPercent = percentOfClampedZoom( nextZoomPercent );
        if ( nextPercent === FIT_TO_WIDTH_ZOOM_PERCENT ) {
            resetToFitWidth();
            return;
        }
        if ( nextPercent === currentCamera.zoomPercent ) return;
        const diagramBounds = diagram.getBoundingClientRect();
        const renderedCamera = renderedCameraRef.current;
        const diagramBaseLeft = diagramBounds.left - renderedCamera.x;
        const diagramBaseTop = diagramBounds.top - renderedCamera.y;
        const currentScale = currentCamera.zoomPercent / 100;
        const nextScale = nextPercent / 100;
        const anchorX = ( clientX - diagramBaseLeft - currentCamera.x ) / currentScale;
        const anchorY = ( clientY - diagramBaseTop - currentCamera.y ) / currentScale;
        applyCamera( {
            x: currentCamera.x + ( currentScale - nextScale ) * anchorX,
            y: currentCamera.y + ( currentScale - nextScale ) * anchorY,
            zoomPercent: nextPercent,
        } );
    }, [ applyCamera, resetToFitWidth ] );

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

    useLayoutEffect( () => {
        const viewport = viewportRef.current;
        const diagram = diagramRef.current;
        if ( !viewport || !diagram || !svg ) return;
        const zoomWithWheel = ( event: WheelEvent ) => {
            event.preventDefault();
            const currentPercent = cameraRef.current.zoomPercent;
            applyAnchoredZoom( percentOfWheelZoom( currentPercent, event.deltaY ), event.clientX, event.clientY );
        };
        viewport.addEventListener( "wheel", zoomWithWheel, { passive: false } );
        return () => viewport.removeEventListener( "wheel", zoomWithWheel );
    }, [ applyAnchoredZoom, svg ] );

    useLayoutEffect( () => {
        if ( !svg ) return;
        resetToFitWidth();
    }, [ diagramDimensions, resetToFitWidth, svg ] );

    useLayoutEffect( () => {
        if ( !svg || cameraRef.current.zoomPercent !== FIT_TO_WIDTH_ZOOM_PERCENT ) return;
        resetToFitWidth();
    }, [ isMaximized, resetToFitWidth, svg ] );

    useLayoutEffect( () => {
        const frame = window.requestAnimationFrame( refreshDiagramScroll );
        return () => window.cancelAnimationFrame( frame );
    }, [ camera, diagramDimensions, isMaximized, isSourceCollapsed, refreshDiagramScroll, sourcePanelWidth, svg ] );

    useLayoutEffect( () => {
        const viewport = viewportRef.current;
        const diagram = diagramRef.current;
        if ( !viewport || !diagram || !svg || typeof ResizeObserver === "undefined" ) return;

        let frame = 0;
        const observer = new ResizeObserver( () => {
            window.cancelAnimationFrame( frame );
            frame = window.requestAnimationFrame( refreshDiagramScroll );
        } );
        observer.observe( viewport );
        observer.observe( diagram );

        return () => {
            observer.disconnect();
            window.cancelAnimationFrame( frame );
        };
    }, [ refreshDiagramScroll, svg ] );

    const setHorizontalScrollOffset = useCallback( ( nextOffset: number ) => {
        applyCamera( {
            ...cameraRef.current,
            x: cameraOffsetOfScroll( horizontalScroll, nextOffset ),
        } );
    }, [ applyCamera, horizontalScroll ] );

    const setVerticalScrollOffset = useCallback( ( nextOffset: number ) => {
        applyCamera( {
            ...cameraRef.current,
            y: cameraOffsetOfScroll( verticalScroll, nextOffset ),
        } );
    }, [ applyCamera, verticalScroll ] );

    const setZoomFromSlider = ( zoomPercent: number ) => {
        const viewport = viewportRef.current;
        if ( !viewport ) return;
        const bounds = viewport.getBoundingClientRect();
        applyAnchoredZoom( zoomPercent, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2 );
    };

    const startSourceResize = ( event: ReactPointerEvent<HTMLButtonElement> ) => {
        if ( isSourceCollapsed || event.button !== 0 ) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture( event.pointerId );
        sourceResizeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: sourcePanelWidth,
        };
    };

    const resizeSourcePanel = ( event: ReactPointerEvent<HTMLButtonElement> ) => {
        const resize = sourceResizeRef.current;
        if ( !resize || resize.pointerId !== event.pointerId ) return;
        const workspaceWidth = workspaceRef.current?.clientWidth ?? DEFAULT_D2_SOURCE_WIDTH + MIN_D2_PREVIEW_WIDTH;
        setSourcePanelWidth( clampedD2SourceWidth(
            resize.startWidth + event.clientX - resize.startX,
            workspaceWidth
        ) );
    };

    const stopSourceResize = ( event: ReactPointerEvent<HTMLButtonElement> ) => {
        const resize = sourceResizeRef.current;
        if ( !resize || resize.pointerId !== event.pointerId ) return;
        if ( event.currentTarget.hasPointerCapture( event.pointerId ) ) {
            event.currentTarget.releasePointerCapture( event.pointerId );
        }
        sourceResizeRef.current = null;
    };

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
        try {
            let renderer = d2RendererModule;
            if ( !renderer || !renderer.isD2CompilerLoaded() ) {
                setStatus( { kind: "info", message: "Loading D2..." } );
                await waitForVisibleFeedback();
                renderer = await loadD2RendererModule();
                await renderer.loadD2Compiler();
            }

            setStatus( { kind: "info", message: "Compiling D2 source..." } );
            await waitForVisibleFeedback();
            const renderedSVG = await renderer.renderD2( d2Text, layout );
            setDiagramDimensions( dimensionsOfSVGViewBox( renderedSVG ) );
            setSVG( renderedSVG );
            setCropInteraction( null );
            setCropSelection( null );
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

    const toggleCropMode = () => {
        setIsCropMode( current => {
            const next = !current;
            if ( next ) {
                setStatus( { kind: "info", message: "Drag over the D2 SVG to select a JPG crop, or edit the selected crop." } );
            } else {
                setCropInteraction( null );
                setStatus( { kind: "info", message: "JPG crop selection disabled." } );
            }
            return next;
        } );
    };

    const startCropSelection = ( event: ReactPointerEvent<HTMLDivElement> ): boolean => {
        if ( !isCropMode || !svg || event.button !== 0 ) return false;
        const diagram = diagramRef.current;
        if ( !diagram ) return false;
        const viewport = event.currentTarget;
        const point = diagramPointOfClientPosition( event.clientX, event.clientY, diagram, diagramDimensions );
        const dragMode = cropSelection ? cropDragModeOfTarget( event.target ) : null;
        const mode = dragMode ?? "create";
        event.preventDefault();
        viewport.setPointerCapture( event.pointerId );
        if ( mode === "create" ) setCropSelection( null );
        setCropInteraction( {
            pointerId: event.pointerId,
            mode,
            start: point,
            current: point,
            cropAtStart: mode === "create" ? null : cropSelection,
        } );
        setStatus( { kind: "info", message: mode === "create" ? "Selecting JPG crop…" : "Editing JPG crop…" } );
        return true;
    };

    const updateCropSelection = ( event: ReactPointerEvent<HTMLDivElement> ): boolean => {
        const interaction = cropInteraction;
        if ( !interaction || interaction.pointerId !== event.pointerId ) return false;
        const diagram = diagramRef.current;
        if ( !diagram ) return true;
        event.preventDefault();
        setCropInteraction( {
            ...interaction,
            current: diagramPointOfClientPosition( event.clientX, event.clientY, diagram, diagramDimensions ),
        } );
        return true;
    };

    const stopCropSelection = ( event: ReactPointerEvent<HTMLDivElement> ): boolean => {
        const interaction = cropInteraction;
        if ( !interaction || interaction.pointerId !== event.pointerId ) return false;
        const diagram = diagramRef.current;
        const current = diagram
            ? diagramPointOfClientPosition( event.clientX, event.clientY, diagram, diagramDimensions )
            : interaction.current;
        const nextSelection = cropRectOfInteraction( {
            ...interaction,
            current,
        }, diagramDimensions );
        if ( event.currentTarget.hasPointerCapture( event.pointerId ) ) {
            event.currentTarget.releasePointerCapture( event.pointerId );
        }
        setCropInteraction( null );
        setCropSelection( nextSelection );
        if ( nextSelection ) {
            const rasterSize = rasterSizeOfD2Crop( nextSelection );
            setStatus( {
                kind: "success",
                message: `JPG crop ${interaction.mode === "create" ? "selected" : "updated"}. Export size: ${rasterSize.width} x ${rasterSize.height} px for a ${rasterSize.dpi} DPI letter target.`,
            } );
        } else {
            setStatus( { kind: "error", message: "The JPG crop is too small. Drag a larger rectangle." } );
        }
        return true;
    };

    const exportCropSelection = async () => {
        if ( !svg || !cropSelection || isExportingCrop ) return;
        const rasterSize = rasterSizeOfD2Crop( cropSelection );
        setIsExportingCrop( true );
        setStatus( {
            kind: "info",
            message: `Exporting JPG crop at ${rasterSize.width} x ${rasterSize.height} px...`,
        } );
        await waitForVisibleFeedback();
        try {
            const result = await exportD2CropToJpeg( svg, cropSelection );
            setStatus( {
                kind: "success",
                message: `${result.fileName} downloaded at ${result.rasterSize.width} x ${result.rasterSize.height} px.`,
            } );
        } catch ( error ) {
            console.error( "[D2 JPG crop] Export failed.", {
                cause: error,
                fallback: "Keep the selected crop available for another export attempt.",
                impact: "No JPG crop was downloaded.",
            } );
            setStatus( {
                kind: "error",
                message: error instanceof Error ? error.message : "The JPG crop could not be exported.",
            } );
        } finally {
            setIsExportingCrop( false );
        }
    };

    const startPan = ( event: ReactPointerEvent<HTMLDivElement> ) => {
        if ( startCropSelection( event ) ) return;
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
        if ( updateCropSelection( event ) ) return;
        const pan = panRef.current;
        if ( !pan || pan.pointerId !== event.pointerId ) return;
        applyCamera( {
            ...cameraRef.current,
            x: pan.panX + event.clientX - pan.clientX,
            y: pan.panY + event.clientY - pan.clientY,
        } );
    };

    const stopPan = ( event: ReactPointerEvent<HTMLDivElement> ) => {
        if ( stopCropSelection( event ) ) return;
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
                    <button
                        type="button"
                        onClick={ toggleCropMode }
                        disabled={ isRendering || isExportingCrop || !svg }
                        aria-pressed={ isCropMode }
                    >
                        { isCropMode ? "Stop JPG crop" : "Select JPG crop" }
                    </button>
                    <button
                        type="button"
                        onClick={ exportCropSelection }
                        disabled={ isRendering || isExportingCrop || !svg || !cropSelection }
                    >
                        { isExportingCrop ? "Exporting JPG…" : "Export JPG crop" }
                    </button>
                    { cropSelection && (
                        <button
                            type="button"
                            onClick={ () => {
                                setCropInteraction( null );
                                setCropSelection( null );
                                setStatus( { kind: "info", message: "JPG crop selection cleared." } );
                            } }
                            disabled={ isRendering || isExportingCrop }
                        >
                            Clear crop
                        </button>
                    ) }
                </div>
                { cropRasterSize && (
                    <div className="d2CodePanel__cropSummary" role="note">
                        JPG crop will export at { cropRasterSize.width } x { cropRasterSize.height } px for letter-size documents.
                    </div>
                ) }
                { status && (
                    <div className={ `d2CodePanel__status is-${status.kind}` } role="status">
                        <span>{ status.message }</span>
                        <button type="button" onClick={ () => setStatus( null ) } aria-label="Dismiss D2 status">×</button>
                    </div>
                ) }
                <div
                    ref={ workspaceRef }
                    className={ `d2CodePanel__workspace${isSourceCollapsed ? " is-source-collapsed" : ""}` }
                    style={ { "--d2-source-width": `${sourcePanelWidth}px` } as CSSProperties }
                >
                    <div className="d2CodePanel__editor">
                        <button
                            type="button"
                            className="d2CodePanel__sourceCollapse"
                            onClick={ () => setIsSourceCollapsed( true ) }
                            aria-label="Collapse D2 source"
                            title="Collapse D2 source"
                        >
                            ‹
                        </button>
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
                    <button
                        type="button"
                        className="d2CodePanel__sourceDivider"
                        onPointerDown={ startSourceResize }
                        onPointerMove={ resizeSourcePanel }
                        onPointerUp={ stopSourceResize }
                        onPointerCancel={ stopSourceResize }
                        onDoubleClick={ () => setSourcePanelWidth( DEFAULT_D2_SOURCE_WIDTH ) }
                        aria-label="Resize D2 source panel"
                        aria-orientation="vertical"
                        aria-valuemin={ MIN_D2_SOURCE_WIDTH }
                        aria-valuenow={ isSourceCollapsed ? 0 : Math.round( sourcePanelWidth ) }
                        role="separator"
                        title="Drag to resize D2 source"
                        disabled={ isSourceCollapsed }
                    />
                    <div className="d2CodePanel__preview" aria-label="Rendered D2 diagram">
                        { isSourceCollapsed && (
                            <button
                                type="button"
                                className="d2CodePanel__sourceExpand"
                                onClick={ () => setIsSourceCollapsed( false ) }
                                aria-label="Expand D2 source"
                                title="Expand D2 source"
                            >
                                ›
                            </button>
                        ) }
                        <div className="diagramViewportGrid d2DiagramViewport">
                        <div
                            ref={ viewportRef }
                            className={ `diagramViewportSurface d2CodePanel__viewport${isPanReady ? " is-grab-ready" : ""}${isPanning ? " is-panning" : ""}${isCropMode ? " is-cropping" : ""}` }
                            aria-label="D2 pan and zoom viewport"
                            onPointerDown={ startPan }
                            onPointerMove={ panDiagram }
                            onPointerUp={ stopPan }
                            onPointerCancel={ stopPan }
                        >
                            { svg ? (
                                <div
                                    ref={ diagramRef }
                                    className="d2CodePanel__svg"
                                    role="img"
                                    aria-label={ `D2 diagram rendered with ${layout.toUpperCase()}` }
                                    style={ {
                                        aspectRatio: `${diagramDimensions.width} / ${diagramDimensions.height}`,
                                        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoomPercent / 100})`,
                                    } }
                                >
                                    <div
                                        className="d2CodePanel__svgContent"
                                        dangerouslySetInnerHTML={ { __html: svg } }
                                    />
                                    { activeCropSelection && (
                                        <div
                                            className={ `d2CodePanel__cropOverlay${cropInteraction ? " is-drafting" : ""}` }
                                            data-d2-crop-drag="move"
                                            title="Drag to move the JPG crop"
                                            style={ {
                                                left: `${( activeCropSelection.x / diagramDimensions.width ) * 100}%`,
                                                top: `${( activeCropSelection.y / diagramDimensions.height ) * 100}%`,
                                                width: `${( activeCropSelection.width / diagramDimensions.width ) * 100}%`,
                                                height: `${( activeCropSelection.height / diagramDimensions.height ) * 100}%`,
                                            } }
                                        >
                                            <span className="d2CodePanel__cropHandle is-nw" data-d2-crop-drag="nw" title="Resize from top left" />
                                            <span className="d2CodePanel__cropHandle is-n" data-d2-crop-drag="n" title="Resize from top" />
                                            <span className="d2CodePanel__cropHandle is-ne" data-d2-crop-drag="ne" title="Resize from top right" />
                                            <span className="d2CodePanel__cropHandle is-e" data-d2-crop-drag="e" title="Resize from right" />
                                            <span className="d2CodePanel__cropHandle is-se" data-d2-crop-drag="se" title="Resize from bottom right" />
                                            <span className="d2CodePanel__cropHandle is-s" data-d2-crop-drag="s" title="Resize from bottom" />
                                            <span className="d2CodePanel__cropHandle is-sw" data-d2-crop-drag="sw" title="Resize from bottom left" />
                                            <span className="d2CodePanel__cropHandle is-w" data-d2-crop-drag="w" title="Resize from left" />
                                        </div>
                                    ) }
                                </div>
                            ) : (
                                <p>Choose a layout and render the current D2 source.</p>
                            ) }
                        </div>
                        <DiagramScrollbar
                            className="d2HorizontalScrollbar"
                            orientation="horizontal"
                            ariaLabel="Horizontal D2 diagram scroll"
                            emptyValueText="Diagram fits horizontally"
                            max={ svg ? horizontalScroll.maxOffset : 0 }
                            value={ horizontalScroll.offset }
                            pageSize={ viewportRef.current?.clientWidth ?? 0 }
                            onChange={ setHorizontalScrollOffset }
                        />

                        <DiagramScrollbar
                            className="d2VerticalScrollbar"
                            orientation="vertical"
                            ariaLabel="Vertical D2 diagram scroll"
                            emptyValueText="Diagram fits vertically"
                            max={ svg ? verticalScroll.maxOffset : 0 }
                            value={ verticalScroll.offset }
                            pageSize={ viewportRef.current?.clientHeight ?? 0 }
                            onChange={ setVerticalScrollOffset }
                        />
                        <DiagramScrollbarCorner />
                        </div>
                        <ZoomSlider
                            className="d2ZoomSlider"
                            minPercent={ MIN_ZOOM_PERCENT }
                            maxPercent={ MAX_ZOOM_PERCENT }
                            valuePercent={ camera.zoomPercent }
                            onChange={ setZoomFromSlider }
                            onFitToWidth={ resetToFitWidth }
                            disabled={ !svg }
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
