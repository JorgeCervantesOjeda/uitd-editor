# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the application code. Key areas include:
  - `src/components/` for React UI components (e.g., `Canvas/Canvas.tsx`).
  - `src/state/` for Zustand state and slice files (e.g., `slices/*.slice.ts`).
  - `src/import/`, `src/export/`, `src/validation/`, `src/layout/` for domain logic.
  - `src/assets/` for bundled assets.
- `public/` hosts static files copied as-is.
- `dist/` is the production build output.

## Build, Test, and Development Commands

Run commands from the repo root:

- `npm run dev` - start the Vite dev server with HMR.
- `npm run build` - type-check and build to `dist/`.
- `npm run lint` - run ESLint across the project.
- `npm run preview` - serve the production build locally.

## Coding Style & Naming Conventions

- Language: TypeScript + React (`.ts`/`.tsx`).
- Indentation/formatting: follow existing file patterns; keep changes consistent within a file.
- Component files: `PascalCase.tsx` inside `src/components/`.
- Hooks: `useSomething` naming.
- State slices: `*.slice.ts` inside `src/state/slices/`.
- Linting is enforced via `eslint.config.js`; run `npm run lint` before committing.

## Testing Guidelines

- No automated test framework is currently configured in this repo.
- If you add tests, document the framework and add a script (e.g., `npm run test`) in `package.json`.
- Prefer colocated test files (e.g., `Component.test.tsx`) and keep names explicit.

## Commit & Pull Request Guidelines

- Commit history shows free-form messages in Spanish/English; no strict convention.
- Use short, imperative summaries that describe the change (e.g., "Fix selection bug").
- PRs should include:
  - a clear description of behavior changes,
  - steps to verify,
  - screenshots or GIFs for UI changes,
  - linked issues/tasks when applicable.

## Security & Configuration Tips

- Keep secrets out of the repo. Use environment files not committed to git.
- Check `firebase.json` and `.firebaserc` before deploy-related changes.

