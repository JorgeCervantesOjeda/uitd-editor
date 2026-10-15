# RigidBlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement persistent, visual `RigidBlock` groups that constrain a same-fragment selection to one non-rotating body during canvas simulation.

**Architecture:** Add a domain module that normalizes selections, expands selected node hierarchies, validates same-fragment membership, computes rectangle bounds, and rejects membership overlap. Store `RigidBlock[]` as project metadata with history and persistence support. Extend the physics adapter/simulator with rigid bodies whose center and rectangle area drive translation, while the canvas renders a non-interactive rounded rectangle and both menus expose create/remove operations with visible validation feedback.

**Tech Stack:** TypeScript, React 19, Zustand, SVG, CSS, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-10-15-rigid-block-design.md`

## Global Constraints

- `RigidBlock` is visual canvas metadata and must not change UITDL semantics, UITDL export, or D2 output.
- Every block must resolve to one fragment; creating a block that crosses fragments is rejected visibly.
- Blocks must not share members; visual rectangle intersection without shared membership is allowed.
- Selecting a node for a block includes that node and all of its descendants.
- The rigid body uses the marked rectangle's area and center, translates without rotation, and preserves member offsets.
- The rounded rectangle uses a medium radius of `12` SVG units and must not intercept pointer events.
- Deleting part of a block prunes its membership; deleting its last member removes the block.
- Copying a complete block creates a new remapped block; copying only part leaves pasted elements unblocked and reports the condition visibly.
- Use English action/function names, file headers, and observable logging for non-silent fallbacks.
- Prefer CSS classes for visual state and keep visible status until the condition changes or the user dismisses it.
- Add unit, integration, and system/UI evidence linked to the behavior under test.
- Do not add a runtime dependency.

## Review Focus

1. Partial hierarchy selection must include every descendant without duplicating members — owned by Task 1 tests.
2. Multi-fragment selection must be rejected before state mutation and explain the fragment conflict — owned by Task 1 and Task 5 tests.
3. Existing block membership must never be shared, and deletion must leave no dangling references — owned by Task 2 and Task 6 tests.
4. Mixed node/action/condition blocks must keep offsets while external forces move the rectangle body — owned by Task 4 tests.
5. Persistence and clipboard remapping must preserve complete blocks without silently assigning partial pastes — owned by Task 3 and Task 6 tests.

## File and responsibility map

- Create `src/rigidBlocks/rigidBlockModel.ts`: pure member normalization, validation, member keys, fragment resolution, and rectangle geometry.
- Create `src/rigidBlocks/rigidBlockModel.test.ts`: unit tests for the domain module.
- Modify `src/model/types.ts`: canonical `RigidBlock` and member types.
- Modify `src/state/types.ts`, `src/state/initial.ts`, and `src/state/store.ts`: state shape, counters, transient notices, and slice registration.
- Create `src/state/slices/rigidBlocks.slice.ts`: state operations and selection availability.
- Create `src/state/slices/rigidBlocks.slice.test.ts`: state and history-facing behavior tests.
- Modify `src/state/slices/history.slice.ts`: patch and undo/redo support for rigid blocks and their counter.
- Modify `src/io/serialization.ts`: project version, snapshot, validation, and migration handling.
- Create `src/io/serialization.rigidBlocks.test.ts`: project round-trip and legacy migration tests.
- Create `src/state/slices/clipboard.slice.test.ts`: complete-block remapping and partial-copy behavior tests.
- Modify `src/state/types.ts` clipboard payload shape and `src/state/slices/clipboard.slice.ts`: complete-block remapping and partial-copy behavior.
- Modify `src/state/slices/edit.slice.ts`: prune or remove blocks when selected members are deleted.
- Create `src/physics/rigidBlockBodies.ts`: conversion from valid block metadata to physics body inputs.
- Create `src/physics/rigidBlockBodies.test.ts`: body center, area, and member-offset tests.
- Modify `src/physics/force-simulator.ts`: rigid-body integration, body-centered forces, rectangle collision area, and per-member output.
- Modify `src/physics/adapter.ts` and `src/physics/runForces.ts`: build bodies, expand movable members to complete blocks, and keep simulations same-fragment.
- Modify `src/physics/force-simulator.test.ts` and `src/physics/runForces.test.ts`: physics and orchestration regression tests.
- Create `src/components/Canvas/RigidBlocksLayer.tsx`: non-interactive rounded rectangles.
- Create `src/components/Canvas/RigidBlockNotice.tsx`: visible success/error status with explicit dismissal.
- Create `src/components/Canvas/RigidBlocksLayer.test.tsx`: visual rendering and accessibility tests.
- Modify `src/components/Canvas/Canvas.tsx` and `src/index.css`: layer placement and light/dark CSS.
- Modify `src/components/Canvas/renderMenus.tsx`: contextual create/remove actions and validation feedback.
- Modify `src/components/Canvas/TopToolbar/menus/SimMenu.tsx`: repeated create/remove actions in the simulation menu.
- Modify `src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx` and relevant menu tests: command availability and failure feedback.

### Task 1: Add the pure RigidBlock domain model

**Files:**
- Create: `src/rigidBlocks/rigidBlockModel.ts`
- Test: `src/rigidBlocks/rigidBlockModel.test.ts`
- Modify: `src/model/types.ts`

**Interfaces:**
- Consumes: node, action, condition, edge arrays; current selection sets; existing `buildFragmentGroups`; existing layout measurement helpers.
- Produces: `RigidBlockId`, `RigidBlockMember`, `RigidBlock`, `RigidBlockSelection`, `RigidBlockBounds`, `RigidBlockValidationError`, `expandRigidBlockSelection`, `validateRigidBlockSelection`, `memberKey`, and `buildRigidBlockBounds`.

- [ ] **Step 1: Write failing unit tests**

  Add tests named `expandsSelectedNodesToAllDescendants`, `deduplicatesMembersAcrossMixedSelection`, `rejectsMembersFromDifferentFragments`, `rejectsMembershipAlreadyOwnedByAnotherBlock`, `acceptsMembersFromOneFragment`, `buildsBoundsFromMeasuredElements`, and `usesBoundsCenterAsRigidBodyCenter`. Assert the exact member keys, rejection reason codes, and rectangle center/width/height.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm test -- src/rigidBlocks/rigidBlockModel.test.ts --reporter=verbose`

  Expected: FAIL because the domain module and `RigidBlock` types do not exist.

