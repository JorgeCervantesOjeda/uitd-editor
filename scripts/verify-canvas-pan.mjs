// scripts/verify-canvas-pan.mjs
// Real-browser system coverage linked to visibleCanvasPan unit and DOM integration tests.
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
            nodes: [ { id: 1, title: "Visible anchor", x: 400, y: 300, w: 400, h: 240 } ],
            actions: [], conditions: [], edges: [], fragmentTitles: {}, autoArrangeQueue: [],
        } );
    } );
    await page.waitForFunction( () => !!document.querySelector( '[data-node-id="1"]' ) );
    // Wait for initial geometry/fit to settle using consecutive rendered frames.
    await page.evaluate( () => new Promise( resolve => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );
    await page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        const { geometry, viewport } = state.canvasZoomBounds;
        // Test freedom to pan above the floor: at the floor the short axis
        // intentionally has no room left before a one-third margin is exceeded.
        const zoom = Math.max( viewport.width / ( 3 * geometry.width ), viewport.height / ( 3 * geometry.height ) ) * 3;
        state.setCanvasCamera( {
            zoom,
            x: viewport.x + viewport.width / 2 - ( geometry.x + geometry.width / 2 ) * zoom,
            y: viewport.y + viewport.height / 2 - ( geometry.y + geometry.height / 2 ) * zoom,
        }, state.canvasFitZoom );
    } );
    await page.evaluate( () => new Promise( resolve => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );
    const initialCamera = await page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        return useAppStore.getState().panzoom;
    } );
    const assertVisible = async () => {
        const visible = await page.evaluate( () => {
            const viewport = document.querySelector( '[aria-label="Diagram canvas"]' ).getBoundingClientRect();
            const toolbar = document.querySelector( ".topToolbar" ).getBoundingClientRect();
            return Array.from( document.querySelectorAll( '[data-fragment-selection]:not([data-export="ignore"])' ) ).some( element => {
                const rect = element.getBoundingClientRect();
                return rect.right > viewport.left && rect.left < viewport.right
                    && rect.bottom > Math.max( viewport.top, toolbar.bottom ) && rect.top < viewport.bottom;
            } );
        } );
        assert.equal( visible, true, "pan must leave a fragment rectangle visible" );
    };
    const bounds = await canvas.boundingBox();
    for ( const [ dx, dy ] of [ [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ], [ 1, 1 ], [ -1, -1 ] ] ) {
        await page.evaluate( async camera => {
            const { useAppStore } = await import( "/src/state/store.ts" );
            useAppStore.setState( { panzoom: camera } );
        }, initialCamera );
        await page.evaluate( () => new Promise( resolve => requestAnimationFrame( resolve ) ) );
        const start = await page.evaluate( () => {
            const svg = document.querySelector( '[aria-label="Diagram canvas"]' );
            const viewport = svg.getBoundingClientRect();
            for ( const y of [ 0.99, 0.01, 0.9, 0.2, 0.5 ] ) {
                for ( const x of [ 0.01, 0.99, 0.1, 0.9, 0.5 ] ) {
                    const clientX = viewport.left + viewport.width * x;
                    const clientY = viewport.top + viewport.height * y;
                    const element = document.elementFromPoint( clientX, clientY );
                    if ( element === svg || element?.matches( '[data-fragment-selection]' ) ) return { x: clientX, y: clientY };
                }
            }
            throw new Error( "No blank background point available for real pan" );
        } );
        await page.mouse.move( start.x, start.y );
        await page.mouse.down( { button: "middle" } );
        for ( let indexOfStep = 1; indexOfStep <= 5; indexOfStep++ ) {
            await page.mouse.move( Math.max( bounds.x + 5, Math.min( bounds.x + bounds.width - 5, start.x + dx * bounds.width * 0.08 * indexOfStep ) ),
                Math.max( bounds.y + 100, Math.min( bounds.y + bounds.height - 5, start.y + dy * bounds.height * 0.08 * indexOfStep ) ) );
            await assertVisible();
        }
        await page.mouse.up( { button: "middle" } );
        await assertVisible();
        const finalCamera = await page.evaluate( async () => {
            const { useAppStore } = await import( "/src/state/store.ts" );
            return useAppStore.getState().panzoom;
        } );
        assert.ok( finalCamera.x !== initialCamera.x || finalCamera.y !== initialCamera.y,
            `direction ${dx},${dy} must move camera ${JSON.stringify( { initialCamera, start, bounds,
                details: await page.evaluate( () => {
                    const element = document.querySelector( '[data-fragment-selection]' );
                    return { body: element.getBoundingClientRect().toJSON(), viewport: document.querySelector( '[aria-label="Diagram canvas"]' ).getBoundingClientRect().toJSON() };
                } ),
            } )}` );
    }
    // Reproduce the early-stop defect with real middle-button input: the
    // vertical axis has only 12 px left while horizontal travel can reach 1/3.
    await page.evaluate( async camera => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        useAppStore.getState().setCanvasCamera( camera, useAppStore.getState().canvasFitZoom );
    }, initialCamera );
    await page.evaluate( () => new Promise( resolve => requestAnimationFrame( resolve ) ) );
    const axisFixtureCamera = await page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        const svg = document.querySelector( '[aria-label="Diagram canvas"]' );
        const viewport = svg.getBoundingClientRect();
        const top = Math.max( viewport.top, document.querySelector( ".topToolbar" ).getBoundingClientRect().bottom );
        const body = document.querySelector( '[data-fragment-selection]' ).getBoundingClientRect();
        const targetTop = top + ( viewport.bottom - top ) / 3 - 12;
        state.setCanvasCamera( {
            ...state.panzoom, y: state.panzoom.y + ( targetTop - body.top ) / svg.getScreenCTM().d,
        }, state.canvasFitZoom );
        return useAppStore.getState().panzoom;
    } );
    const dragToHorizontalLimit = async dy => {
        await page.evaluate( async camera => {
            const { useAppStore } = await import( "/src/state/store.ts" );
            useAppStore.getState().setCanvasCamera( camera, useAppStore.getState().canvasFitZoom );
        }, axisFixtureCamera );
        await page.evaluate( () => new Promise( resolve => requestAnimationFrame( resolve ) ) );
        const start = { x: bounds.x + 5, y: bounds.y + 5 };
        assert.ok( await page.evaluate( point => {
            const element = document.elementFromPoint( point.x, point.y );
            return element === document.querySelector( '[aria-label="Diagram canvas"]' )
                || element?.matches( '[data-fragment-selection]' );
        }, start ), "fixture starts on canvas or fragment background" );
        await page.mouse.move( start.x, start.y );
        await page.mouse.down( { button: "middle" } );
        for ( let indexOfStep = 1; indexOfStep <= 10; indexOfStep++ ) {
            await page.mouse.move( start.x + 60 * indexOfStep, start.y + dy * indexOfStep / 10 );
            await assertVisible();
        }
        await page.mouse.up( { button: "middle" } );
        return page.evaluate( () => {
            const viewport = document.querySelector( '[aria-label="Diagram canvas"]' ).getBoundingClientRect();
            const body = document.querySelector( '[data-fragment-selection]' ).getBoundingClientRect();
            return ( body.left - viewport.left ) / viewport.width;
        } );
    };
    const horizontalMargin = await dragToHorizontalLimit( 0 );
    const diagonalMargin = await dragToHorizontalLimit( 200 );
    assert.ok( Math.abs( horizontalMargin - 1 / 3 ) < 0.001, `horizontal margin is ${horizontalMargin}` );
    assert.ok( Math.abs( diagonalMargin - horizontalMargin ) < 0.001,
        `diagonal margin ${diagonalMargin} must reach horizontal margin ${horizontalMargin}` );

    for ( const [ dx, dy, side ] of [ [ 1, 0, "left" ], [ -1, 0, "right" ], [ 0, 1, "top" ], [ 0, -1, "bottom" ] ] ) {
        await page.evaluate( async camera => {
            const { useAppStore } = await import( "/src/state/store.ts" );
            useAppStore.getState().setCanvasCamera( camera, useAppStore.getState().canvasFitZoom );
        }, initialCamera );
        await page.evaluate( () => new Promise( resolve => requestAnimationFrame( resolve ) ) );
        const start = await page.evaluate( ( { dx, dy } ) => {
            const svg = document.querySelector( '[aria-label="Diagram canvas"]' );
            const rect = svg.getBoundingClientRect();
            const xs = dx === 0 ? [ 0.01, 0.99, 0.1, 0.9, 0.5 ]
                : dx < 0 ? [ 0.99, 0.95, 0.9, 0.75 ] : [ 0.01, 0.05, 0.1, 0.25 ];
            const ys = dy === 0 ? [ 0.01, 0.99, 0.1, 0.9, 0.5 ]
                : dy < 0 ? [ 0.99, 0.95, 0.9, 0.75 ] : [ 0.01, 0.05, 0.1, 0.25 ];
            for ( const y of ys ) for ( const x of xs ) {
                const point = { x: rect.left + rect.width * x, y: rect.top + rect.height * y };
                const element = document.elementFromPoint( point.x, point.y );
                if ( element === svg || element?.matches( '[data-fragment-selection]' ) ) return point;
            }
            throw new Error( `No pan start point available for ${dx},${dy}; ${JSON.stringify( {
                viewport: rect.toJSON(), examples: ys.map( y => {
                    const element = document.elementFromPoint( rect.left + rect.width * xs[ 0 ], rect.top + rect.height * y );
                    return element?.outerHTML.slice( 0, 140 );
                } ),
            } )}` );
        }, { dx, dy } );
        const target = { x: dx ? bounds.x + ( dx > 0 ? bounds.width - 5 : 5 ) : start.x,
            y: dy ? bounds.y + ( dy > 0 ? bounds.height - 5 : 5 ) : start.y };
        await page.mouse.move( start.x, start.y );
        await page.mouse.down( { button: "middle" } );
        for ( let indexOfStep = 1; indexOfStep <= 10; indexOfStep++ ) {
            await page.mouse.move( start.x + ( target.x - start.x ) * indexOfStep / 10,
                start.y + ( target.y - start.y ) * indexOfStep / 10 );
            await assertVisible();
        }
        await page.mouse.up( { button: "middle" } );
        const margin = await page.evaluate( side => {
            const viewport = document.querySelector( '[aria-label="Diagram canvas"]' ).getBoundingClientRect();
            const frame = document.querySelector( '[data-fragment-selection]' ).getBoundingClientRect();
            return side === "left" ? ( frame.left - viewport.left ) / viewport.width
                : side === "right" ? ( viewport.right - frame.right ) / viewport.width
                    : side === "top" ? ( frame.top - viewport.top ) / viewport.height
                        : ( viewport.bottom - frame.bottom ) / viewport.height;
        }, side );
        assert.ok( Math.abs( margin - 1 / 3 ) < 0.001, `${side} fragment margin must reach 1/3; got ${margin}` );
    }

    await page.evaluate( async camera => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        useAppStore.setState( {
            panzoom: camera,
            nodes: [
                { id: 1, title: "Visible anchor", x: 400, y: 300, w: 400, h: 240 },
                { id: 2, title: "Distant horizontal", x: 6000, y: 300, w: 400, h: 240 },
                { id: 3, title: "Distant vertical", x: 400, y: 6000, w: 400, h: 240 },
            ],
        } );
    }, initialCamera );
    await page.waitForFunction( () => {
        const horizontal = document.querySelector( '[aria-label="Horizontal canvas scroll"]' );
        const vertical = document.querySelector( '[aria-label="Vertical canvas scroll"]' );
        return !horizontal.disabled && !vertical.disabled;
    } );
    for ( const label of [ "Horizontal canvas scroll", "Vertical canvas scroll" ] ) {
        const scrollbar = page.getByLabel( label, { exact: true } );
        await scrollbar.focus();
        await scrollbar.press( "End" );
        await assertVisible();
        await scrollbar.press( "Home" );
        await assertVisible();
    }
    console.log( "PASS: fragment rectangles reach 33.33% on all four edges with middle-button pan; diagonal independence, visibility and scrollbar gaps pass." );
} finally {
    await browser.close();
}
