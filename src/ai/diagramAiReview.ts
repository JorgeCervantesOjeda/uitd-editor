// src/ai/diagramAiReview.ts
// Builds compact UITDL review prompts for the project NotebookLM notebook.

import { exportToUITDL } from "../export/uitdl";
import { callOfficialUITDLValidator } from "../import/uitdl/officialValidatorCaller";
import type { ParseIssue } from "../import/uitdl/types";
import type { AppState } from "../state/types";

export const AI_REVIEW_NOTEBOOK_URL =
    "https://notebook.google.com/notebook/1c4545e3-9271-4806-8629-fd51e3d34447";

export const DEFAULT_AI_REVIEW_PROMPT =
    "Review this UITDL model using the notebook sources as the main reference. Use the validator output as evidence. Identify validation problems, modeling risks, and concrete fixes. Do not assume anything that is not supported by the UITDL, the validator output, or the notebook sources.";

export type DiagramAiReviewPayload = {
    prompt: string;
    generatedUitdl: string;
    officialUitdlIssues: ParseIssue[];
};

export function buildDiagramAiReviewPromptText( payload: DiagramAiReviewPayload ): string {
    return [
        "# Instructions for NotebookLM",
        payload.prompt,
        "",
        "# UITDL",
        "```uitdl",
        payload.generatedUitdl,
        "```",
        "",
        "# Validator output",
        "```json",
        JSON.stringify( payload.officialUitdlIssues, null, 2 ),
        "```",
    ].join( "\n" );
}

export function buildDiagramAiReviewPayload(
    state: AppState,
    prompt: string = DEFAULT_AI_REVIEW_PROMPT
): DiagramAiReviewPayload {
    const generatedUitdl = exportToUITDL( state );

    return {
        prompt,
        generatedUitdl,
        officialUitdlIssues: callOfficialUITDLValidator( generatedUitdl, "generated-uitdl" ),
    };
}
