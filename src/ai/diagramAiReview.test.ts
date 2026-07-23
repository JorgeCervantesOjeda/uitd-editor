// src/ai/diagramAiReview.test.ts
// Verifies the AI review payload includes all context required for UITDL feedback.

import { describe, expect, it } from "vitest";
import type { AppState } from "../state/types";
import { buildDiagramAiReviewPayload, buildDiagramAiReviewPromptText } from "./diagramAiReview";

describe( "buildDiagramAiReviewPayload", () => {
    it( "includes the diagram snapshot, generated UITDL, visual and official validation issues, and complete skill context", () => {
        const state = {
            nodes: [
                {
                    id: 1,
                    x: 20,
                    y: 30,
                    title: "Inicio",
                    displayId: "1",
                },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            panzoom: { x: 0, y: 0, zoom: 1 },
            viewBox: { w: 800, h: 600 },
        } as unknown as AppState;

        const payload = buildDiagramAiReviewPayload( state, "Review this." );

        expect( payload.prompt ).toBe( "Review this." );
        expect( payload.diagramJson.nodes ).toHaveLength( 1 );
        expect( payload.generatedUitdl ).toContain( 'UITD "UITD Diagram"' );
        expect( payload.generatedUitdl ).toContain( 'UI 1 "Inicio" actions {' );
        expect( payload.visualDiagramIssues.some( issue => issue.code === "ui-no-effective-outgoing" ) ).toBe( true );
        expect( payload.visualDiagramIssues.every( issue => issue.source === "canvas-model" ) ).toBe( true );
        expect( payload.officialUitdlIssues ).toEqual( expect.any( Array ) );
        expect( payload.officialUitdlIssues.every( issue => issue.source === "generated-uitdl" ) ).toBe( true );
        expect( payload.skillContext ).toContain( "# UITDL Authoring" );
        expect( payload.skillContext ).toContain( "## Compact grammar" );

        const promptText = buildDiagramAiReviewPromptText( payload );

        expect( promptText ).toContain( "# Complete uitd-authoring skill bundled in the app" );
        expect( promptText ).toContain( "# Diagram JSON" );
        expect( promptText ).toContain( "# Temporary UITDL generated from the diagram JSON" );
        expect( promptText ).toContain( "# Canvas model validation errors and warnings" );
        expect( promptText ).toContain( "# Official UITDL validator errors and warnings for the generated UITDL" );
        expect( promptText ).toContain( "The canvas model and generated UITDL text are different sources and can be out of sync." );
        expect( promptText ).toContain( "Review this." );
    } );
} );
