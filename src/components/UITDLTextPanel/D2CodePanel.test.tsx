// src/components/UITDLTextPanel/D2CodePanel.test.tsx
// Verifies canvas color propagation and diagram-prioritized D2 window maximization.

import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock( "@monaco-editor/react", () => ( {
    default: ( { value }: { value: string } ) => (
        <textarea aria-label="Mock D2 source" value={ value } readOnly />
    ),
} ) );

const d2RendererMocks = vi.hoisted( () => ( {
    isD2CompilerLoaded: vi.fn( (): boolean => false ),
    loadD2Compiler: vi.fn( async (): Promise<void> => undefined ),
    renderD2: vi.fn( async (): Promise<string> => '<svg viewBox="0 0 100 300"></svg>' ),
} ) );

vi.mock( "./renderD2", () => d2RendererMocks );

vi.mock( "../../state/store", () => ( {
    useAppStore: ( selector: ( state: object ) => unknown ) => selector( {
        nodes: [ {
            id: 1,
            displayId: "1",
            colorFill: "#112233",
            colorStroke: "#445566",
            colorText: "#f8fafc",
        } ],
    } ),
} ) );

import { D2CodePanel } from "./D2CodePanel";

const SOURCE = `UITD "Colors" {
    UI 1 "Start" actions { clicks "Finish"; }
    UI 2 "End" actions {}
    FRAGMENT "Flow" {
        DRAW { 1, 2 };
        TRANSITION from 1 to 2 if user clicks "Finish";
    }
}`;

