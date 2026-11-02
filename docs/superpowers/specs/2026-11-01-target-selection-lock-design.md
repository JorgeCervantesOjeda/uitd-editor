# Target-selection interaction lock

## Purpose

While `pendingConnect` is active, the diagram enters target-selection mode. The
only state-changing outcomes are selecting a diagram UI node as the target or
pressing Escape to cancel the selection.

## Scope

- A pointer interaction on a node may commit that node as the target.
- Escape may call `cancelPending`.
- Every other pointer, context-menu, click, double-click, keyboard, toolbar,
  sidebar, fragment, action, condition, canvas, scroll, or zoom interaction is
  ignored while the mode is active.
- Selecting a target with a double click must not subsequently open its edit
  dialog.

## Design

`App` owns a capture-phase interaction gate because its subtree contains both
the diagram canvas and the UITDL sidebar. The gate admits only diagram-node
pointer interactions and Escape. Local canvas handlers retain the invariant at
their mutation points: the background does not cancel, non-node elements do
not mutate, and node double-clicks created by target selection do not open an
editor.

This is intentionally a modal interaction state, not a collection of
independent disabled controls. The central gate covers new controls added
outside the canvas; local guards preserve the invariant when a handler is used
outside `App` in tests or future composition.