- [ ] **Step 3: Implement the canonical types and pure functions**

  Add the types to `src/model/types.ts`. In `rigidBlockModel.ts`, normalize node selection by adding the selected node and every descendant, convert all three selection sets to member references, deduplicate by `kind:id`, resolve fragment membership through `buildFragmentGroups`, and reject any selection with more than one resolved fragment or any member already present in an existing block. Compute measured bounds with one shared padding constant and return the bounds center used by physics and rendering. Use explicit error codes for `empty-selection`, `multiple-fragments`, `member-overlap`, `missing-member`, and `invalid-geometry`.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `npm test -- src/rigidBlocks/rigidBlockModel.test.ts --reporter=verbose`

  Expected: PASS for all domain tests.

- [ ] **Step 5: Commit**

  ```bash
  git add src/model/types.ts src/rigidBlocks/rigidBlockModel.ts src/rigidBlocks/rigidBlockModel.test.ts
  git commit -m "Add RigidBlock domain model"
  ```

### Task 2: Add state operations, history, and persistence

**Files:**
- Create: `src/state/slices/rigidBlocks.slice.ts`
- Test: `src/state/slices/rigidBlocks.slice.test.ts`
- Test: `src/io/serialization.rigidBlocks.test.ts`
- Modify: `src/state/types.ts`
- Modify: `src/state/initial.ts`
- Modify: `src/state/store.ts`
- Modify: `src/state/slices/history.slice.ts`
- Modify: `src/io/serialization.ts`

