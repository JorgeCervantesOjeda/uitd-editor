# UITDL Grammar and Validation Reference

## Compact grammar

```bnf
UITD          ::= "UITD" TITLE "{" (UI | FRAGMENT)+ "}"
TITLE         ::= QUOTEDSTRING

UI           ::= "UI" UIID QUOTEDSTRING UIACTIONS
UIID         ::= NUMBER
UIACTIONS     ::= "actions" "{" ACTION* "}"
NUMBER        ::= DIGIT+
DIGIT         ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
ACTION        ::= VERB COMPLEMENT ";"

VERB          ::= "clicks" | "submits" | "selects" | "types" | "toggles"
                | "uploads" | "downloads" | "saves" | "deletes" | "waits"
COMPLEMENT    ::= QUOTEDSTRING

FRAGMENT     ::= "FRAGMENT" QUOTEDSTRING "{"
                   [ FRAGMENTWIDTH ]
                   DRAW+ TRANSITION+
                 "}"
FRAGMENTWIDTH ::= "WIDTH" NUMBER ";"
DRAW         ::= "DRAW" "{" DRAWREFLIST "}" ";"
DRAWREFLIST  ::= DRAWREF ("," DRAWREF)*
DRAWREF      ::= UIID [ "[" DRAWREFLIST "]" ]
TRANSITIONREF ::= UIID [ "(" TRANSITIONREF ")" ]

TRANSITION   ::= "TRANSITION" "from" TRANSITIONREF "to" TRANSITIONREF
                 "if" "user" VERB COMPLEMENT
                 [ "AND" CONDITION ]
                 [ "WIDTH" NUMBER ]
                 ";"

CONDITION    ::= QUOTEDSTRING
QUOTEDSTRING ::= '"' QUOTEDCHAR* '"'
```

## Operational semantics

- Interpret `UI` as graph nodes (interface states).
- Interpret `TRANSITION` as directed labeled edges between nodes.
- Treat `actions` in a `UI` as enabled interactions for that state.
- Treat each `FRAGMENT` as a partial view/subgraph of the model.
- Use bracketed `DRAW` references (for example `A[B[C]]`) to encode containment in the model and in the fragment view.
- Use parenthesized transition references (for example `A(B(C))`) only to refer to the specific contained instance drawn inside a container when a transition must target or originate from that instance.
- For backward compatibility, tooling may still accept the older parenthesized containment notation inside `DRAW`, but the recommended emitted syntax is bracketed.
- Treat a contained UI as reusable only when it is included in at least two distinct container UIs. If a contained UI appears in only one container, model that inclusion as an extension/composed-state relation rather than describing it as reuse.
- Treat `WIDTH` as strict presentation metadata:
  - `WIDTH n;` means max characters per line before wrapping.
  - Wrapping must not split words.
  - Fragment `WIDTH` is default for transition labels in that fragment.
  - Transition `WIDTH` overrides fragment `WIDTH` for that transition.
  - `WIDTH` never changes model semantics.

## Authoring checklist

0. When several valid encodings are possible, choose the one that best matches real user/system behavior.
1. Keep one `UITD "Title" { ... }` root only.
2. Define all `UI` blocks before references.
3. Keep `UIID` unique across the model.
4. Keep every fragment with `DRAW` and `TRANSITION`.
5. Ensure every transition source and target exists.
6. Ensure each transition action is declared in the origin UI actions (or flag as warning if policy allows).
7. Prevent exact duplicate transitions.
8. Keep quoted strings balanced.
9. Keep `DRAW` containment expressions and `TRANSITION` contained-instance references well-formed and acyclic.
10. Keep `UI` actions in original form `VERB "Complement";` (no `when user` in `actions`).
11. Model only user-triggered interactions in `actions`; represent automatic/internal system behavior through conditions or external assumptions, not as UI actions.
12. Allow empty `actions {}` blocks when a UI has no declared actions yet.
13. Use positive integer values for every `WIDTH n` at fragment or transition level.
14. Apply wrapping by character count (including spaces) and never split words.
15. Avoid placeholder self-loops for navigational actions; prefer explicit destination UIs that represent the real next context.
16. Ensure operational states are reachable through at least one logical path (for example, an admin panel must have an inbound login/authorization path).
17. Minimize redundant transitions: avoid parallel rules that represent the same event flow unless conditions are explicit, necessary, and non-overlapping.
18. Keep fragments medium-grained: split oversized fragments by workflow stage, but avoid trivial one-off fragments that do not improve readability.

## Validator distribution guidance

- Prefer a published Node CLI package over machine-specific filesystem installs when the validator must work from any computer.
- The published package is `uitdl-validator`; it exposes the CLI binary `uitd-validate`.
- Use `npx uitdl-validator@latest path/to/file.uitd` for ad hoc package execution.
- Use `npx -p uitdl-validator uitd-validate path/to/file.uitd` when the command name must be explicit.
- Use `npx uitd-validate ...` only inside an environment where `uitdl-validator` is already installed and its binary is available.
- Document local path installs and `npm link` only as contributor/development workflows for unpublished builds.
- Prefer relative UITDL file paths in examples so commands stay portable across operating systems and machines.
- For CI or automation, pin an explicit package version rather than relying on `@latest`.
- In UITD Editor user workflows, prefer the app's text-panel diagnostics over asking end users to install Node tooling.
- In ChatGPT-only workflows, validation claims must be limited to checklist review unless validator output is provided by the user or by UITD Editor.

## Diagnostic mapping

- `root construct mismatch`: Replace `MODEL`-style root with `UITD "Title" { ... }`.
- `undefined UI identifier`: Add missing UI declaration or correct referenced ID.
- `duplicated UI identifier`: Renumber one UI and propagate updates.
- `transition references unknown UI`: Fix source/target in `TRANSITION`.
- `duplicate transition`: Merge, delete, or specialize with different condition.
- `malformed quoted string`: Balance quotes and remove breaking characters.
- `malformed containment in DRAW`: Rewrite to a bracketed containment structure such as `A[B[C]]`.
- `malformed contained-instance reference in TRANSITION`: Rewrite to a parenthesized instance reference such as `A(B(C))`.
- `invalid fragment`: Add required `DRAW` and/or `TRANSITION`.
- `invalid WIDTH value`: Replace `WIDTH` with a positive integer.
- `invalid wrapping behavior`: Re-render labels preserving whole words and width limits.
- `placeholder self-loop`: Replace `from X to X` with a meaningful destination UI when the action represents actual navigation.
- `redundant transition set`: Merge overlapping transitions and branch later where business context actually diverges.
- `fragment granularity issue`: Merge trivial fragments or split oversized ones to keep each fragment cohesive and readable.
