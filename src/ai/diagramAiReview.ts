// src/ai/diagramAiReview.ts
// Builds complete UITDL diagram review prompts for users to paste into their preferred AI.

import { exportToUITDL } from "../export/uitdl";
import { makeProjectSnapshot, type ProjectData } from "../io/serialization";
import type { AppState } from "../state/types";
import { validateDiagram, type DiagramIssue } from "../validation/diagramValidation";
import { UITDL_AUTHORING_SKILL_CONTEXT } from "./uitdlAuthoringSkill";

export const DEFAULT_AI_REVIEW_PROMPT =
    "Help me review this UITDL diagram. Give useful observations about its structure, consistency, clarity, possible errors, interpretation risks, modeling improvements, and simplification opportunities. Use the included UITDL skill as the main reference. Also consider the diagram JSON, the UITDL generated from that JSON, and the current validator issues. Do not modify the diagram; only give me a practical, actionable review.";

export type DiagramAiReviewPayload = {
    prompt: string;
    skillContext: string;
    diagramJson: ProjectData;
    generatedUitdl: string;
    validationIssues: DiagramIssue[];
};

export function buildDiagramAiReviewPromptText( payload: DiagramAiReviewPayload ): string {
    return [
        "# Role",
        "You are an AI reviewing a UITDL diagram. Use the full UITDL skill included below as the main reference. Separate observations, assumptions, inferences, hypotheses, and practical suggestions when useful. Do not claim that the diagram is correct unless the included evidence supports it.",
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
        "# Current validator errors and warnings",
        "```json",
        JSON.stringify( payload.validationIssues, null, 2 ),
        "```",
    ].join( "\n" );
}

export function buildDiagramAiReviewPayload(
    state: AppState,
    prompt: string = DEFAULT_AI_REVIEW_PROMPT
): DiagramAiReviewPayload {
    return {
        prompt,
        skillContext: UITDL_AUTHORING_SKILL_CONTEXT,
        diagramJson: makeProjectSnapshot( state ),
        generatedUitdl: exportToUITDL( state ),
        validationIssues: validateDiagram( {
            nodes: state.nodes,
            actions: state.actions,
            conditions: state.conditions,
            edges: state.edges,
            fragmentTitles: state.fragmentTitles,
        } ),
    };
}