**Interfaces:**
- Consumes: Task 1 domain functions and `RigidBlock` types.
- Produces: `rigidBlocks`, `nextRigidBlockId`, `rigidBlockNotice`, `createRigidBlockFromSelection`, `removeRigidBlockFromSelection`, `getRigidBlockAvailability`, `getRigidBlockForMember`, `setRigidBlockNotice`, and `dismissRigidBlockNotice`.

- [ ] **Step 1: Write failing state and persistence tests**

  Add tests named `createsBlockFromNormalizedSelection`, `doesNotMutateStateWhenSelectionCrossesFragments`, `doesNotCreateOverlappingMembership`, `undoesAndRedoesBlockCreation`, `roundTripsRigidBlocksInProjectData`, and `migratesVersionOneProjectsWithNoBlocks`. Assert that invalid operations leave `rigidBlocks` and counters unchanged, valid creation increments only `nextRigidBlockId`, and the notice contains the failure reason.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm test -- src/state/slices/rigidBlocks.slice.test.ts src/io/serialization.rigidBlocks.test.ts --reporter=verbose`

  Expected: FAIL because state, history, and serialization do not yet know `RigidBlock`.

- [ ] **Step 3: Implement the slice and register its state**

  Add the persistent arrays and counter to `AppState`/`initialState`, register `rigidBlocksSlice` in `store.ts`, and keep notices transient. `createRigidBlockFromSelection()` must call the domain validator before mutating state, wrap the mutation in `captureDelta`, and return a discriminated result. `removeRigidBlockFromSelection()` must remove the block containing the current selection without touching its elements. Expose availability data so both menus can disable invalid commands and display a reason.

- [ ] **Step 4: Extend history and project migration**

  Add `rigidBlocks` to `HistoryKey`, `Delta`, editing-session snapshots, patch application, and next-counter recalculation. Bump the project shape from version `1` to `2`; accept version 1 by migrating `rigidBlocks: []` and `nextRigidBlockId`, and reject unsupported versions with the existing visible error path. Include blocks in `makeProjectSnapshot` and Zustand `partialize`, while excluding transient notices and selections. Log any fallback with cause, fallback, and impact.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run: `npm test -- src/state/slices/rigidBlocks.slice.test.ts src/io/serialization.rigidBlocks.test.ts src/state/history.test.ts --reporter=verbose`

  Expected: PASS, including undo/redo and version 1 migration.

- [ ] **Step 6: Commit**

  ```bash
  git add src/state/types.ts src/state/initial.ts src/state/store.ts src/state/slices/rigidBlocks.slice.ts src/state/slices/rigidBlocks.slice.test.ts src/state/slices/history.slice.ts src/io/serialization.ts src/io/serialization.rigidBlocks.test.ts
  git commit -m "Persist and undo RigidBlock state"
  ```

### Task 3: Reconcile RigidBlocks with deletion and clipboard operations

**Files:**
- Create: `src/state/slices/clipboard.slice.test.ts`
- Modify: `src/state/types.ts`
- Modify: `src/state/slices/clipboard.slice.ts`
- Modify: `src/state/slices/edit.slice.ts`

**Interfaces:**
- Consumes: Task 1 member keys and Task 2 state operations/history.
- Produces: clipboard payload support for `RigidBlock[]`, remapped complete-block paste, and structural pruning after deletion.

- [ ] **Step 1: Write failing clipboard and deletion tests**

  Add tests named `copiesCompleteRigidBlockMetadata`, `pastesCompleteRigidBlockWithRemappedMembers`, `doesNotPastePartialRigidBlockMembership`, `prunesDeletedMembersFromRigidBlocks`, and `removesEmptyRigidBlocksAfterDeletion`. Assert that complete copies create a new block, partial copies leave pasted members unblocked and set a visible notice, and deletion remains undoable.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm test -- src/state/slices/clipboard.slice.test.ts --reporter=verbose`

  Expected: FAIL because clipboard payloads and deletion do not carry or reconcile blocks.