describe( "D2CodePanel", () => {
    beforeEach( () => {
        d2RendererMocks.isD2CompilerLoaded.mockReturnValue( false );
        d2RendererMocks.loadD2Compiler.mockReset();
        d2RendererMocks.loadD2Compiler.mockResolvedValue( undefined );
        d2RendererMocks.renderD2.mockReset();
        d2RendererMocks.renderD2.mockResolvedValue( '<svg viewBox="0 0 100 300"></svg>' );
    } );

    it( "loads D2 lazily and reports loading before compilation", async () => {
        let resolveCompilerLoad: ( () => void ) | null = null;
        let resolveRender: ( ( svg: string ) => void ) | null = null;
        d2RendererMocks.loadD2Compiler.mockImplementationOnce( () => new Promise<void>( resolve => {
            resolveCompilerLoad = resolve;
        } ) );
        d2RendererMocks.renderD2.mockImplementationOnce( () => new Promise<string>( resolve => {
            resolveRender = resolve;
        } ) );

        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );

        expect( d2RendererMocks.loadD2Compiler ).not.toHaveBeenCalled();
        expect( d2RendererMocks.renderD2 ).not.toHaveBeenCalled();

        fireEvent.click( screen.getByRole( "button", { name: "Render diagram" } ) );
        expect( screen.getByText( "Loading D2..." ) ).toBeTruthy();

        await waitFor( () => expect( d2RendererMocks.loadD2Compiler ).toHaveBeenCalledTimes( 1 ) );
        await act( async () => {
            resolveCompilerLoad?.();
        } );

        await waitFor( () => {
            expect( screen.getByText( "Compiling D2 source..." ) ).toBeTruthy();
        } );
        await waitFor( () => expect( d2RendererMocks.renderD2 ).toHaveBeenCalledTimes( 1 ) );

        await act( async () => {
            resolveRender?.( '<svg viewBox="0 0 100 300"></svg>' );
        } );
        await waitFor( () => {
            expect( screen.getByText( "D2 rendered with ELK." ) ).toBeTruthy();
        } );
    } );

    it( "embeds canvas colors and maximizes with a restorable state", () => {
        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );

        const source = screen.getByRole( "textbox", { name: "Mock D2 source" } ) as HTMLTextAreaElement;
        expect( source.value ).toContain( 'style.fill: "#112233"' );

        fireEvent.click( screen.getByRole( "button", { name: "Maximize D2 window" } ) );

        const dialog = screen.getByRole( "dialog", { name: "D2 source editor" } );
        expect( dialog.classList.contains( "is-maximized" ) ).toBe( true );
        expect( screen.getByRole( "button", { name: "Restore D2 window" } ) ).toBeTruthy();
    } );

    it( "collapses and resizes the D2 source panel", () => {
        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );

        const preview = screen.getByLabelText( "Rendered D2 diagram" );
        const workspace = preview.closest( ".d2CodePanel__workspace" ) as HTMLElement;
        const divider = screen.getByRole( "separator", { name: "Resize D2 source panel" } );
        Object.defineProperty( workspace, "clientWidth", { value: 1000, configurable: true } );
        Object.defineProperties( divider, {
            setPointerCapture: { value: vi.fn() },
            hasPointerCapture: { value: vi.fn().mockReturnValue( true ) },
            releasePointerCapture: { value: vi.fn() },
        } );

        fireEvent.pointerDown( divider, { button: 0, pointerId: 1, clientX: 400 } );
        fireEvent.pointerMove( divider, { pointerId: 1, clientX: 500 } );
        fireEvent.pointerUp( divider, { pointerId: 1 } );

        expect( workspace.style.getPropertyValue( "--d2-source-width" ) ).toBe( "520px" );

        fireEvent.click( screen.getByRole( "button", { name: "Collapse D2 source" } ) );
        expect( workspace.classList.contains( "is-source-collapsed" ) ).toBe( true );

        fireEvent.click( screen.getByRole( "button", { name: "Expand D2 source" } ) );
        expect( workspace.classList.contains( "is-source-collapsed" ) ).toBe( false );
    } );

    it( "keeps the collapsed D2 preview full width while maximized", () => {
        const textPanelStyles = readFileSync(
            "src/components/UITDLTextPanel/UITDLTextPanel.css",
            "utf8",
        );

        expect( textPanelStyles ).toMatch(
            /\.d2CodePanel\.is-maximized \.d2CodePanel__workspace\.is-source-collapsed\s*{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
        );
    } );

    it( "matches the main canvas wheel zoom and modified-drag pan", async () => {
        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );
        fireEvent.click( screen.getByRole( "button", { name: "Render diagram" } ) );
        const diagram = await screen.findByRole( "img", { name: "D2 diagram rendered with ELK" } );
        expect( diagram.style.aspectRatio ).toBe( "100 / 300" );
        const viewport = screen.getByLabelText( "D2 pan and zoom viewport" );
        Object.defineProperties( viewport, {
            setPointerCapture: { value: vi.fn() },
            hasPointerCapture: { value: vi.fn().mockReturnValue( true ) },
            releasePointerCapture: { value: vi.fn() },
        } );
        vi.spyOn( diagram, "getBoundingClientRect" ).mockImplementation( () => {
            const match = diagram.style.transform.match(
                /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
            );
            const panX = Number( match?.[ 1 ] ?? 0 );
            const panY = Number( match?.[ 2 ] ?? 0 );
            const scale = Number( match?.[ 3 ] ?? 1 );
            const left = 20 + panX;
            const top = 20 + panY;
            const width = 400 * scale;
            const height = 1200 * scale;
            return {
                left,
                top,
                right: left + width,
                bottom: top + height,
                width,
                height,
                x: left,
                y: top,
                toJSON: () => ( {} ),
            };
        } );

        fireEvent.wheel( viewport, { deltaY: -100, clientX: 100, clientY: 80 } );
        expect( diagram.style.transform ).toContain( "scale(1.1)" );
        expect( diagram.style.transform ).toContain( "translate(-8" );

        act( () => {
            viewport.dispatchEvent( new WheelEvent( "wheel", {
                deltaY: -100,
                clientX: 100,
                clientY: 80,
                bubbles: true,
                cancelable: true,
            } ) );
            viewport.dispatchEvent( new WheelEvent( "wheel", {
                deltaY: -100,
                clientX: 100,
                clientY: 80,
                bubbles: true,
                cancelable: true,
            } ) );
        } );
        expect( diagram.style.transform ).toContain( "scale(1.331" );
        expect( diagram.style.transform ).toContain( "translate(-26.48" );

        const zoomSlider = screen.getByRole( "slider", { name: "Zoom" } );
        fireEvent.change( zoomSlider, { target: { value: "200" } } );
        expect( diagram.style.transform ).toContain( "scale(2)" );
        expect( screen.getByText( "200%" ) ).toBeTruthy();

        for ( let indexOfWheel = 0; indexOfWheel < 30; indexOfWheel++ ) {
            fireEvent.wheel( viewport, { deltaY: -100, clientX: 100, clientY: 80 } );
        }
        const transformAtMaximumZoom = diagram.style.transform;
        fireEvent.wheel( viewport, { deltaY: -100, clientX: 100, clientY: 80 } );
        expect( diagram.style.transform ).toBe( transformAtMaximumZoom );

        const transformBeforePlainDrag = diagram.style.transform;
        fireEvent.pointerDown( viewport, { button: 0, pointerId: 7, clientX: 120, clientY: 100 } );
        fireEvent.pointerMove( viewport, { pointerId: 7, clientX: 70, clientY: 60 } );
        expect( diagram.style.transform ).toBe( transformBeforePlainDrag );

        fireEvent.keyDown( window, { key: "Control", ctrlKey: true } );
        expect( viewport.classList.contains( "is-grab-ready" ) ).toBe( true );
        fireEvent.pointerDown( viewport, {
            button: 0,
            pointerId: 8,
            clientX: 120,
            clientY: 100,
            ctrlKey: true,
        } );
        fireEvent.pointerMove( viewport, { pointerId: 8, clientX: 70, clientY: 60 } );
        expect( diagram.style.transform ).not.toBe( transformBeforePlainDrag );
        expect( viewport.classList.contains( "is-panning" ) ).toBe( true );
        fireEvent.pointerUp( viewport, { pointerId: 8 } );
        fireEvent.keyUp( window, { key: "Control", ctrlKey: false } );
        fireEvent.pointerUp( viewport, { pointerId: 7 } );
        expect( viewport.classList.contains( "is-panning" ) ).toBe( false );

        viewport.scrollLeft = 70;
        viewport.scrollTop = 90;
        fireEvent.click( screen.getByRole( "button", { name: "Render diagram" } ) );
        await waitFor( () => {
            expect( diagram.style.transform ).toBe( "translate(0px, 0px) scale(1)" );
            expect( viewport.scrollLeft ).toBe( 0 );
            expect( viewport.scrollTop ).toBe( 0 );
        } );
    } );

    it( "limits D2 scrollbars to the rendered diagram bounds", async () => {
        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );
        fireEvent.click( screen.getByRole( "button", { name: "Render diagram" } ) );
        const diagram = await screen.findByRole( "img", { name: "D2 diagram rendered with ELK" } );
        const viewport = screen.getByLabelText( "D2 pan and zoom viewport" );
        Object.defineProperties( viewport, {
            clientWidth: { value: 200, configurable: true },
            clientHeight: { value: 300, configurable: true },
        } );
        Object.defineProperties( diagram, {
            offsetWidth: { value: 400, configurable: true },
            offsetHeight: { value: 1200, configurable: true },
        } );
        vi.spyOn( diagram, "getBoundingClientRect" ).mockImplementation( () => {
            const match = diagram.style.transform.match(
                /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
            );
            const panX = Number( match?.[ 1 ] ?? 0 );
            const panY = Number( match?.[ 2 ] ?? 0 );
            const scale = Number( match?.[ 3 ] ?? 1 );
            const left = panX;
            const top = panY;
            const width = 240 * scale;
            const height = 900 * scale;
            return {
                left,
                top,
                right: left + width,
                bottom: top + height,
                width,
                height,
                x: left,
                y: top,
                toJSON: () => ( {} ),
            };
        } );

        fireEvent.change( screen.getByRole( "slider", { name: "Zoom" } ), { target: { value: "200" } } );

        const horizontalScrollbar = screen.getByRole( "slider", { name: "Horizontal D2 diagram scroll" } );
        const verticalScrollbar = screen.getByRole( "slider", { name: "Vertical D2 diagram scroll" } );
        await waitFor( () => {
            expect( horizontalScrollbar.getAttribute( "max" ) ).toBe( "280" );
            expect( verticalScrollbar.getAttribute( "max" ) ).toBe( "1500" );
        } );

        fireEvent.change( horizontalScrollbar, { target: { value: "9999" } } );
        fireEvent.change( verticalScrollbar, { target: { value: "9999" } } );

        await waitFor( () => {
            expect( diagram.style.transform ).toBe( "translate(-280px, -1500px) scale(2)" );
        } );
    } );

    it( "selects a D2 SVG crop and exposes a high-resolution JPG export", async () => {
        render( <D2CodePanel text={ SOURCE } theme="light" onClose={ vi.fn() } /> );
        fireEvent.click( screen.getByRole( "button", { name: "Render diagram" } ) );
        const diagram = await screen.findByRole( "img", { name: "D2 diagram rendered with ELK" } );
        const viewport = screen.getByLabelText( "D2 pan and zoom viewport" );
        Object.defineProperties( viewport, {
            setPointerCapture: { value: vi.fn() },
            hasPointerCapture: { value: vi.fn().mockReturnValue( true ) },
            releasePointerCapture: { value: vi.fn() },
        } );
        vi.spyOn( diagram, "getBoundingClientRect" ).mockReturnValue( {
            left: 10,
            top: 20,
            right: 410,
            bottom: 1220,
            width: 400,
            height: 1200,
            x: 10,
            y: 20,
            toJSON: () => ( {} ),
        } );

        fireEvent.click( screen.getByRole( "button", { name: "Select JPG crop" } ) );
        expect( viewport.classList.contains( "is-cropping" ) ).toBe( true );

        fireEvent.pointerDown( viewport, { button: 0, pointerId: 10, clientX: 110, clientY: 320 } );
        fireEvent.pointerMove( viewport, { pointerId: 10, clientX: 310, clientY: 620 } );
        fireEvent.pointerUp( viewport, { pointerId: 10, clientX: 310, clientY: 620 } );

        expect( screen.getByText( /JPG crop will export at 2200 x 3300 px/ ) ).toBeTruthy();
        expect( ( screen.getByRole( "button", { name: "Export JPG crop" } ) as HTMLButtonElement ).disabled ).toBe( false );

        fireEvent.pointerDown( screen.getByTitle( "Drag to move the JPG crop" ), {
            button: 0,
            pointerId: 11,
            clientX: 210,
            clientY: 470,
        } );
        fireEvent.pointerMove( viewport, { pointerId: 11, clientX: 250, clientY: 530 } );
        fireEvent.pointerUp( viewport, { pointerId: 11, clientX: 250, clientY: 530 } );
        expect( screen.getByText( /JPG crop updated/ ) ).toBeTruthy();

        fireEvent.pointerDown( screen.getByTitle( "Resize from right" ), {
            button: 0,
            pointerId: 12,
            clientX: 350,
            clientY: 530,
        } );
        fireEvent.pointerMove( viewport, { pointerId: 12, clientX: 390, clientY: 530 } );
        fireEvent.pointerUp( viewport, { pointerId: 12, clientX: 390, clientY: 530 } );
        expect( screen.getByText( /JPG crop will export at 2550 x 3188 px/ ) ).toBeTruthy();
    } );
} );
