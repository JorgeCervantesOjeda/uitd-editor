---
name: uitdl-authoring
description: Author, refactor, validate, and operationalize User Interface Transition Diagram Language (UITDL) specifications using the bundled grammar, semantics, validation checklist, and UITD Editor conventions. Use when Codex or ChatGPT must create or edit `.uitdl`-style text, define UITD/UI/FRAGMENT/TRANSITION structures, enforce grammar and semantic consistency, diagnose validation errors, or prepare UITDL content for UITD Editor.
---

# UITDL Authoring

Use this skill to produce valid, maintainable UITDL models from product flows, user stories, existing UI documentation, or UITD Editor diagrams.
Follow the current recommended grammar and semantics from this skill and the bundled reference.

## Follow this workflow

- Never use this skill from memory, a prior summary, or an approximate recollection. Rely on the written rules included in the current conversation or bundled with the app every time the task depends on UITDL semantics, validation, reuse, nesting, fragment design, or repair decisions.
- Never assume UITDL behavior, review criteria, or repair strategy unless it is explicitly supported by written rules in this skill, the bundled reference, or explicit validation issues provided by UITD Editor. If a rule is not written here and not confirmed by provided validation output, treat it as unconfirmed and do not rely on it.
- Use square brackets in new `DRAW` output to express containment (for example `7[1]`). Keep parenthesized containment in `DRAW` only when preserving a legacy model verbatim. The parser may accept both, but the recommended emitted syntax is bracketed.
- Use parenthesized references in `TRANSITION` only to point to a specific contained instance drawn in the fragment (for example `to 7(1)`).

1. Translate the input flow into a single `UITD "Title" { ... }` with explicit `UI` states.
2. Define each `UI` with:
   - Numeric identifier (`UIID`)
   - Human-readable title in quotes
   - `actions` block listing supported user actions
3. Group related paths into one or more `FRAGMENT` blocks.
4. In each `FRAGMENT`, add:
   - Optional `WIDTH n;`
   - At least one `DRAW { ... };`
   - At least one `TRANSITION ...;`
5. Map transitions to explicit action labels:
   - `if user VERB "Complement"`
   - Optional `AND "Condition"`
   - Optional `WIDTH n`
   - Make the transition phrase read naturally as much as possible: use `clicks "visible control label"` for direct UI gestures, and use semantic verbs such as `deletes "affected object"` for behavioral effects.
   - Treat `AND "Condition"` as a transition guard: the condition must be a proposition evaluated before or at the moment the transition is triggered, and it must determine whether that transition may fire.
   - Use `AND` only for text that can already be true or false in the current interaction context. If the text answers "what must already be true for this transition to happen?", it may belong in `AND`.
   - Do not use `AND` for effects, outcomes, side effects, postconditions, logging, persistence, or system work that happens after the transition fires. If the text answers "what happens after this transition happens?", it does not belong in `AND`.
6. Run a semantic review before finalizing.
   - Before finalizing, scan every `UI` action and `TRANSITION` condition that uses semantic verbs such as `deletes`, `saves`, `uploads`, or `downloads`.
   - If the quoted complement is a visible button, link, menu item, or control label, rewrite the action as `clicks "label"` unless a different direct-interaction verb is more precise.
   - Use semantic verbs only with affected domain objects or artifacts: prefer `deletes "registro"`, `saves "formulario"`, `uploads "archivo"`, and `downloads "reporte"`; avoid `deletes "Eliminar"`, `deletes "Confirmar"`, `saves "Guardar"`, or similar verb-plus-button-label phrases.
   - Scan every `AND "Condition"` and keep it only when it is a real guard that can be true or false before or at trigger time. Move important outcomes into a separate destination UI, transition, or documentation outside `AND`.
7. Validate before finalizing whenever validation is available:
   - In UITD Editor, paste the UITDL into the text panel and use its diagnostics as the blocking source of truth.
   - In an AI review prompt copied from UITD Editor, use the included validator errors and warnings as evidence; do not invent additional tool results.
   - Preferred ad hoc CLI invocation of the official validator package: `npx uitdl-validator@latest path/to/file.uitd`
   - For repeatable project use, install the official validator package: `npm install --save-dev uitdl-validator`
   - After installation, use the exposed CLI name directly: `npx uitd-validate path/to/file.uitd`
   - Workspace-local script during development: `npm run validate:uitd -- path/to/file.uitd`
   - For generated content without a file yet in an installed project: pipe the UITDL text to `npm run validate:uitd --` or `npx uitd-validate`
   - Treat error-level validator output as blocking. Do not finalize a UITDL result without reporting or resolving those errors.
   - Prefer guidance that does not depend on a specific local filesystem path. Treat absolute or relative path installs as development-only fallbacks, not as the primary recommended workflow.
   - For CI or reproducible automation, pin an explicit validator version instead of `@latest`.
   - Keep local path installs or `npm link` only for contributor workflows when testing unpublished changes.
   - Relative UITDL file paths are preferred for normal use. The validator should resolve them from the project root.