- [ ] **Step 3: Extend copy and paste remapping**

  Add `rigidBlocks` to `ClipboardPayload`. During copy, include a block only when every member is present in the copied selection; record partial-block metadata separately so paste can issue the explicit notice. During paste, allocate a fresh `RigidBlockId`, remap all member identifiers through the existing node/action/condition maps, preserve local geometry through the existing translation, and append only complete blocks.

- [ ] **Step 4: Prune blocks during deletion**

  In `deleteSelected`, include `rigidBlocks` in the captured history keys, remove deleted member references, retain surviving members, remove empty blocks, and keep the operation as one undoable entry. If a block becomes invalid for any other reason, remove it and set a visible notice rather than retaining dangling references.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run: `npm test -- src/state/slices/clipboard.slice.test.ts src/state/slices/rigidBlocks.slice.test.ts --reporter=verbose`

  Expected: PASS for complete/partial copy and deletion reconciliation.

- [ ] **Step 6: Commit**

  ```bash
  git add src/state/types.ts src/state/slices/clipboard.slice.ts src/state/slices/edit.slice.ts src/state/slices/clipboard.slice.test.ts
  git commit -m "Reconcile RigidBlocks with clipboard and deletion"
  ```

### Task 4: Add rigid-body simulation behavior

**Files:**
- Create: `src/physics/rigidBlockBodies.ts`
- Test: `src/physics/rigidBlockBodies.test.ts`
- Modify: `src/physics/force-simulator.ts`
- Modify: `src/physics/adapter.ts`
- Modify: `src/physics/runForces.ts`
- Modify: `src/physics/force-simulator.test.ts`
- Modify: `src/physics/runForces.test.ts`

**Interfaces:**
- Consumes: Task 1 bounds/member model and Task 2 persisted blocks.
- Produces: `RigidBodyInput`, `buildRigidBodyInputs`, and a `ForceSimulator` path that returns translated positions for every block member.

- [ ] **Step 1: Write failing physics tests**

  Add tests named `buildsOneBodyFromMixedRigidBlockMembers`, `keepsMemberOffsetsAfterSteps`, `usesRectangleCenterAndAreaForBodyGeometry`, `aggregatesExternalForcesAtTheBody`, `ignoresInternalEdgesAsDeformationSprings`, `expandsMovabilityWhenAnyBlockMemberIsSelected`, and `keepsDifferentFragmentsInIndependentSimulations`. Assert exact offsets before and after multiple steps, stable member-to-member geometry, body center movement, and no simulator group spanning two fragments.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm test -- src/physics/rigidBlockBodies.test.ts src/physics/force-simulator.test.ts src/physics/runForces.test.ts --reporter=verbose`

  Expected: FAIL because the simulator only shares motion for existing node roots and does not model rectangular rigid bodies.

- [ ] **Step 3: Implement body conversion**

  Add `RigidBodyInput` with `id`, `center`, `width`, `height`, and member keys. Build it only from valid same-fragment blocks, using the shared bounds helper from Task 1. Map each member to a local offset and filter internal edges from deformation constraints while retaining external relationships.

- [ ] **Step 4: Extend `ForceSimulator` with rigid bodies**

  Preserve existing node-root and particle behavior, but add a rigid-body path keyed by `RB.<id>`. Compute body-centered force accumulation, integrate one translational position/velocity per body, use the rectangle width/height for body collision area, and reconstruct each member position from `center + localOffset`. Keep the existing `getPositions()` contract so `applyPositionsToStore` remains the write boundary.

- [ ] **Step 5: Integrate selection and fragment orchestration**

  In `buildSimulatorFromStore`, pass blocks belonging to the current `includedIds`. In `startForcesRun`, expand the movable set to all members of a block when any member is selected, while preserving the existing independent-fragment grouping. Ensure invalid or stale blocks are excluded with an observable cause, fallback, and impact.

- [ ] **Step 6: Run focused tests and verify they pass**

  Run: `npm test -- src/physics/rigidBlockBodies.test.ts src/physics/force-simulator.test.ts src/physics/runForces.test.ts --reporter=verbose`

  Expected: PASS for rigid translation, rectangle physics, external forces, internal edges, fragment isolation, and existing force behavior.

- [ ] **Step 7: Commit**

  ```bash
  git add src/physics/rigidBlockBodies.ts src/physics/rigidBlockBodies.test.ts src/physics/force-simulator.ts src/physics/adapter.ts src/physics/runForces.ts src/physics/force-simulator.test.ts src/physics/runForces.test.ts
  git commit -m "Simulate RigidBlocks as translated bodies"
  ```

### Task 5: Render blocks and expose visible notices

**Files:**
- Create: `src/components/Canvas/RigidBlocksLayer.tsx`
- Create: `src/components/Canvas/RigidBlockNotice.tsx`
- Test: `src/components/Canvas/RigidBlocksLayer.test.tsx`
- Modify: `src/components/Canvas/Canvas.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 1 `buildRigidBlockBounds`, Task 2 `rigidBlocks` and `rigidBlockNotice` state.
- Produces: a non-interactive SVG layer and accessible notice rendering that both menus can trigger through shared state.

