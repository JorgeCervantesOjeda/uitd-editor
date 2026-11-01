// scripts/verify-canvas-zoom.mjs
// Real-browser wheel, slider, fit and resize checks linked to canvasZoomBounds units and camera.slice integration.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch( { headless: true } );
try {
    const page = await browser.newPage( { viewport: { width: 1500, height: 950 } } );
    await page.addInitScript( () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "false" );
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "false" );
    } );
    await page.goto( process.env.UITD_TEST_URL ?? "http://127.0.0.1:5173/" );
    const canvas = page.getByLabel( "Diagram canvas", { exact: true } );
    await canvas.waitFor();
    await page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        useAppStore.setState( {
            nodes: [ { id: 1, title: "Zoom test", x: 400, y: 300, w: 400, h: 240 } ],
            actions: [], conditions: [], edges: [], fragmentTitles: {}, autoArrangeQueue: [],
        } );
    } );
    await page.waitForFunction( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        return state.canvasZoomBounds && state.canvasFitAppliedRequest === state.canvasFitRequest;
    } );
    const readCamera = () => page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        return { camera: state.panzoom, bounds: state.canvasZoomBounds, fitZoom: state.canvasFitZoom };
    } );
    const assertMargins = async () => {
        const { camera, bounds: { geometry, viewport } } = await readCamera();
        const minimum = Math.max( viewport.width / ( 3 * geometry.width ), viewport.height / ( 3 * geometry.height ) );
        assert.ok( camera.zoom >= minimum - 1e-8, "zoom cannot fall below dynamic minimum" );
        for ( const [ margin, limit ] of [
            [ camera.x + geometry.x * camera.zoom - viewport.x, viewport.width / 3 ],
            [ viewport.x + viewport.width - camera.x - ( geometry.x + geometry.width ) * camera.zoom, viewport.width / 3 ],
            [ camera.y + geometry.y * camera.zoom - viewport.y, viewport.height / 3 ],
            [ viewport.y + viewport.height - camera.y - ( geometry.y + geometry.height ) * camera.zoom, viewport.height / 3 ],
        ] ) assert.ok( margin <= limit + 1e-6, `margin ${margin} exceeds ${limit}` );
        return minimum;
    };

    await assertMargins();
    const surface = await canvas.boundingBox();
    await page.mouse.move( surface.x + surface.width * 0.8, surface.y + surface.height * 0.8 );
    for ( let indexOfWheel = 0; indexOfWheel < 50; indexOfWheel++ ) {
        await page.mouse.wheel( 0, 200 );
    }
    await page.evaluate( () => new Promise( resolve => requestAnimationFrame( resolve ) ) );
    const minimum = await assertMargins();
    assert.ok( Math.abs( ( await readCamera() ).camera.zoom - minimum ) < 1e-8 );

    const slider = page.locator( ".canvasZoomSlider input" );
    await slider.focus();
    await slider.press( "End" );
    await assertMargins();
    await slider.press( "Home" );
    await assertMargins();
    const beforeResizeState = await readCamera();
    const beforeResize = beforeResizeState.bounds.viewport;
    await page.setViewportSize( { width: 2400, height: 950 } );
    await page.waitForFunction( async previous => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        const bounds = state.canvasZoomBounds;
        const viewport = bounds?.viewport;
        const surface = document.querySelector( '[aria-label="Diagram canvas"]' ).getBoundingClientRect();
        const fitWidth = viewport?.width * ( 1 - 2 * Math.min( 16, surface.width / 4 ) / surface.width );
        return viewport && ( viewport.width !== previous.width || viewport.height !== previous.height )
            && Math.abs( state.canvasFitZoom - fitWidth / bounds.geometry.width ) < 1e-6;
    }, beforeResize );
    const resizedMinimum = await assertMargins();
    const afterResize = await readCamera();
    const expectedResizeZoom = Math.max( resizedMinimum,
        beforeResizeState.camera.zoom / beforeResizeState.fitZoom * afterResize.fitZoom );
    assert.ok( Math.abs( afterResize.camera.zoom - expectedResizeZoom ) < 1e-6,
        `resize must preserve relative zoom once: ${afterResize.camera.zoom} versus ${expectedResizeZoom}` );

    await page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        useAppStore.setState( { nodes: [ { id: 1, title: "Very wide diagram", x: 400, y: 300, w: 6000, h: 50 } ] } );
    } );
    await page.waitForFunction( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        return useAppStore.getState().canvasZoomBounds?.geometry.width >= 6000;
    } );
    await slider.press( "Home" );
    await assertMargins();
    const wideFloorZoom = ( await readCamera() ).camera.zoom;
    await slider.press( "End" );
    assert.ok( ( await readCamera() ).camera.zoom > wideFloorZoom, "very wide diagrams must retain zoom-in headroom" );
    await slider.press( "Home" );
    await page.getByRole( "button", { name: "Fit diagram to viewport width", exact: true } ).click();
    await page.waitForFunction( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        return state.canvasFitAppliedRequest === state.canvasFitRequest;
    } );
    await assertMargins();
    console.log( "PASS: wheel, slider, fit-to-width and resize respect the zoom floor and four one-third margins, including a wide diagram." );
} finally {
    await browser.close();
}
