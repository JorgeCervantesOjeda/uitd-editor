// scripts/_verify-validation-disabled-during-target-selection.mjs
// System test linked to the toolbar and Validation panel target-selection tests.

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch( { headless: true } );
const page = await browser.newPage( { viewport: { width: 1440, height: 900 } } );
page.setDefaultTimeout( 5000 );
const baseUrl = process.env.UITD_REFERENCE_URL ?? 'http://127.0.0.1:5173/';
const model = {
    version: 2,
    nodes: [
        { id: 1, x: 100, y: 100, w: 140, h: 40, title: 'Source', displayId: '1', parentId: null },
        { id: 2, x: 600, y: 100, w: 140, h: 40, title: 'Prior target', displayId: '1', parentId: null },
        { id: 5, x: 800, y: 250, w: 140, h: 40, title: 'New target', displayId: '3', parentId: null },
    ],
    actions: [
        { id: 3, originNodeId: 1, x: 260, y: 200, w: 180, h: 44, verb: 'clicks', complement: 'Choose', title: 'clicks "Choose"' },
    ],
    conditions: [],
    edges: [
        { id: 10, from: { kind: 'node', id: 1 }, to: { kind: 'action', id: 3 }, style: 'solid' },
        { id: 11, from: { kind: 'action', id: 3 }, to: { kind: 'node', id: 2 }, style: 'dashed1' },
    ],
};

try {
    await page.goto( baseUrl, { waitUntil: 'networkidle' } );
    await page.keyboard.press( 'Alt+f' );
    const chooserEvent = page.waitForEvent( 'filechooser' );
    await page.getByRole( 'menu', { name: 'File' } ).getByRole( 'button', { name: 'Open project' } ).click();
    await ( await chooserEvent ).setFiles( {
        name: 'validation-target-selection-fixture.json',
        mimeType: 'application/json',
        buffer: Buffer.from( JSON.stringify( model ) ),
    } );
    await page.locator( '[data-kbd-kind="node"][data-kbd-id="2"]' ).waitFor( { state: 'visible' } );

    const validationToggle = page.getByRole( 'button', { name: /Validation/ } );
    const validationRegion = page.getByRole( 'region', { name: 'Validation issues' } );
    const copyButton = page.getByRole( 'button', { name: 'Copy list' } );
    const invalidIssue = page.getByRole( 'button', { name: /Inconsistency.*UIID 1/ } );
    await validationRegion.waitFor( { state: 'visible' } );
    await copyButton.waitFor( { state: 'visible' } );
    const validationText = await validationRegion.innerText();
    assert.match( validationText, /Inconsistency.*UIID 1/, `Expected a duplicate-UIID diagnostic, received: ${validationText}` );
    await invalidIssue.waitFor( { state: 'visible' } );
    assert.equal( await validationToggle.isDisabled(), false );
    assert.equal( await copyButton.isDisabled(), false );
    assert.equal( await invalidIssue.isDisabled(), false );

    const action = page.locator( '[data-kbd-kind="action"][data-kbd-id="3"]' );
    await action.click( { button: 'right' } );
    await page.locator( '[data-context-menu="true"]' ).getByRole( 'button', { name: 'Go to target' } ).click();
    assert.equal( await validationRegion.isVisible(), true );
    assert.equal( await validationToggle.isDisabled(), true );
    assert.equal( await copyButton.isDisabled(), true );
    assert.equal( await invalidIssue.isDisabled(), true );

    await page.keyboard.press( 'Escape' );
    assert.equal( await validationToggle.isDisabled(), false );
    assert.equal( await copyButton.isDisabled(), false );
    assert.equal( await invalidIssue.isDisabled(), false );

    await action.click( { button: 'right' } );
    await page.locator( '[data-context-menu="true"]' ).getByRole( 'button', { name: 'Go to target' } ).click();
    await page.locator( '[data-kbd-kind="node"][data-kbd-id="5"]' ).click();
    assert.equal( await validationRegion.isVisible(), true );
    assert.equal( await validationToggle.isDisabled(), false );
    assert.equal( await copyButton.isDisabled(), false );
    assert.equal( await invalidIssue.isDisabled(), false );
} finally {
    await browser.close();
}
