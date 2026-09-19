// src/ai/diagramAiReview.ts
// Builds compact NotebookLM prompts and complete fallback prompts for UITDL AI review.

import { exportToUITDL } from "../export/uitdl";
import { callOfficialUITDLValidator } from "../import/uitdl/officialValidatorCaller";
import type { ParseIssue } from "../import/uitdl/types";
import type { AppState } from "../state/types";
import authoringGuideMarkdown from "../../guia-autoria-uitdl.txt?raw";
import notebookManualMarkdown from "../../NOTEBOOKLM_MANUAL_USUARIOS.md?raw";
import skillMarkdown from "./skills/uitdl-authoring/SKILL.md?raw";
import grammarReferenceMarkdown from "./skills/uitdl-authoring/references/uitdl-grammar-and-validation.md?raw";

export const AI_REVIEW_NOTEBOOK_URL =
    "https://notebook.google.com/notebook/1c4545e3-9271-4806-8629-fd51e3d34447";

export const DEFAULT_AI_REVIEW_PROMPT =
    "Review the validator output using the notebook sources as the main reference. Explain each error or warning, prioritize fixes, and suggest concrete UITDL changes. Do not assume the model is correct just because the validator output is empty.";

export type DiagramAiReviewPayload = {
    prompt: string;
    generatedUitdl: string;
    officialUitdlIssues: ParseIssue[];
};

const VALIDATION_CHECKLIST = [
    "Check blocking validator errors first; do not treat warnings as blockers unless they create a modeling risk.",
    "Verify every UI reference used by DRAW and TRANSITION is declared.",
    "Verify each transition action exists in the origin UI or is available through valid inclusion.",
    "Check that DRAW containment uses the recommended bracket syntax and that transition instance references match drawn containment.",
    "Check duplicate, unreachable, ambiguous, placeholder, or redundant transitions.",
    "Check guard conditions introduced with AND; they must be preconditions, not effects or outcomes.",
    "Check fragments for connected, relevant drawings with at least one DRAW and one TRANSITION.",
    "When there are no validator issues, say that the validator reported no errors or warnings, but do not claim the model is semantically perfect.",
];

function formatOfficialUitdlIssues( issues: ParseIssue[] ): string {
    if ( issues.length === 0 ) {
        return "No validator errors or warnings were reported.";
    }

    return issues
        .map( ( issue, index ) => {
            const location = issue.line == null
                ? "unknown location"
                : `line ${issue.line}${issue.col == null ? "" : `, column ${issue.col}`}`;
            return [
                `${index + 1}. ${issue.kind.toUpperCase()} ${issue.code} (${location})`,
                `   ${issue.message}`,
            ].join( "\n" );
        } )
        .join( "\n" );
}

export function buildDiagramAiReviewPromptText( payload: DiagramAiReviewPayload ): string {
    return [
        "# Instructions for NotebookLM",
        payload.prompt,
        "",
        "# Validation checklist",
        ...VALIDATION_CHECKLIST.map( item => `- ${item}` ),
        "",
        "# Validator output",
        formatOfficialUitdlIssues( payload.officialUitdlIssues ),
    ].join( "\n" );
}

export function buildFullDiagramAiReviewPromptText( payload: DiagramAiReviewPayload ): string {
    return [
        "# Instructions for the AI",
        "Review this UITDL model using the included reference documents as the source of UITDL rules and editor conventions. Treat the UITDL model as the object being reviewed, not as normative documentation. Use the validator output as evidence, but also review modeling clarity, semantic risks, redundancy, reachability, nesting, guards, and maintainability. Separate observations from assumptions and concrete recommendations.",
        "",
        "# Reference document: guia-autoria-uitdl.txt",
        authoringGuideMarkdown,
        "",
        "# Reference document: NOTEBOOKLM_MANUAL_USUARIOS.md",
        notebookManualMarkdown,
        "",
        "# Reference document: SKILL.md",
        skillMarkdown,
        "",
        "# Reference document: uitdl-grammar-and-validation.md",
        grammarReferenceMarkdown,
        "",
        "# UITDL to review",
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

export function hasOfficialUitdlIssues( payload: DiagramAiReviewPayload ): boolean {
    return payload.officialUitdlIssues.length > 0;
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
