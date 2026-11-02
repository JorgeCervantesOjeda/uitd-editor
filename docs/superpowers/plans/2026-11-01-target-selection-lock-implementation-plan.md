# Target-selection interaction lock implementation plan

**Goal:** make target-selection mode accept only a target UI node or Escape.

**Spec:** `docs/superpowers/specs/2026-11-01-target-selection-lock-design.md`

## Task 1: prove and implement the central modal gate

1. Add a system-level `App` test showing sidebar and toolbar-like controls are
   blocked while a pending connection exists, but Escape is admitted.
2. Run it and observe failure.
3. Add the capture-phase gate at `App`.
4. Run the test and observe success.

## Task 2: prove and implement canvas mutation guards

1. Add unit/integration tests for background right-click and element editing
   while a connection is pending; connect them to the Task 1 system scenario.
2. Run them and observe failure.
3. Guard local handlers and suppress the target-selection double-click edit.
4. Run the targeted tests and observe success.

## Task 3: verification

1. Run the relevant integration tests, lint, typecheck, and full test suite.
2. Build the app without publishing it.
3. Perform a final self-review because no fresh reviewer is dispatched.
