// src/ai/diagramAiReview.ts
// Builds complete UITDL diagram review prompts for users to paste into their preferred AI.

import { exportToUITDL } from "../export/uitdl";
import { makeProjectSnapshot, type ProjectData } from "../io/serialization";
import type { AppState } from "../state/types";
import { validateDiagram, type DiagramIssue } from "../validation/diagramValidation";
import { UITDL_AUTHORING_SKILL_CONTEXT } from "./uitdlAuthoringSkill";

export const DEFAULT_AI_REVIEW_PROMPT =
    "Ayúdame a revisar este diagrama UITDL. Dame observaciones útiles sobre su estructura, coherencia, claridad, posibles errores, riesgos de interpretación, mejoras de modelado y oportunidades para simplificarlo. Usa el skill UITDL incluido como referencia principal. Considera también el JSON del diagrama, el UITDL generado desde ese JSON y la lista de errores del verificador. No modifiques el diagrama; solo dame una opinión práctica y accionable.";

export type DiagramAiReviewPayload = {
    prompt: string;
    skillContext: string;
    diagramJson: ProjectData;
    generatedUitdl: string;
    validationIssues: DiagramIssue[];
};

export function buildDiagramAiReviewPromptText( payload: DiagramAiReviewPayload ): string {
    return [
        "# Rol",
        "Eres una IA revisando un diagrama UITDL. Usa el skill UITDL completo incluido abajo como referencia principal. Separa observaciones, supuestos, inferencias, hipótesis y sugerencias prácticas cuando sea útil. No afirmes que el diagrama es correcto salvo que la evidencia incluida lo soporte.",
        "",
        "# Solicitud del usuario",
        payload.prompt,
        "",
        "# Skill completo uitd-authoring empaquetado en la app",
        payload.skillContext,
        "",
        "# JSON del diagrama",
        "```json",
        JSON.stringify( payload.diagramJson, null, 2 ),
        "```",
        "",
        "# UITDL temporal generado desde el JSON del diagrama",
        "```uitdl",
        payload.generatedUitdl,
        "```",
        "",
        "# Errores y advertencias actuales del verificador",
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
