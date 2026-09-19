// src/ai/diagramAiReview.test.ts
// Verifies NotebookLM and full AI review prompts include the intended evidence.

import { describe, expect, it } from "vitest";
import type { AppState } from "../state/types";
import {
    AI_REVIEW_NOTEBOOK_URL,
    buildDiagramAiReviewPayload,
    buildDiagramAiReviewPromptText,
    buildFullDiagramAiReviewPromptText,
    hasOfficialUitdlIssues,
} from "./diagramAiReview";

describe( "buildDiagramAiReviewPayload", () => {
    it( "builds a compact NotebookLM prompt without the full UITDL", () => {
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
        expect( hasOfficialUitdlIssues( payload ) ).toBe( payload.officialUitdlIssues.length > 0 );

        const promptText = buildDiagramAiReviewPromptText( payload );

        expect( promptText ).toContain( "Review this." );
        expect( promptText ).toContain( "# Instructions for NotebookLM" );
        expect( promptText ).toContain( "# Validation checklist" );
        expect( promptText ).toContain( "# Validator output" );
        expect( promptText ).not.toContain( 'UITD "UITD Diagram"' );
        expect( promptText ).not.toContain( 'UI 1 "Inicio" actions {' );
        expect( promptText ).not.toContain( "# User request" );
        expect( promptText ).not.toContain( "# Notebook" );
        expect( promptText ).not.toContain( AI_REVIEW_NOTEBOOK_URL );
        expect( promptText ).not.toContain( "# Diagram JSON" );
        expect( promptText ).not.toContain( "# Complete uitd-authoring skill bundled in the app" );
        expect( promptText ).not.toContain( "# Canvas model validation errors and warnings" );
    } );

    it( "builds a complete prompt for other AIs with references and full UITDL", () => {
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
        const promptText = buildFullDiagramAiReviewPromptText( payload );

        expect( promptText ).toContain( "# Reference document: guia-autoria-uitdl.txt" );
        expect( promptText ).toContain( "# Reference document: NOTEBOOKLM_MANUAL_USUARIOS.md" );
        expect( promptText ).toContain( "# Reference document: SKILL.md" );
        expect( promptText ).toContain( "# Reference document: uitdl-grammar-and-validation.md" );
        expect( promptText ).toContain( "# UITDL to review" );
        expect( promptText ).toContain( 'UITD "UITD Diagram"' );
        expect( promptText ).toContain( 'UI 1 "Inicio" actions {' );
        expect( promptText ).toContain( "# Validator output" );
    } );
} );
