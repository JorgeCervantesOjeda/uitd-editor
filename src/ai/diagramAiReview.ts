// src/ai/diagramAiReview.ts
// Builds complete UITDL diagram review prompts for users to paste into their preferred AI.

import { exportToUITDL } from "../export/uitdl";
import { callOfficialUITDLValidator } from "../import/uitdl/officialValidatorCaller";
import type { ParseIssue } from "../import/uitdl/types";
import { makeProjectSnapshot, type ProjectData } from "../io/serialization";
import type { AppState } from "../state/types";
import { validateDiagram, type DiagramIssue } from "../validation/diagramValidation";
import { UITDL_AUTHORING_SKILL_CONTEXT } from "./uitdlAuthoringSkill";

export const DEFAULT_AI_REVIEW_PROMPT =
    "Help me review this UITDL diagram. Give useful observations about its structure, consistency, clarity, possible errors, interpretation risks, modeling improvements, and simplification opportunities. Use the included UITDL skill as the main reference. Consider the canvas model diagnostics and the official validator diagnostics for the generated UITDL as separate evidence sources because they can be out of sync. Do not modify the diagram; only give me a practical, actionable review.";

export type DiagramAiReviewPayload = {
    prompt: string;
    skillContext: string;
    diagramJson: ProjectData;
    generatedUitdl: string;
    visualDiagramIssues: DiagramIssue[];
    officialUitdlIssues: ParseIssue[];
};

export function buildDiagramAiReviewPromptText( payload: DiagramAiReviewPayload ): string {
    return [
        "# Role",
        "You are an AI reviewing a UITDL diagram. Use the full UITDL skill included below as the main reference. Separate observations, assumptions, inferences, hypotheses, and practical suggestions when useful. Do not claim that the diagram is correct unless the included evidence supports it.",
        "",
        "# Diagnostic source policy",
        "The canvas model and generated UITDL text are different sources and can be out of sync. Treat diagnostics with source \"canvas-model\" as findings about the internal visual model. Treat diagnostics with source \"generated-uitdl\" as findings about the UITDL text exported from that model. When both sources report the same code, treat it as the same validation rule applied to different sources, not as proof that both sources are currently identical.",
        "",
        "# User request",
        payload.prompt,
        "",
        "# Complete uitd-authoring skill bundled in the app",
        payload.skillContext,
        "",
        "# Diagram JSON",
        "```json",
        JSON.stringify( payload.diagramJson, null, 2 ),
        "```",
        "",
        "# Temporary UITDL generated from the diagram JSON",
        "```uitdl",
        payload.generatedUitdl,
        "```",
        "",
        "# Canvas model validation errors and warnings",
        "```json",
        JSON.stringify( payload.visualDiagramIssues, null, 2 ),
        "```",
        "",
        "# Official UITDL validator errors and warnings for the generated UITDL",
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
        skillContext: UITDL_AUTHORING_SKILL_CONTEXT,
        diagramJson: makeProjectSnapshot( state ),
        generatedUitdl,
        visualDiagramIssues: validateDiagram( {
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
            edges: state.edges,
            fragmentTitles: state.fragmentTitles,
        } ),
        officialUitdlIssues: callOfficialUITDLValidator( generatedUitdl, "generated-uitdl" ),
    };
}