## UITD Editor usage

- Treat UITD Editor as the primary user-facing environment for applying, previewing, diagnosing, and exporting UITDL.
- The recommended user flow is: write or paste UITDL in the text panel, resolve diagnostics, use `Preview HTML` to walk through behavior, use `Generate D2` for a derived diagram, then use `Apply to diagram` when there are no errors.
- `Preview HTML`, D2 generation, ELK/Dagre rendering, SVG export, and layout simulation are operational/export steps after validation. They do not prove that the UITDL model is semantically correct.
- UITDL does not declare an initial state. UITD Editor's preview starts from the first declared `UI` and lets the user choose another current UI.
- UITD Editor does not evaluate guard truth automatically. A conditional action opens a guard-selection dialog; an unconditional action navigates immediately.
- D2 is a derived presentation artifact. Editing D2 does not modify UITDL or the visual canvas.
- Do not include machine-specific filesystem paths, local workspace names, unpublished package paths, or contributor-only scripts in instructions intended for end users.
- For local contributor work, prefer the scripts documented by the current app repository, such as `npm run validate:uitd -- path/to/file.uitd`, and treat local path installs as development-only details.

## Inclusion and nesting semantics

- Do not infer UITDL nesting semantics only from the compact grammar or checklist. When a task depends on reusable UIs, nested UIs, menus, inherited availability of actions, or inherited transitions by inclusion, review the extended semantic source if it is bundled or otherwise provided in the current task context before modeling.
- Distinguish strictly between actions defined in a UI and actions available to the user in a given interface state.
- If a containment reference such as `7[1]` appears in any fragment, that establishes a global inclusion fact in the whole UITD: `UI 7` contains `UI 1` in the modeled system, even if other fragments do not redraw that containment explicitly.
- In `DRAW`, `7[1]` means that `UI 1` is drawn as contained in `UI 7` for that fragment view. This establishes the inclusion relation in the global model.
- For backward compatibility, legacy `DRAW` containment such as `7(1)` may still be accepted by tooling, but when authoring or refactoring models the preferred emitted form is `7[1]`.
- If the application state is `7`, the real application must show `UI 7` and also show `UI 1` because `1` is contained in `7`.
- If the application state is `1`, the real application shows only `UI 1`; it does not show `UI 7`.
- Therefore, `to 7` means the destination state is `UI 7`, and the available actions are the actions defined in `7` plus the actions of contained UIs such as `1`.
- `to 1` means the destination state is `UI 1`, and the available actions are only the actions defined in `1`.
- In `TRANSITION`, `from 7(1)` or `to 7(1)` refers to the specific drawn instance of `UI 1` contained in `UI 7` in that fragment. For destination semantics, `to 7(1)` still sends the user to `UI 1` as the underlying interface state; the difference from `to 1` is that the arrow is anchored to the contained drawn instance inside `UI 7` in that fragment. Treat `1` and `7(1)` as different references/instances of the same UI for diagram purposes, not as interchangeable references.
- One practical purpose of nested references in transitions is visual clarity: they let the model point an arrow to the specific drawn instance of a UI in a fragment so the diagram can be laid out cleanly and avoid unnecessary line crossings when the same UI appears multiple times.
- This matters especially for reusable menus and navigation UIs. A menu UI may be drawn standalone in its own reusable fragment and also drawn nested inside many other UIs. In those cases, it is often clearer to draw transitions from the standalone menu instance in the dedicated reusable fragment, while using nested menu instances in other fragments only to show that the menu actions are available there.
- Therefore, nested references in transitions serve both semantic and visual purposes: they identify the correct drawn instance for human-readable layout, and they determine whether the user is sent to a contained UI or to a container UI when the model needs to restrict or expand the set of available actions.
- A fragment may draw both `1` and `7(1)`. In that case, transitions may intentionally target or originate from either the standalone reference `1` or the contained reference `7(1)`.
- A fragment may draw both `1` and `7[1]`. In that case, transitions may intentionally target or originate from either the standalone reference `1` or the contained-instance reference `7(1)`.
- Inclusion is not limited to reusable menus. It may also be used to constrain which subset of actions is available in a composed state.
- A contained UI counts as reusable only when it is included in at least two distinct container UIs. If it is included in only one other UI, do not describe that pattern as reuse; justify it instead as an extension/composed-state relationship if it is semantically valid.
- For origin semantics, `from 7` means the triggering action must be defined in `UI 7`. `from 7(1)` means the triggering action must be defined in `UI 1`.
- When reviewing reachability or completeness of a UI, evaluate effective outgoing behavior, not only direct transitions. A UI satisfies the `has an exit` requirement if it has at least one direct outgoing transition or at least one outgoing transition inherited by inclusion from a contained UI.
- Therefore, a container UI may be valid without its own direct transition clauses when included reusable UIs already provide the effective exits available from that container state.
- Use bracketed containment references in `DRAW` not only as syntax to render hierarchy, but with the semantic meaning defined in this skill and the bundled reference when modeling reusable menus, embedded UIs, or restricted interaction modes.
- Distinguish explicitly between navigation UIs and non-navigation UIs. Navigation UIs exist primarily to provide reusable navigation actions and are natural candidates for inclusion in many other UIs.
- Only use containment/inclusion for one of these two reasons: (1) the contained UI is a reusable element that appears in at least two distinct other UIs, or (2) the container UI is a true extension of the contained UI, so the model may intentionally navigate to the contained UI when only its actions should be available, or to the container UI when the user should have both the contained actions and the additional actions of the container.
- Do not include one UI inside another merely because they are related in topic or because the nesting seems convenient. If an inclusion is not justified by reusable repetition or by a real extension relationship, it is semantically wrong and must be removed.
- If the task depends on inclusion semantics and the source is unavailable or still ambiguous, stop and ask instead of assuming.
- When multiple UIs share the same action with the same destination, prefer modeling that behavior through an included reusable UI instead of repeating equivalent transitions in each concrete UI.
- A reusable UI must be illustrated in at least one dedicated fragment that shows that reusable UI as a standalone draw and shows its outgoing transitions explicitly.
- That dedicated fragment must be specialized only in the reusable UI: every transition in that fragment must originate from that reusable UI. Do not mix transitions from other UIs in the same fragment.
- In other fragments, reuse the reusable UI by inclusion instead of repeating or mixing those transitions.
- Include reusable navigation by default in UITDL UIs. Omit reusable navigation only when its availability would cause a problem in the behavior designed by the UITD itself.
- In message UIs, reusable navigation may coexist with additional message-specific actions that guide the user toward the most logical continuation of the current flow.
- Such guidance-oriented redundancy is valid when it helps the user while still preserving freedom to navigate away. Do not remove a message-specific guided action only because reusable navigation could also take the user out of that UI.
- An inclusion may be shown in more than one fragment when that inclusion helps interpret transitions in each fragment. If a fragment contains a transition to `A` and `A` includes `B`, it is valid and often preferable to draw `A[B]` in that same fragment so the inclusion is visible where `A` is introduced.
- For inclusion hierarchies drawn in a fragment, at least one UI in that hierarchy must participate in a transition of that fragment. Do not draw an inclusion hierarchy that is unrelated to every transition in the fragment.
- Design reusable UIs to capture the largest coherent set of actions shared by multiple UIs. Prefer broader reusable UIs over multiple smaller overlapping ones when the broader reusable UI is semantically coherent.
- If one reusable UI already defines a reusable action, do not define that same reusable action again in another reusable UI. Reusable UIs must not overlap by redefining the same shared action.
- Build reusable UIs hierarchically: first factor the most widely shared actions, then add more specific reusable UIs only for additional actions not already covered by a broader reusable UI.
- If `A` contains `B`, and `B` already has a transition for action `X`, do not duplicate that same action-transition in `A`. The transition from `B` is already available in `A` by inclusion.
- For this duplication-by-inclusion rule, compare destinations by final UI, not by exact reference. Therefore `to B` and `to A(B)` are equivalent because both end at UI `B`, but `to A` and `to A(B)` are not equivalent because they end at different UIs.

