// scripts/verify-fragment-text-selection.mjs
// System check linking the fragment identity unit/integration tests to real Monaco clicks and canvas frames.

import assert from "node:assert/strict";
import { chromium } from "playwright";

const source = `UITD "Reordered" {
    UI 1 "First" actions { clicks "First"; }
    UI 2 "Second" actions { clicks "Second"; }
    FRAGMENT "Second" {
        DRAW { 2 };
        TRANSITION from 2 to 2 if user clicks "Second";
    }
    FRAGMENT "First" {
        DRAW { 1 };
        TRANSITION from 1 to 1 if user clicks "First";
    }
}`;

const browser = await chromium.launch( { headless: true } );
try {
    const page = await browser.newPage( { viewport: { width: 1600, height: 1000 } } );
    await page.addInitScript( ( draft ) => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "false" );
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "false" );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", draft );
        localStorage.setItem( "uitd-editor/appstate", JSON.stringify( {
            version: 2,
            state: {
                nodes: [
                    { id: 1, displayId: "1", title: "First", x: 600, y: 400 },
                    { id: 20, displayId: "2", title: "Second", x: 100, y: 100 },
                ],
                actions: [], conditions: [], edges: [], rigidBlocks: [],
                fragmentTitles: { "node:1": "First", "node:20": "Second" },
                nextId: 21, nextActionId: 1, nextEdgeId: 1, nextRigidBlockId: 1,
            },
        } ) );
    }, source );
    await page.goto( process.env.UITD_TEST_URL ?? "http://127.0.0.1:5173/" );
    await page.locator( ".monaco-editor .view-line" ).first().waitFor( { timeout: 60000 } );
    await page.getByRole( "button", { name: "Apply to diagram", exact: true } ).click();
    await page.waitForFunction( () => document.querySelector( ".uitdlTextPanel__summary" )?.textContent.includes( "Synchronized" ) );

    const readSelection = () => page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        const state = useAppStore.getState();
        return {
            nodes: [ ...state.selection ],
            origins: state.actions.filter( action => state.selectionActions.has( action.id ) ).map( action => action.originNodeId ),
            completeFrames: document.querySelectorAll( '[data-fragment-selection="complete"]' ).length,
        };
    } );
    const clickFragment = async ( title, expectedId ) => {
        const line = page.locator( ".monaco-editor .view-line" ).filter( { hasText: `FRAGMENT "${title}"` } );
        await line.getByText( "FRAGMENT", { exact: true } ).click();
        await page.waitForFunction( async ( id ) => {
            const { useAppStore } = await import( "/src/state/store.ts" );
            return useAppStore.getState().selection.has( id );
        }, expectedId );
        assert.deepEqual( await readSelection(), { nodes: [ expectedId ], origins: [ expectedId ], completeFrames: 1 } );
    };

    await clickFragment( "Second", 20 );
    await clickFragment( "First", 1 );
    await page.evaluate( async () => {
        const { useAppStore } = await import( "/src/state/store.ts" );
        useAppStore.getState().compactFragmentsToGrid( { captureHistory: false } );
    } );
    await clickFragment( "Second", 20 );
    await clickFragment( "First", 1 );
    console.log( "PASS: real Monaco FRAGMENT clicks select the correct node, action, and canvas frame before and after grid compaction." );
} finally {
    await browser.close();
}