- [ ] **Step 1: Write failing rendering tests**

  Add tests named `rendersRoundedRigidBlockBounds`, `usesTheSameCenterAndAreaAsPhysicsGeometry`, `doesNotCapturePointerEvents`, `rendersDarkModeClass`, and `showsAndDismissesRigidBlockNotice`. Assert `rx="12"`, `pointer-events="none"`, `data-rigid-block-id`, exact bounds from the domain helper, `role="status"`, and explicit dismissal.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm test -- src/components/Canvas/RigidBlocksLayer.test.tsx --reporter=verbose`

  Expected: FAIL because the layer, notice, and CSS classes do not exist.

- [ ] **Step 3: Implement the SVG layer and CSS**

  Render the layer behind edges and elements, use the shared bounds calculation, set rounded rectangle attributes, and add CSS classes for fill/stroke in light and dark canvas modes. Set `pointerEvents="none"` and keep visual state in CSS rather than per-element JavaScript styles.

- [ ] **Step 4: Implement visible notices and wire Canvas**

  Render success/error notices from transient state, keep them until dismissal or a state change, and place the layer plus notice in `Canvas.tsx`. Do not let notices or rectangles block selection, drag, simulation, or context-menu events.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run: `npm test -- src/components/Canvas/RigidBlocksLayer.test.tsx src/components/Canvas/SimulationProgressDialog.test.tsx --reporter=verbose`

  Expected: PASS with immediate visual state and no regression to progress visibility.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/Canvas/RigidBlocksLayer.tsx src/components/Canvas/RigidBlockNotice.tsx src/components/Canvas/RigidBlocksLayer.test.tsx src/components/Canvas/Canvas.tsx src/index.css
  git commit -m "Render persistent RigidBlock overlays"
  ```

### Task 6: Add contextual and simulation-menu commands

**Files:**
- Test: `src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx`
- Test: `src/components/Canvas/renderMenus.rigidBlocks.test.tsx`
- Modify: `src/components/Canvas/renderMenus.tsx`
- Modify: `src/components/Canvas/TopToolbar/menus/SimMenu.tsx`

**Interfaces:**
- Consumes: Task 2 availability and state operations, Task 5 notice rendering.
- Produces: create/remove commands in both menu surfaces with disabled states, titles, and visible failure reasons.