## Apply WIDTH semantics exactly

- Treat `WIDTH` as strictly visual metadata for text wrapping, never as behavior.
- Interpret `WIDTH n;` as maximum characters per line before wrapping, without splitting words.
- Use `FRAGMENT` `WIDTH` as the default width for all transition labels in that fragment.
- Use transition-level `WIDTH` to override fragment-level `WIDTH` for that transition only.
- Require positive integer `n` in any `WIDTH` declaration.

## Enforce these rules

- Always prefer the most logical model when multiple syntactically valid options exist.
- Ensure end-to-end reachability for intended flows (avoid orphan operational states such as admin panels with no inbound path).
- Avoid redundancy and unnecessary complexity: do not define overlapping transitions for the same user action unless each transition is strictly required and disambiguated by clear, non-overlapping conditions.
- Keep fragment scope balanced: avoid very large fragments, but also avoid trivial fragments that do not add structural clarity.
- Keep exactly one `UITD` per file, with `TITLE`.
- Use explicit root keyword form: `UITD "Title" { ... }`.
- Keep every `UIID` unique.
- Reference only previously defined `UI` identifiers from `DRAW` and `TRANSITION`.
- Keep every fragment with at least one `DRAW` and one `TRANSITION`.
- In each fragment, draw only UIs that are necessary for that fragment's subgraph: a drawn UI must be used as a transition origin, a transition destination, or as a containment/inclusion reference required to interpret those transitions.
- Do not draw decorative or convenience-only UIs in a fragment. If a UI is not used by any transition in that fragment and is not required for a nested inclusion used by those transitions, remove it from that fragment.
- If a validator requires every transition endpoint in a fragment to be drawn, satisfy that by drawing the required endpoint UIs, but do not add any extra unrelated UIs beyond those required endpoints and inclusion references.
- If a transition in a fragment references a standalone UI such as `2`, that fragment must draw `2` as a standalone UI reference. Drawing only a contained reference such as `4[2]` does not satisfy a standalone transition endpoint for `2`.
- Conversely, if a transition in a fragment references a contained instance such as `14(28)`, that fragment must draw the corresponding containment structure `14[28]`. A standalone draw of `28` does not substitute for `14(28)` in that fragment.
- Keep transition origin and destination valid IDs.
- Avoid duplicate transitions with same origin, destination, action, and condition within the same fragment. The same transition may appear in different fragments when those fragments present different views of the same model.
- Keep quoted strings balanced and structurally safe.
- In `UI` actions, use `ACTION ::= VERB COMPLEMENT ";"` (do not use `when user` there).
- Keep `UI` actions strictly as user interactions over the current interface; do not model internal/automatic system processes as `actions`.
- Keep action phrases readable in English, allowing Spanish UI labels or domain objects only when the whole phrase still makes sense. For direct interaction with a control label, prefer `clicks "eliminar"` when the label is `eliminar`. For semantic behavior, pair the verb with the affected domain object, such as `deletes "registro"`, not `deletes "eliminar"` or `deletes "Confirmar"`.
- Distinguish UI gestures from semantic effects: `TRANSITION from 1 to 2 if user clicks "eliminar";` models pressing the visible control, while `TRANSITION from 1 to 2 if user deletes "registro";` models the intended effect.
- Keep `AND "Condition"` as a guard, not an effect description. Correct: `TRANSITION from 3 to 11 if user clicks "Ver en Calendar" AND "ya existe autorizacion";` and `TRANSITION from 2 to 8 if user clicks "Google Calendar" AND "falta OAuth Client ID web";`. Incorrect: `TRANSITION from 6 to 1 if user clicks "Confirmar" AND "se elimina el registro";`.
- If a modal dialog blocks interaction with the underlying page, model that dialog as a separate UI with its own actions; do not keep blocked base-page actions active in the same UI.
- Allow empty `actions {}` when needed.
- Use the original verb set: `clicks`, `submits`, `selects`, `types`, `toggles`, `uploads`, `downloads`, `saves`, `deletes`, `waits`.
- Prefer behaviorally meaningful transitions over placeholder self-loops.
- If an action implies a real context change (for example, `clicks "Iniciar sesion"` or `clicks "Registrarse"`), model a destination UI for that flow instead of `from X to X` unless explicit no-op behavior is intended.

## Diagnose and repair quickly

- Root mismatch: replace `MODEL "..." { ... }` with `UITD ::= TITLE "{" (UI | FRAGMENT)+ "}"` format.
- Undefined UI ID: define the missing `UI` before using it.
- Duplicate UI ID: renumber one declaration and update references.
- Action mismatch: align transition action with origin `UI` actions.
- Malformed nesting: rewrite `DRAW` containment to a well-formed structure like `A[B[C]]` or rewrite a transition reference to a well-formed contained-instance reference like `A(B(C))`, depending on context.
- Duplicate transition in the same fragment: merge or remove the repeated clause. If the same transition appears in different fragments for readability, that is allowed.
- Placeholder self-loop: replace `from X to X` with a semantically correct destination UI when the action represents navigation or workflow progress.
- Redundant transition set: collapse parallel/overlapping transitions into a simpler single-path structure, then branch at the point where context actually differs.

## Output format

- Return complete UITDL text ready to copy into tooling.
- When fixing existing code, return corrected code plus a short changelog.
- If input comes in a legacy or alternate variant, convert it to the current recommended variant when appropriate and note that conversion briefly.

## Reference

Use `references/uitdl-grammar-and-validation.md` for the compact grammar, semantics, and validation checklist.
