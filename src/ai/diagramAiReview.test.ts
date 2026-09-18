// src/ai/diagramAiReview.test.ts
// Verifies the AI review prompt keeps only NotebookLM instructions and UITDL evidence.

import { describe, expect, it } from "vitest";
import type { AppState } from "../state/types";
import { AI_REVIEW_NOTEBOOK_URL, buildDiagramAiReviewPayload, buildDiagramAiReviewPromptText } from "./diagramAiReview";

describe( "buildDiagramAiReviewPayload", () => {
    it( "includes only NotebookLM instructions, generated UITDL, and official validator output", () => {
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
        expect( payload.generatedUitdl ).toContain( 'UITD "UITD Diagram"' );
        expect( payload.generatedUitdl ).toContain( 'UI 1 "Inicio" actions {' );
        expect( payload.officialUitdlIssues ).toEqual( expect.any( Array ) );
        expect( payload.officialUitdlIssues.every( issue => issue.source === "generated-uitdl" ) ).toBe( true );

        const promptText = buildDiagramAiReviewPromptText( payload );

        expect( promptText ).toContain( "Review this." );
        expect( promptText ).toContain( "# Instructions for NotebookLM" );
        expect( promptText ).toContain( "# UITDL" );
        expect( promptText ).toContain( "# Validator output" );
        expect( promptText ).not.toContain( "# User request" );
        expect( promptText ).not.toContain( "# Notebook" );
        expect( promptText ).not.toContain( AI_REVIEW_NOTEBOOK_URL );
        expect( promptText ).not.toContain( "# Diagram JSON" );
        expect( promptText ).not.toContain( "# Complete uitd-authoring skill bundled in the app" );
        expect( promptText ).not.toContain( "# Canvas model validation errors and warnings" );
    } );
} );
