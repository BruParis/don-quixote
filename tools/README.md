# tools/

Dev-only tooling for authoring content. Not part of the shipped game (not referenced
by `index.html`, not part of the `tsc --noEmit && vite build` pipeline — `tsconfig.json`
only includes `src`).

- **world-builder/** — tileset inspector + map previewer. Run `npm run dev`, then open
  `/tools/world-builder/` in the browser.
