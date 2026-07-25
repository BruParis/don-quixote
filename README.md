# Don Quixote — Aprende español

A 2D browser game that retraces the story of *Don Quixote* to teach Spanish. Select episodes on a map of La Mancha, explore top-down maps, talk to characters from the novel, and complete Spanish-learning minigames (vocabulary, grammar, conjugation) embedded in the story.

Built with [Phaser 3](https://phaser.io/), TypeScript and Vite. Tile and character art is a CC0 (public domain) pixel-art pack — see [Assets](#assets) below.

## How to launch

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (normally **http://localhost:5173**) in your browser.

For a production build:

```bash
npm run build     # type-checks and outputs to dist/
npm run preview   # serves the production build locally
```

## How to play

- On the world map, click an unlocked episode node (gold, pulsing) to enter it. Later episodes unlock as you complete earlier ones.
- Complete an episode by finishing all of its required challenges (the objectives counter is in the HUD).
- Progress is saved automatically in your browser (`localStorage`).

### Controls

| Key | Action |
|---|---|
| Arrow keys / WASD | Move |
| E or Space | Talk / interact with a nearby character |
| Space / click | Advance dialogue |
| T | Toggle English translations (dialogue + world map) |
| M | Return to the world map |
| R (on world map, twice) | Reset all progress |

## Episodes

1. **El ingenioso hidalgo** — the village of La Mancha: greetings vocabulary, *ser* vs *estar*, household words.
2. **La venta** — the inn where Don Quixote is "knighted": food vocabulary, knight-equipment vocabulary.
3. **Los molinos de viento** — the windmills: present-tense conjugation, fill-in-the-blank battle narration.

## Project structure

```
src/
  main.ts               Phaser game config + scene registration
  core/                 Shared systems: overlay transitions, save/progress,
                        procedural textures, player controller, DOM HUD
  scenes/               Boot, WorldMap, Episode (generic, data-driven),
                        Dialogue (overlay), Minigame (overlay)
  minigames/            Minigame framework: registry + one handler per
                        exercise type (multiple-choice, fill-in-blank,
                        matching, conjugation)
  data/
    episodes.json       Episode list, unlock order, required objectives
    maps/*.json         Tile grids (ASCII legend), spawns, NPCs, doors
    dialogues/*.json    Dialogue trees per character (Spanish + English)
    minigames/*.json    Question sets and config per minigame instance
```

## Adding content

Content is data-driven — no scene code changes needed:

- **New map**: add a JSON file in `src/data/maps/` — pick a `tileset` (`overworld` or `inner`), lay out the `grid` using that tileset's legend (`src/core/textures.ts`), place multi-tile structures (houses, furniture, the windmill tower) as `stamps` with a source rect from the tileset image, register the map in `src/data/index.ts`, and link it from a door or episode.
- **New character/trigger**: add an entry to the map's `npcs` array with a `dialogue` and/or `minigame` id; list its id in the episode's `requiredTriggers` if it must be completed. New characters need a palette entry in `src/core/characters.ts` (they reuse the same walk-cycle spritesheet, just recolored).
- **New minigame instance**: add a JSON file in `src/data/minigames/` using an existing `type`, register it in `src/data/index.ts`, and reference it from an NPC.
- **New minigame *type***: implement a `MinigameHandler` in `src/minigames/` and register it in `src/minigames/index.ts`.

## Assets

Tiles and character sprites come from **ArMM1998's "Zelda-like tilesets and sprites"** pack on OpenGameArt, licensed [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain — no attribution required, used here anyway as courtesy): https://opengameart.org/content/zelda-like-tilesets-and-sprites

- `public/assets/Overworld.png`, `Inner.png` — outdoor and interior tilesets (16×16 tiles), referenced by `src/core/textures.ts`.
- `public/assets/character.png` — the hero walk-cycle spritesheet (16×32 frames). Every other character is a runtime palette swap of this same sheet (`src/core/characters.ts`), so there's one sheet to maintain.
- The windmill sails, event "!" marker, and the completion checkmark badge are still generated procedurally (`src/core/textures.ts`) since the pack has no equivalent.
