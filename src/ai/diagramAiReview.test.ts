// src/ai/diagramAiReview.test.ts
// Verifies the AI review payload includes all context required for UITDL feedback.

import { describe, expect, it } from "vitest";
import type { AppState } from "../state/types";
import { buildDiagramAiReviewPayload, buildDiagramAiReviewPromptText } from "./diagramAiReview";

describe( "buildDiagramAiReviewPayload", () => {
    it( "includes the diagram snapshot, generated UITDL, validation issues, and complete skill context", () => {
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

        const payload = buildDiagramAiReviewPayload( state, "Revisa esto." );

        expect( payload.prompt ).toBe( "Revisa esto." );
        expect( payload.diagramJson.nodes ).toHaveLength( 1 );
        expect( payload.generatedUitdl ).toContain( 'UITD "UITD Diagram"' );
        expect( payload.generatedUitdl ).toContain( 'UI 1 "Inicio" actions {' );
        expect( payload.validationIssues.some( issue => issue.code === "UI_NO_OUTGOING" ) ).toBe( true );
        expect( payload.skillContext ).toContain( "# UITDL Authoring" );
        expect( payload.skillContext ).toContain( "## Compact grammar" );

        const promptText = buildDiagramAiReviewPromptText( payload );

        expect( promptText ).toContain( "# Skill completo uitd-authoring empaquetado en la app" );
        expect( promptText ).toContain( "# JSON del diagrama" );
        expect( promptText ).toContain( "# UITDL temporal generado desde el JSON del diagrama" );
        expect( promptText ).toContain( "# Errores y advertencias actuales del verificador" );
        expect( promptText ).toContain( "Revisa esto." );
    } );
} );
