# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — type-check (`tsc --noEmit`) then production build to `dist/`
- `npm run preview` — serve the production build

There are no tests or linter configured. This is not a git repository.

## Implementation notes (beyond the spec)

- Art is a CC0 pixel-art pack (`public/assets/{Overworld,Inner,character}.png` — ArMM1998's "Zelda-like tilesets and sprites", see README § Assets) — no Tiled files. Maps are ASCII grids in `src/data/maps/*.json`; legend chars map to tile indices per-tileset via `LEGENDS` in `src/core/textures.ts` (16px tiles, `TILE = 16`). Multi-tile structures (houses, furniture, the windmill tower) are placed as `stamps` — a source rect `[col, row, w, h]` copied from the tileset onto a decor layer, with optional per-tile collision.
- All 9 characters are runtime palette swaps of the one hero walk-cycle spritesheet (`src/core/characters.ts`, built in `BootScene`) — recoloring shirt/pants/hair pixels rather than shipping separate sheets. `PlayerController` plays the resulting `{key}-{direction}` animations.
- Windmill sails, the "!" event marker, and the completion checkmark are still procedural (`src/core/textures.ts`) since the pack has no equivalent.
- One generic `EpisodeScene` (key `Episode`) serves every map: door transitions call `scene.restart()` with a new `mapId`, while Dialogue/Minigame overlays use launch/pause/resume via `src/core/overlay.ts`. `MinigameScene` must call `this.input.keyboard.disableGlobalCapture()` while open (and re-enable on shutdown) or Phaser's global key capture (WASD/E/T/space) blocks typing into the DOM answer inputs.
- Minigames render as DOM overlays (`#minigame-root` in index.html, styled there); handlers live in `src/minigames/` and are registered by `type` string in `src/minigames/index.ts`. The HUD is also DOM (`src/core/hud.ts`) because the exploration camera runs at 3-4× zoom.
- In-world Phaser `Text` objects (NPC name labels, interact prompt) need `resolution: 4` in their style — otherwise small font sizes render blurry once magnified by the camera zoom.
- New data files (maps, dialogues, minigames) must be registered in `src/data/index.ts`. New characters need a palette entry in `src/core/characters.ts`.
- JSON map imports need `as unknown as MapDef` casts (tuple vs number[] inference).
- `npm run build` sets `base: './'` (vite.config.ts) and `Scale.FIT` (main.ts) so the game works embedded in an iframe/subpath (e.g. Google Sites) at any size. Deployed to Vercel; `npx vercel --prod` redeploys to the same stable alias.
- `scripts/screenshot.mjs` (needs `puppeteer-core` + local Chrome) drives a headless run through every map for visual verification — useful after art/scene changes since there's no visual test suite.

## What this project is

A 2D browser game that retraces the story of *Don Quixote* to teach Spanish. Players pick episodes from a world map, walk around a tile-based map per episode, trigger NPCs/events, and complete Spanish-learning minigames (vocab, grammar, conjugation, dialogue challenges) embedded in the story.

**Target audience:** neurodivergent students (dyslexia, ADHD) at a French collège/lycée. Accessibility and adaptation to these needs are a core requirement, not an afterthought — weigh them alongside any feature or content work:

- Dyslexia: readable typography (spacing, avoid justified/dense text), short text chunks over long paragraphs, avoid relying on text alone (icons/audio support), no reading-speed pressure.
- ADHD: clear immediate feedback, short focused tasks, minimal visual clutter/distraction, predictable pacing, avoid punishing timers.
- Translations target French (`fr` field throughout dialogues/minigames), not English, since students are francophone.

Full requirements live in `don-quixote-game-spec.md` — read it before starting implementation work. Key points summarized below.

## Tech stack (per spec)

- **Phaser 3** (latest stable — explicitly NOT Phaser 4, which is called out as unstable)
- **Tiled** (external tool) for authoring tilemaps, exported as JSON
- Vanilla JS/TypeScript for game logic
- Minigames may be Phaser scenes OR HTML/CSS/DOM overlays layered on the canvas — DOM overlays are preferred for text-heavy exercises (conjugation drills, quizzes, drag-and-drop matching)
- No backend: progress/save data goes in `localStorage`

## Architecture: scene hierarchy

The game must be structured as a tree of Phaser Scenes, each self-contained with its own loop/camera/input:

- **BootScene** — preloads core assets
- **WorldMapScene** — map of Spain/La Mancha with selectable episode nodes; nodes have locked/unlocked state based on progress; clicking a node launches that episode's scene(s)
- **EpisodeScene** (one per location, e.g. `LaManchaVillageScene`, `InnScene`, `WindmillScene`) — free 4-directional player movement on a Tiled tilemap, NPCs as sprites with overlap/collision triggers, "door" triggers load a connected EpisodeScene, NPC/event triggers pause movement and launch an overlay scene
- **DialogueScene** (overlay) — reusable, data-driven NPC dialogue/story text, Spanish + optional audio/translation
- **MinigameScene** (overlay, one flexible scene or several per game type) — reusable per challenge type (vocab matching, conjugation drill, multiple choice, drag-and-drop, fill-in-the-blank); takes a config object (question set, correct answers, difficulty) as launch data; returns a result (score/pass-fail) to the parent scene via event/callback before stopping

**Critical scene-transition rule:** overlays (DialogueScene, MinigameScene) must be launched with `scene.launch` / `scene.pause` / `scene.resume` / `scene.stop` — never `scene.start` — so the underlying EpisodeScene's state isn't lost while paused underneath.

## Core systems to build (in rough dependency order)

1. **Scene transition manager** — shared helper for launching overlay scenes on top of exploration scenes and cleanly resuming after
2. **Player controller** — reusable 4-directional movement + animation component shared across all exploration scenes (classic top-down Zelda-style walking, tile-based collision)
3. **NPC/trigger system** — data-driven: NPCs/triggers defined declaratively per map (position, sprite, dialogue ID, minigame ID, one-time vs repeatable), not hardcoded per scene
4. **Dialogue system** — reusable text box UI, branching dialogue support, Spanish text with optional translation toggle
5. **Minigame framework** — common interface/contract (`init(config)`, `onComplete(result)`) so new minigame types plug in without touching core game loop
6. **Progress/save system** — tracks unlocked episodes, completed NPCs/challenges, minigame scores; persisted to `localStorage`
7. **World map UI** — episode nodes with locked/unlocked/completed visual states

## Content data structure

All narrative/pedagogical content must be data-driven (JSON), separate from game logic, so content can be edited without touching code:

- `episodes.json` — episodes list, unlock conditions, associated map/scene keys
- `npcs.json` — per-map NPC definitions (position, sprite, linked dialogue/minigame)
- `dialogues/*.json` — dialogue trees per NPC/event, in Spanish + translations
- `minigames/*.json` — question sets and config per minigame instance

## Guiding constraints

- Favor data-driven, reusable architecture over one-off hardcoded scenes — the game is expected to grow to many episodes and minigames, so new content should be addable by adding data files, not by duplicating scene code.
- Minigames must stay modular/swappable behind the common minigame interface so new Spanish-exercise types can be added later without refactoring core scenes.
- Every new feature or content change should be checked against the neurodivergent-accessibility needs above (dyslexia, ADHD) — not just "does it work" but "is it readable and low-pressure for these students."

## Suggested build order (per spec)

1. Phaser 3 project skeleton (Boot + WorldMapScene placeholder)
2. WorldMapScene with dummy episode nodes and navigation
3. One complete EpisodeScene (e.g. La Mancha village) with tilemap, player movement, one NPC trigger
4. DialogueScene wired to the NPC trigger
5. MinigameScene framework with one working minigame type (multiple-choice vocab)
6. Wire minigame completion into the progress/save system
7. Repeat the EpisodeScene pattern for additional episodes/locations
8. Add remaining minigame types
9. Polish: transitions, audio, translation toggle, progress UI on world map