- [ ] **Step 1: Write failing menu tests**

  Add tests named `offersCreateRigidBlockForValidSelection`, `disablesCreateForMultiFragmentSelection`, `disablesCreateForOverlappingMembership`, `offersRemoveForSelectedBlock`, and `showsFailureReasonAfterRejectedCreation`. Assert both context-menu and simulation-menu labels, disabled state, operation calls, and notice content.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm test -- src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx src/components/Canvas/renderMenus.rigidBlocks.test.tsx --reporter=verbose`

  Expected: FAIL because neither menu exposes the commands.

- [ ] **Step 3: Add contextual commands**

  Add create/remove items to node, action, and condition context menus. Use the shared availability selector so invalid commands are disabled before mutation, and keep the current canvas-lock behavior. On activation, call the state operation and close the menu after success; rejected operations remain visible through `RigidBlockNotice`.

- [ ] **Step 4: Add simulation-menu commands**

  Repeat the same create/remove actions in `SimMenu.tsx`, preserving the existing arrangement controls and simulation progress behavior. Use explicit labels and titles that distinguish “rigid block” from a fixed-in-place element.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run: `npm test -- src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx src/components/Canvas/renderMenus.rigidBlocks.test.tsx --reporter=verbose`

  Expected: PASS for both menu surfaces and all rejection cases.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/Canvas/renderMenus.tsx src/components/Canvas/TopToolbar/menus/SimMenu.tsx src/components/Canvas/TopToolbar/menus/SimMenu.test.tsx src/components/Canvas/renderMenus.rigidBlocks.test.tsx
  git commit -m "Add RigidBlock menu commands"
  ```

### Task 7: Run complete verification and review the branch

**Files:**
- Modify only if needed after verification: files from Tasks 1–6

**Interfaces:**
- Consumes: all task outputs and the accepted spec.
- Produces: verified implementation evidence and a final branch review.

- [ ] **Step 1: Run the complete unit, integration, and system test suite**

  Run: `npm test -- --reporter=dot`

  Expected: all existing and new tests pass, including the baseline suite and the RigidBlock cases.

- [ ] **Step 2: Run static checks and production build**

  Run: `npm run lint`

  Expected: exit code 0 and no mojibake report.

  Run: `npm run build`

  Expected: TypeScript and Vite complete successfully.

- [ ] **Step 3: Manually inspect the changed behavior**

  Verify in the running application: valid same-fragment selection creates the rounded rectangle immediately; multi-fragment and membership-overlap attempts show visible reasons; simulation translates mixed members without changing relative offsets; complete copy/paste creates an independent block; partial paste remains unblocked; deletion prunes membership; reload preserves blocks; UITDL and D2 output remain unchanged.

- [ ] **Step 4: Review fallback observability and diff scope**

  Run: `git diff --check` and `git status --short`. Confirm no silent invalid-block fallback, no unrelated files, and no modification to the pre-existing untracked `project.json`.

- [ ] **Step 5: Commit any verification-only fixes**

  ```bash
  git add -u -- src docs/superpowers
  git commit -m "Verify RigidBlock integration"
  ```

## Self-review checklist

- **Spec coverage:** Requirements 1–11 map to Tasks 1–6; deletion, copy/paste, persistence, rendering, same-fragment validation, overlap prevention, simulation, and both menus each have named implementation and test steps.
- **Step scan:** Every task has failing-test, focused verification, implementation, passing-test, and commit steps; no step relies on an undefined fallback behavior.
- **Type consistency:** `RigidBlockMember`, `RigidBlock`, `RigidBlockSelection`, `RigidBlockBounds`, and `RigidBodyInput` are introduced before downstream consumers; state operations return discriminated results used by both menus.
- **Review focus:** All five high-risk inputs appear in the owning task tests and in the final manual verification.
- **Proportion:** The plan preserves existing module boundaries and adds only focused domain, physics-body, canvas-layer, and test files needed by the accepted specification.
