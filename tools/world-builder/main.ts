import { MAPS, DIALOGUES, MINIGAMES } from '../../src/data';
import { COLLIDE_CHARS, LEGENDS, TILE } from '../../src/core/textures';
import { CHARACTER_IDS } from '../../src/core/characters';
import type { DoorDef, MapDef, NpcDef, StampDef } from '../../src/types';

type TilesetId = 'overworld' | 'inner';
type Tool = 'paint' | 'stamp' | 'npc' | 'door' | 'spawn';

const ASSET_SRC: Record<TilesetId, string> = {
  overworld: '/assets/Overworld.png',
  inner: '/assets/Inner.png'
};

// The game hardcodes this column count in two places (OVERWORLD_COLS in
// src/core/textures.ts, TILESET_COLS in src/scenes/EpisodeScene.ts) instead of
// deriving it from the image. We derive it here from the real image and flag it
// if it ever stops matching what the game assumes.
const ASSUMED_COLS = 40;

interface TilesetImg {
  img: HTMLImageElement;
  cols: number;
  rows: number;
}

const tilesets = {} as Record<TilesetId, TilesetImg>;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadTilesets(): Promise<void> {
  for (const id of Object.keys(ASSET_SRC) as TilesetId[]) {
    const img = await loadImage(ASSET_SRC[id]);
    tilesets[id] = {
      img,
      cols: Math.round(img.naturalWidth / TILE),
      rows: Math.round(img.naturalHeight / TILE)
    };
  }
}

function indexToColRow(index: number, cols: number): { col: number; row: number } {
  return { col: index % cols, row: Math.floor(index / cols) };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---- DOM ----
function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const tilesetSelect = el<HTMLSelectElement>('tileset-select');
const tilesetZoomInput = el<HTMLInputElement>('tileset-zoom');
const tilesetCanvas = el<HTMLCanvasElement>('tileset-canvas');
const tilesetTitle = el<HTMLSpanElement>('tileset-title');
const tilesetDims = el<HTMLParagraphElement>('tileset-dims');

const mapSelect = el<HTMLSelectElement>('map-select');
const mapZoomInput = el<HTMLInputElement>('map-zoom');
const mapCanvas = el<HTMLCanvasElement>('map-canvas');
const mapTitle = el<HTMLSpanElement>('map-title');

const toggleGrid = el<HTMLInputElement>('toggle-grid');
const toggleCollide = el<HTMLInputElement>('toggle-collide');
const toggleStamps = el<HTMLInputElement>('toggle-stamps');
const toggleNpcs = el<HTMLInputElement>('toggle-npcs');
const toggleDoors = el<HTMLInputElement>('toggle-doors');
const toggleSpawns = el<HTMLInputElement>('toggle-spawns');

const infoPanel = el<HTMLDivElement>('info-panel');
const legendBody = document.querySelector<HTMLTableSectionElement>('#legend-table tbody')!;
const stampsBody = document.querySelector<HTMLTableSectionElement>('#stamps-table tbody')!;
const npcsBody = document.querySelector<HTMLTableSectionElement>('#npcs-table tbody')!;
const doorsBody = document.querySelector<HTMLTableSectionElement>('#doors-table tbody')!;
const spawnsBody = document.querySelector<HTMLTableSectionElement>('#spawns-table tbody')!;

const tctx = tilesetCanvas.getContext('2d')!;
const mctx = mapCanvas.getContext('2d')!;

// ---- editor DOM ----
const editToggle = el<HTMLInputElement>('edit-toggle');
const editorControls = el<HTMLDivElement>('editor-controls');
const toolRadios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="tool"]'));

const paintPanel = el<HTMLDivElement>('paint-tool-panel');
const stampPanel = el<HTMLDivElement>('stamp-tool-panel');
const npcPanel = el<HTMLDivElement>('npc-tool-panel');
const doorPanel = el<HTMLDivElement>('door-tool-panel');
const spawnPanel = el<HTMLDivElement>('spawn-tool-panel');
const TOOL_PANELS: Record<Tool, HTMLDivElement> = {
  paint: paintPanel,
  stamp: stampPanel,
  npc: npcPanel,
  door: doorPanel,
  spawn: spawnPanel
};

const brushLabel = el<HTMLSpanElement>('brush-label');
const stampDraftLabel = el<HTMLSpanElement>('stamp-draft-label');
const stampCollideInput = el<HTMLInputElement>('stamp-collide');

const npcIdInput = el<HTMLInputElement>('npc-id');
const npcNameInput = el<HTMLInputElement>('npc-name');
const npcSpriteInput = el<HTMLInputElement>('npc-sprite');
const npcDialogueInput = el<HTMLInputElement>('npc-dialogue');
const npcMinigameInput = el<HTMLInputElement>('npc-minigame');
const npcRequiredInput = el<HTMLInputElement>('npc-required');
const npcAddBtn = el<HTMLButtonElement>('npc-add-btn');

const doorToSelect = el<HTMLSelectElement>('door-to');
const doorSpawnInput = el<HTMLInputElement>('door-spawn');
const doorAddBtn = el<HTMLButtonElement>('door-add-btn');
const doorSpawnKeysDatalist = el<HTMLDataListElement>('door-spawn-keys');

const spawnKeyInput = el<HTMLInputElement>('spawn-key');
const spawnAddBtn = el<HTMLButtonElement>('spawn-add-btn');

const undoBtn = el<HTMLButtonElement>('undo-btn');
const saveBtn = el<HTMLButtonElement>('save-btn');
const copyJsonBtn = el<HTMLButtonElement>('copy-json-btn');
const saveStatus = el<HTMLParagraphElement>('save-status');

const characterIdsDatalist = el<HTMLDataListElement>('character-ids');
const dialogueIdsDatalist = el<HTMLDataListElement>('dialogue-ids');
const minigameIdsDatalist = el<HTMLDataListElement>('minigame-ids');

// ---- state ----
const state = {
  tilesetId: 'overworld' as TilesetId,
  tilesetHover: null as { col: number; row: number } | null,
  tilesetPin: null as { col: number; row: number } | null,
  mapId: Object.keys(MAPS)[0],
  mapHover: null as { x: number; y: number } | null,
  crossHighlight: null as { tilesetId: TilesetId; col: number; row: number } | null,

  editMode: false,
  tool: 'paint' as Tool,
  brush: null as { char: string; index: number; isNew: boolean } | null,
  stampDraft: null as { src: [number, number, number, number] } | null,
  selectedStamp: null as number | null,
  pendingPlacement: null as { type: 'npc' | 'door' | 'spawn'; x: number; y: number } | null,
  undoStacks: {} as Record<string, MapDef[]>,
  dirtyMaps: new Set<string>()
};

// rect-select-in-progress on the tileset panel (stamp tool); not persisted state
let stampRectStart: { col: number; row: number } | null = null;
let stampRectEnd: { col: number; row: number } | null = null;

interface DragState {
  kind: 'paint' | 'stamp' | 'npc' | 'door' | 'spawn';
  index?: number;
  key?: string;
  offsetX?: number;
  offsetY?: number;
  lastCell?: { x: number; y: number };
}
let drag: DragState | null = null;

for (const id of Object.keys(MAPS)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = `${id} — ${MAPS[id].name}`;
  mapSelect.appendChild(opt);
}
mapSelect.value = state.mapId;

for (const id of Object.keys(MAPS)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = id;
  doorToSelect.appendChild(opt);
}

characterIdsDatalist.innerHTML = [...CHARACTER_IDS, 'sign']
  .map((id) => `<option value="${escapeHtml(id)}"></option>`)
  .join('');
dialogueIdsDatalist.innerHTML = Object.keys(DIALOGUES)
  .map((id) => `<option value="${escapeHtml(id)}"></option>`)
  .join('');
minigameIdsDatalist.innerHTML = Object.keys(MINIGAMES)
  .map((id) => `<option value="${escapeHtml(id)}"></option>`)
  .join('');

function currentMap(): MapDef {
  return MAPS[state.mapId];
}

function effectiveLegend(map: MapDef): Record<string, number> {
  return { ...LEGENDS[map.tileset], ...(map.legend ?? {}) };
}

function isCollideChar(map: MapDef, ch: string): boolean {
  return (COLLIDE_CHARS[map.tileset] ?? []).includes(ch);
}

function stampCellCollide(map: MapDef, x: number, y: number): boolean {
  const doorTiles = new Set(map.doors.map((d) => `${d.x},${d.y}`));
  if (doorTiles.has(`${x},${y}`)) return false;
  for (const stamp of map.stamps ?? []) {
    if (!stamp.collide) continue;
    const [, , w, h] = stamp.src;
    if (x >= stamp.x && x < stamp.x + w && y >= stamp.y && y < stamp.y + h) return true;
  }
  return false;
}

// ---- editor: hit-testing ----
function stampAt(map: MapDef, x: number, y: number): number {
  const stamps = map.stamps ?? [];
  for (let i = stamps.length - 1; i >= 0; i--) {
    const [, , w, h] = stamps[i].src;
    if (x >= stamps[i].x && x < stamps[i].x + w && y >= stamps[i].y && y < stamps[i].y + h) return i;
  }
  return -1;
}
function npcAt(map: MapDef, x: number, y: number): number {
  return map.npcs.findIndex((n) => n.x === x && n.y === y);
}
function doorAt(map: MapDef, x: number, y: number): number {
  return map.doors.findIndex((d) => d.x === x && d.y === y);
}
function spawnKeyAt(map: MapDef, x: number, y: number): string | null {
  for (const [k, [sx, sy]] of Object.entries(map.spawns)) {
    if (sx === x && sy === y) return k;
  }
  return null;
}

// ---- editor: mutation helpers ----
function snapshotForUndo(): void {
  const stack = (state.undoStacks[state.mapId] ??= []);
  stack.push(JSON.parse(JSON.stringify(currentMap())));
  if (stack.length > 30) stack.shift();
  updateUndoButton();
}

function markDirty(): void {
  state.dirtyMaps.add(state.mapId);
  updateSaveButton();
}

function setGridChar(map: MapDef, x: number, y: number, ch: string): void {
  const row = map.grid[y];
  map.grid[y] = row.slice(0, x) + ch + row.slice(x + 1);
}

const CHAR_POOL = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'0123456789'
];

function pickCharForIndex(map: MapDef, index: number): string {
  const legend = effectiveLegend(map);
  for (const [ch, idx] of Object.entries(legend)) {
    if (idx === index) return ch;
  }
  const used = new Set(Object.keys(legend));
  const free = CHAR_POOL.find((c) => !used.has(c));
  if (!free) throw new Error('legend character pool exhausted for this map');
  return free;
}

function applyBrush(map: MapDef, x: number, y: number): void {
  if (!state.brush) return;
  if (state.brush.isNew) {
    map.legend = { ...(map.legend ?? {}), [state.brush.char]: state.brush.index };
    state.brush.isNew = false;
    renderLegendTable();
  }
  setGridChar(map, x, y, state.brush.char);
  markDirty();
}

// ---- serialization ----
// Hand-formatted to match the existing hand-authored map files: short "record"
// objects (stamps, doors, sails) and numeric tuples stay on one line, while grid
// rows, legend/spawn entries and npcs (which vary a lot in field count) get one
// line each. Plain `JSON.stringify(map, null, 2)` explodes every array element
// onto its own line, which is technically valid but unreadable/hard to diff.
function fmtStamp(s: StampDef): string {
  const parts = [`"x": ${s.x}`, `"y": ${s.y}`, `"src": [${s.src.join(', ')}]`];
  if (s.collide) parts.push(`"collide": true`);
  return `{ ${parts.join(', ')} }`;
}
function fmtDoor(d: DoorDef): string {
  return `{ "x": ${d.x}, "y": ${d.y}, "to": ${JSON.stringify(d.to)}, "spawn": ${JSON.stringify(d.spawn)} }`;
}
function fmtSail(s: { x: number; y: number }): string {
  return `{ "x": ${s.x}, "y": ${s.y} }`;
}
function fmtNpc(n: NpcDef, braceIndent: string): string {
  const inner = braceIndent + '  ';
  const lines = [
    `"id": ${JSON.stringify(n.id)}`,
    `"name": ${JSON.stringify(n.name)}`,
    `"sprite": ${JSON.stringify(n.sprite)}`,
    `"x": ${n.x}`,
    `"y": ${n.y}`
  ];
  if (n.dialogue) lines.push(`"dialogue": ${JSON.stringify(n.dialogue)}`);
  if (n.minigame) lines.push(`"minigame": ${JSON.stringify(n.minigame)}`);
  if (n.required) lines.push(`"required": true`);
  return '{\n' + lines.map((l) => inner + l).join(',\n') + '\n' + braceIndent + '}';
}

function serializeMap(map: MapDef): string {
  const sections: string[] = [];
  sections.push(`  "name": ${JSON.stringify(map.name)}`);
  sections.push(`  "tileset": ${JSON.stringify(map.tileset)}`);
  if (map.zoom !== undefined) sections.push(`  "zoom": ${map.zoom}`);

  const gridLines = map.grid.map((r) => `    ${JSON.stringify(r)}`).join(',\n');
  sections.push(`  "grid": [\n${gridLines}\n  ]`);

  if (map.legend && Object.keys(map.legend).length > 0) {
    const legendLines = Object.entries(map.legend)
      .map(([k, v]) => `    ${JSON.stringify(k)}: ${v}`)
      .join(',\n');
    sections.push(`  "legend": {\n${legendLines}\n  }`);
  }

  if (map.stamps) {
    sections.push(
      map.stamps.length
        ? `  "stamps": [\n${map.stamps.map((s) => `    ${fmtStamp(s)}`).join(',\n')}\n  ]`
        : `  "stamps": []`
    );
  }

  if (map.sails) {
    sections.push(
      map.sails.length
        ? `  "sails": [\n${map.sails.map((s) => `    ${fmtSail(s)}`).join(',\n')}\n  ]`
        : `  "sails": []`
    );
  }

  const spawnLines = Object.entries(map.spawns)
    .map(([k, [x, y]]) => `    ${JSON.stringify(k)}: [${x}, ${y}]`)
    .join(',\n');
  sections.push(`  "spawns": {\n${spawnLines}\n  }`);

  sections.push(
    map.npcs.length
      ? `  "npcs": [\n${map.npcs.map((n) => `    ${fmtNpc(n, '    ')}`).join(',\n')}\n  ]`
      : `  "npcs": []`
  );

  sections.push(
    map.doors.length
      ? `  "doors": [\n${map.doors.map((d) => `    ${fmtDoor(d)}`).join(',\n')}\n  ]`
      : `  "doors": []`
  );

  return '{\n' + sections.join(',\n') + '\n}\n';
}

async function doSave(): Promise<void> {
  const map = currentMap();
  const json = serializeMap(map);
  saveStatus.textContent = 'saving…';
  try {
    const res = await fetch('/__world-builder/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mapId: state.mapId, json })
    });
    if (!res.ok) throw new Error(await res.text());
    state.dirtyMaps.delete(state.mapId);
    updateSaveButton();
    saveStatus.textContent = `saved ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    saveStatus.textContent = `save failed — ${String(err)}`;
  }
}

function doCopyJson(): void {
  const json = serializeMap(currentMap());
  navigator.clipboard
    ?.writeText(json)
    .then(() => {
      saveStatus.textContent = 'copied JSON to clipboard';
    })
    .catch(() => {});
}

function undo(): void {
  const stack = state.undoStacks[state.mapId];
  if (!stack || !stack.length) return;
  MAPS[state.mapId] = stack.pop()!;
  state.dirtyMaps.add(state.mapId);
  state.pendingPlacement = null;
  state.selectedStamp = null;
  drag = null;
  updatePendingLabel();
  updateUndoButton();
  updateSaveButton();
  renderAll();
}

// ---- editor: UI sync ----
function updateUndoButton(): void {
  undoBtn.disabled = !(state.undoStacks[state.mapId]?.length > 0);
}
function updateSaveButton(): void {
  saveBtn.disabled = !state.dirtyMaps.has(state.mapId);
}
function updateBrushLabel(): void {
  if (!state.brush) {
    brushLabel.textContent = 'none selected';
    return;
  }
  const { char, index, isNew } = state.brush;
  brushLabel.textContent = `'${char}' → index ${index}${isNew ? ' (new — added to legend on first paint)' : ''}`;
}
function updateStampDraftLabel(): void {
  if (!state.stampDraft) {
    stampDraftLabel.textContent = 'none selected';
    return;
  }
  const [c, r, w, h] = state.stampDraft.src;
  stampDraftLabel.textContent = `col ${c}, row ${r}, ${w}×${h} tiles`;
}
function updatePendingLabel(): void {
  const p = state.pendingPlacement;
  npcAddBtn.disabled = !(p && p.type === 'npc');
  npcAddBtn.textContent = p && p.type === 'npc' ? `Add at (${p.x},${p.y})` : 'Click map to place…';
  doorAddBtn.disabled = !(p && p.type === 'door');
  doorAddBtn.textContent = p && p.type === 'door' ? `Add at (${p.x},${p.y})` : 'Click map to place…';
  spawnAddBtn.disabled = !(p && p.type === 'spawn');
  spawnAddBtn.textContent = p && p.type === 'spawn' ? `Add at (${p.x},${p.y})` : 'Click map to place…';
}

/** Paint/stamp tools require the tileset panel to show the current map's own sheet. */
function syncEditTileset(): void {
  const lockNeeded = state.editMode && (state.tool === 'paint' || state.tool === 'stamp');
  tilesetSelect.disabled = lockNeeded;
  if (lockNeeded) {
    const want = currentMap().tileset;
    if (state.tilesetId !== want) {
      state.tilesetId = want;
      tilesetSelect.value = want;
      renderTileset();
    }
  }
}

// ---- rendering: tileset panel ----
function renderTileset(): void {
  const ts = tilesets[state.tilesetId];
  const zoom = Number(tilesetZoomInput.value);
  const w = ts.img.naturalWidth * zoom;
  const h = ts.img.naturalHeight * zoom;
  tilesetCanvas.width = w;
  tilesetCanvas.height = h;
  tctx.imageSmoothingEnabled = false;
  tctx.clearRect(0, 0, w, h);
  tctx.drawImage(ts.img, 0, 0, w, h);

  tctx.strokeStyle = 'rgba(255,255,255,0.15)';
  tctx.lineWidth = 1;
  for (let c = 0; c <= ts.cols; c++) {
    tctx.beginPath();
    tctx.moveTo(c * TILE * zoom + 0.5, 0);
    tctx.lineTo(c * TILE * zoom + 0.5, h);
    tctx.stroke();
  }
  for (let r = 0; r <= ts.rows; r++) {
    tctx.beginPath();
    tctx.moveTo(0, r * TILE * zoom + 0.5);
    tctx.lineTo(w, r * TILE * zoom + 0.5);
    tctx.stroke();
  }

  const drawCell = (col: number, row: number, color: string, width = 2) => {
    tctx.strokeStyle = color;
    tctx.lineWidth = width;
    tctx.strokeRect(col * TILE * zoom + 1, row * TILE * zoom + 1, TILE * zoom - 2, TILE * zoom - 2);
  };
  const drawRect = (col: number, row: number, w2: number, h2: number, color: string, dashed = false) => {
    tctx.strokeStyle = color;
    tctx.lineWidth = 2;
    if (dashed) tctx.setLineDash([4, 2]);
    tctx.strokeRect(col * TILE * zoom + 1, row * TILE * zoom + 1, w2 * TILE * zoom - 2, h2 * TILE * zoom - 2);
    tctx.setLineDash([]);
  };

  if (state.crossHighlight && state.crossHighlight.tilesetId === state.tilesetId) {
    drawCell(state.crossHighlight.col, state.crossHighlight.row, '#4fc3ff');
  }
  if (state.tilesetPin) drawCell(state.tilesetPin.col, state.tilesetPin.row, '#ffe066');
  if (state.editMode && state.tool === 'paint' && state.brush) {
    const cols = tilesets[state.tilesetId].cols;
    const { col, row } = indexToColRow(state.brush.index, cols);
    drawCell(col, row, '#4fc3ff', 3);
  }
  if (state.editMode && state.tool === 'stamp' && state.stampDraft) {
    const [c, r, sw, sh] = state.stampDraft.src;
    drawRect(c, r, sw, sh, '#7bc46a');
  }
  if (state.editMode && state.tool === 'stamp' && stampRectStart && stampRectEnd) {
    const col = Math.min(stampRectStart.col, stampRectEnd.col);
    const row = Math.min(stampRectStart.row, stampRectEnd.row);
    const w2 = Math.abs(stampRectEnd.col - stampRectStart.col) + 1;
    const h2 = Math.abs(stampRectEnd.row - stampRectStart.row) + 1;
    drawRect(col, row, w2, h2, '#ffe066', true);
  }
  if (state.tilesetHover) drawCell(state.tilesetHover.col, state.tilesetHover.row, '#ff5c5c');

  tilesetTitle.textContent = `${ASSET_SRC[state.tilesetId]} — ${ts.cols}×${ts.rows} tiles`;
  tilesetDims.textContent =
    ts.cols === ASSUMED_COLS
      ? `${ts.img.naturalWidth}×${ts.img.naturalHeight}px, ${ts.cols} cols — matches the ${ASSUMED_COLS}-col assumption hardcoded in the game code.`
      : `⚠ ${ts.img.naturalWidth}×${ts.img.naturalHeight}px = ${ts.cols} cols, but the game hardcodes ${ASSUMED_COLS} cols — indices would be WRONG for this sheet.`;
}

// ---- rendering: map panel ----
function markCell(x: number, y: number, zoom: number, color: string, label: string): void {
  const px = x * TILE * zoom;
  const py = y * TILE * zoom;
  mctx.beginPath();
  mctx.fillStyle = color;
  mctx.arc(px + (TILE * zoom) / 2, py + (TILE * zoom) / 2, 4, 0, Math.PI * 2);
  mctx.fill();
  mctx.font = '10px monospace';
  mctx.lineWidth = 3;
  mctx.strokeStyle = 'rgba(0,0,0,0.85)';
  mctx.strokeText(label, px + 6, py + 4);
  mctx.fillStyle = color;
  mctx.fillText(label, px + 6, py + 4);
}

function renderMap(): void {
  const map = currentMap();
  const ts = tilesets[map.tileset];
  const legend = effectiveLegend(map);
  const zoom = Number(mapZoomInput.value);
  const rows = map.grid.length;
  const cols = map.grid[0]?.length ?? 0;
  const w = cols * TILE * zoom;
  const h = rows * TILE * zoom;
  mapCanvas.width = w;
  mapCanvas.height = h;
  mctx.imageSmoothingEnabled = false;
  mctx.clearRect(0, 0, w, h);

  for (let y = 0; y < rows; y++) {
    const row = map.grid[y];
    for (let x = 0; x < row.length; x++) {
      const index = legend[row[x]] ?? 0;
      const { col, row: trow } = indexToColRow(index, ts.cols);
      mctx.drawImage(
        ts.img,
        col * TILE, trow * TILE, TILE, TILE,
        x * TILE * zoom, y * TILE * zoom, TILE * zoom, TILE * zoom
      );
    }
  }

  if (toggleStamps.checked) {
    for (const stamp of map.stamps ?? []) {
      const [srcCol, srcRow, sw, sh] = stamp.src;
      mctx.drawImage(
        ts.img,
        srcCol * TILE, srcRow * TILE, sw * TILE, sh * TILE,
        stamp.x * TILE * zoom, stamp.y * TILE * zoom, sw * TILE * zoom, sh * TILE * zoom
      );
      mctx.strokeStyle = stamp.collide ? '#ff8a3d' : '#4fc3ff';
      mctx.lineWidth = 2;
      mctx.strokeRect(
        stamp.x * TILE * zoom + 1,
        stamp.y * TILE * zoom + 1,
        sw * TILE * zoom - 2,
        sh * TILE * zoom - 2
      );
    }
  }

  if (toggleCollide.checked) {
    mctx.fillStyle = 'rgba(255,0,0,0.28)';
    for (let y = 0; y < rows; y++) {
      const row = map.grid[y];
      for (let x = 0; x < row.length; x++) {
        if (isCollideChar(map, row[x]) || stampCellCollide(map, x, y)) {
          mctx.fillRect(x * TILE * zoom, y * TILE * zoom, TILE * zoom, TILE * zoom);
        }
      }
    }
  }

  if (toggleGrid.checked) {
    mctx.strokeStyle = 'rgba(255,255,255,0.12)';
    mctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      mctx.beginPath();
      mctx.moveTo(x * TILE * zoom + 0.5, 0);
      mctx.lineTo(x * TILE * zoom + 0.5, h);
      mctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      mctx.beginPath();
      mctx.moveTo(0, y * TILE * zoom + 0.5);
      mctx.lineTo(w, y * TILE * zoom + 0.5);
      mctx.stroke();
    }
  }

  if (toggleSpawns.checked) {
    for (const [key, [sx, sy]] of Object.entries(map.spawns)) {
      markCell(sx, sy, zoom, '#7bc46a', `⚑ ${key}`);
    }
  }
  if (toggleDoors.checked) {
    for (const door of map.doors) {
      markCell(door.x, door.y, zoom, '#c47bff', `→ ${door.to}`);
    }
  }
  if (toggleNpcs.checked) {
    for (const npc of map.npcs) {
      markCell(npc.x, npc.y, zoom, '#ffe066', npc.name);
    }
  }

  if (state.editMode && state.tool === 'stamp' && state.selectedStamp !== null) {
    const s = (map.stamps ?? [])[state.selectedStamp];
    if (s) {
      const [, , sw, sh] = s.src;
      mctx.strokeStyle = '#ffe066';
      mctx.lineWidth = 3;
      mctx.strokeRect(s.x * TILE * zoom + 1, s.y * TILE * zoom + 1, sw * TILE * zoom - 2, sh * TILE * zoom - 2);
    }
  }
  if (state.editMode && state.pendingPlacement) {
    const p = state.pendingPlacement;
    markCell(p.x, p.y, zoom, '#ff5c5c', '+ new');
  }

  if (state.mapHover) {
    mctx.strokeStyle = '#ff5c5c';
    mctx.lineWidth = 2;
    mctx.strokeRect(
      state.mapHover.x * TILE * zoom + 1,
      state.mapHover.y * TILE * zoom + 1,
      TILE * zoom - 2,
      TILE * zoom - 2
    );
  }

  mapTitle.textContent = `${state.mapId} — ${map.name} (${cols}×${rows}, tileset: ${map.tileset})`;
}

// ---- side tables ----
function renderLegendTable(): void {
  const map = currentMap();
  const legend = effectiveLegend(map);
  const ts = tilesets[map.tileset];
  const collideChars = new Set(COLLIDE_CHARS[map.tileset] ?? []);
  legendBody.innerHTML = '';
  for (const [ch, index] of Object.entries(legend)) {
    const { col, row } = indexToColRow(index, ts.cols);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(ch)}</td><td>${index}</td><td>${col},${row}</td><td>${
      collideChars.has(ch) ? '✓' : ''
    }</td>`;
    tr.addEventListener('mouseenter', () => setCrossHighlight(map.tileset, col, row));
    tr.addEventListener('mouseleave', clearCrossHighlight);
    legendBody.appendChild(tr);
  }
}

function renderStampsTable(): void {
  const map = currentMap();
  stampsBody.innerHTML = '';
  (map.stamps ?? []).forEach((stamp, i) => {
    const [col, row, w, h] = stamp.src;
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${i}</td><td>${stamp.x},${stamp.y}</td><td>${col},${row},${w},${h}</td><td>${
        stamp.collide ? '✓' : ''
      }</td>` + (state.editMode ? `<td><button type="button" class="del-btn" title="delete">×</button></td>` : '<td></td>');
    tr.addEventListener('mouseenter', () => setCrossHighlight(map.tileset, col, row));
    tr.addEventListener('mouseleave', clearCrossHighlight);
    if (state.editMode) {
      tr.addEventListener('click', () => {
        state.selectedStamp = i;
        renderMap();
      });
      tr.querySelector('.del-btn')!.addEventListener('click', (ev) => {
        ev.stopPropagation();
        snapshotForUndo();
        map.stamps!.splice(i, 1);
        if (state.selectedStamp === i) state.selectedStamp = null;
        markDirty();
        renderMap();
        renderStampsTable();
      });
    }
    stampsBody.appendChild(tr);
  });
}

function renderNpcsTable(): void {
  const map = currentMap();
  npcsBody.innerHTML = '';
  map.npcs.forEach((npc, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escapeHtml(npc.id)}</td><td>${npc.x},${npc.y}</td><td>${escapeHtml(npc.dialogue ?? '')}</td><td>${escapeHtml(
        npc.minigame ?? ''
      )}</td>` + (state.editMode ? `<td><button type="button" class="del-btn" title="delete">×</button></td>` : '<td></td>');
    if (state.editMode) {
      tr.querySelector('.del-btn')!.addEventListener('click', () => {
        snapshotForUndo();
        map.npcs.splice(i, 1);
        markDirty();
        renderMap();
        renderNpcsTable();
      });
    }
    npcsBody.appendChild(tr);
  });
}

function renderDoorsTable(): void {
  const map = currentMap();
  doorsBody.innerHTML = '';
  map.doors.forEach((door, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${door.x},${door.y}</td><td>${escapeHtml(door.to)}</td><td>${escapeHtml(door.spawn)}</td>` +
      (state.editMode ? `<td><button type="button" class="del-btn" title="delete">×</button></td>` : '<td></td>');
    if (state.editMode) {
      tr.querySelector('.del-btn')!.addEventListener('click', () => {
        snapshotForUndo();
        map.doors.splice(i, 1);
        markDirty();
        renderMap();
        renderDoorsTable();
      });
    }
    doorsBody.appendChild(tr);
  });
}

function renderSpawnsTable(): void {
  const map = currentMap();
  spawnsBody.innerHTML = '';
  Object.entries(map.spawns).forEach(([key, [x, y]]) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${escapeHtml(key)}</td><td>${x},${y}</td>` +
      (state.editMode ? `<td><button type="button" class="del-btn" title="delete">×</button></td>` : '<td></td>');
    if (state.editMode) {
      tr.querySelector('.del-btn')!.addEventListener('click', () => {
        snapshotForUndo();
        delete map.spawns[key];
        markDirty();
        renderMap();
        renderSpawnsTable();
      });
    }
    spawnsBody.appendChild(tr);
  });
}

function setCrossHighlight(tilesetId: TilesetId, col: number, row: number): void {
  state.crossHighlight = { tilesetId, col, row };
  if (state.tilesetId !== tilesetId && !tilesetSelect.disabled) {
    state.tilesetId = tilesetId;
    tilesetSelect.value = tilesetId;
  }
  renderTileset();
}

function clearCrossHighlight(): void {
  state.crossHighlight = null;
  renderTileset();
}

// ---- info panel ----
function copyText(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function updateTilesetInfo(col: number, row: number): void {
  const ts = tilesets[state.tilesetId];
  const index = row * ts.cols + col;
  infoPanel.innerHTML = `
    <div class="info-row"><b>tileset</b> ${state.tilesetId}</div>
    <div class="info-row"><b>col,row</b> ${col},${row}</div>
    <div class="info-row"><b>index</b> ${index}</div>
    <code>ow(${col}, ${row}) // = ${index}</code>
    <button id="copy-btn" type="button">Copy index</button>
  `;
  el<HTMLButtonElement>('copy-btn').addEventListener('click', () => copyText(String(index)));
}

function updateMapCellInfo(x: number, y: number): void {
  const map = currentMap();
  const ch = map.grid[y]?.[x];
  if (ch === undefined) return;
  const legend = effectiveLegend(map);
  const index = legend[ch] ?? 0;
  const ts = tilesets[map.tileset];
  const { col, row } = indexToColRow(index, ts.cols);

  const npc = map.npcs.find((n) => n.x === x && n.y === y);
  const door = map.doors.find((d) => d.x === x && d.y === y);

  let extra = '';
  if (npc) {
    extra += `<div class="info-row"><b>NPC</b> ${escapeHtml(npc.name)} (${npc.id})${
      npc.dialogue ? ` · dialogue: ${npc.dialogue}` : ''
    }${npc.minigame ? ` · minigame: ${npc.minigame}` : ''}</div>`;
  }
  if (door) {
    extra += `<div class="info-row"><b>door</b> → ${door.to} (spawn: ${door.spawn})</div>`;
  }
  const mismatch =
    state.tilesetId !== map.tileset
      ? `<div class="info-row hint">tileset panel is showing a different sheet — switch to "${map.tileset}" to see it highlighted</div>`
      : '';

  infoPanel.innerHTML = `
    <div class="info-row"><b>map cell</b> ${x},${y}</div>
    <div class="info-row"><b>char</b> '${escapeHtml(ch)}'</div>
    <div class="info-row"><b>resolves to</b> index ${index} → tileset (${col},${row})</div>
    ${extra}
    ${mismatch}
  `;
}

// ---- geometry helpers for pointer events ----
function tilesetCellFromEvent(e: MouseEvent): { col: number; row: number } | null {
  const zoom = Number(tilesetZoomInput.value);
  const rect = tilesetCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (tilesetCanvas.width / rect.width);
  const my = (e.clientY - rect.top) * (tilesetCanvas.height / rect.height);
  const col = Math.floor(mx / (TILE * zoom));
  const row = Math.floor(my / (TILE * zoom));
  const ts = tilesets[state.tilesetId];
  if (col < 0 || row < 0 || col >= ts.cols || row >= ts.rows) return null;
  return { col, row };
}

function mapCellFromEvent(e: MouseEvent): { x: number; y: number } | null {
  const zoom = Number(mapZoomInput.value);
  const rect = mapCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (mapCanvas.width / rect.width);
  const my = (e.clientY - rect.top) * (mapCanvas.height / rect.height);
  const x = Math.floor(mx / (TILE * zoom));
  const y = Math.floor(my / (TILE * zoom));
  const map = currentMap();
  if (x < 0 || y < 0 || y >= map.grid.length || x >= (map.grid[0]?.length ?? 0)) return null;
  return { x, y };
}

// ---- events: view controls ----
tilesetSelect.addEventListener('change', () => {
  state.tilesetId = tilesetSelect.value as TilesetId;
  state.tilesetHover = null;
  state.tilesetPin = null;
  renderTileset();
});
tilesetZoomInput.addEventListener('input', renderTileset);

mapSelect.addEventListener('change', () => {
  state.mapId = mapSelect.value;
  const map = currentMap();
  state.tilesetId = map.tileset;
  tilesetSelect.value = map.tileset;
  state.mapHover = null;
  state.crossHighlight = null;
  state.pendingPlacement = null;
  state.stampDraft = null;
  state.brush = null;
  state.selectedStamp = null;
  drag = null;
  updatePendingLabel();
  updateStampDraftLabel();
  updateBrushLabel();
  updateUndoButton();
  updateSaveButton();
  syncEditTileset();
  renderAll();
});
mapZoomInput.addEventListener('input', renderMap);
[toggleGrid, toggleCollide, toggleStamps, toggleNpcs, toggleDoors, toggleSpawns].forEach((t) =>
  t.addEventListener('change', renderMap)
);

// ---- events: tileset panel (hover/pin + paint brush pick + stamp rect-select) ----
tilesetCanvas.addEventListener('mousemove', (e) => {
  const cell = tilesetCellFromEvent(e);
  if (!cell) return;
  state.tilesetHover = cell;
  updateTilesetInfo(cell.col, cell.row);
  if (state.editMode && state.tool === 'stamp' && stampRectStart && e.buttons & 1) {
    stampRectEnd = cell;
  }
  renderTileset();
});
tilesetCanvas.addEventListener('mouseleave', () => {
  state.tilesetHover = null;
  renderTileset();
});
tilesetCanvas.addEventListener('mousedown', (e) => {
  if (state.editMode && state.tool === 'stamp') {
    const cell = tilesetCellFromEvent(e);
    if (cell) {
      stampRectStart = cell;
      stampRectEnd = cell;
      renderTileset();
    }
  }
});
tilesetCanvas.addEventListener('click', () => {
  if (state.editMode && state.tool === 'paint' && state.tilesetHover) {
    const { col, row } = state.tilesetHover;
    const ts = tilesets[state.tilesetId];
    const index = row * ts.cols + col;
    const map = currentMap();
    const legend = effectiveLegend(map);
    const existing = Object.entries(legend).find(([, idx]) => idx === index);
    state.brush = existing
      ? { char: existing[0], index, isNew: false }
      : { char: pickCharForIndex(map, index), index, isNew: true };
    updateBrushLabel();
    renderTileset();
    return;
  }
  if (state.editMode && state.tool === 'stamp') return; // handled via mousedown/mouseup drag
  state.tilesetPin = state.tilesetHover;
  renderTileset();
});

// ---- events: map panel (hover/info + paint/stamp/npc/door/spawn tools) ----
mapCanvas.addEventListener('mousemove', (e) => {
  const cell = mapCellFromEvent(e);
  if (cell) {
    state.mapHover = cell;
    updateMapCellInfo(cell.x, cell.y);

    const map = currentMap();
    const legend = effectiveLegend(map);
    const index = legend[map.grid[cell.y][cell.x]] ?? 0;
    const ts = tilesets[map.tileset];
    const { col, row } = indexToColRow(index, ts.cols);
    state.crossHighlight = { tilesetId: map.tileset, col, row };

    if (drag && e.buttons & 1) {
      applyDragMove(map, cell);
    }
    renderMap();
    renderTileset();
  }
});
mapCanvas.addEventListener('mouseleave', () => {
  state.mapHover = null;
  state.crossHighlight = null;
  renderMap();
  renderTileset();
});
mapCanvas.addEventListener('mousedown', (e) => {
  if (!state.editMode) return;
  const cell = mapCellFromEvent(e);
  if (!cell) return;
  const map = currentMap();

  if (state.tool === 'paint') {
    if (!state.brush) return;
    snapshotForUndo();
    drag = { kind: 'paint', lastCell: cell };
    applyBrush(map, cell.x, cell.y);
    renderMap();
    return;
  }

  if (state.tool === 'stamp') {
    const idx = stampAt(map, cell.x, cell.y);
    if (idx >= 0) {
      snapshotForUndo();
      const s = map.stamps![idx];
      drag = { kind: 'stamp', index: idx, offsetX: cell.x - s.x, offsetY: cell.y - s.y };
      state.selectedStamp = idx;
      renderMap();
      renderStampsTable();
      return;
    }
    if (state.stampDraft) {
      snapshotForUndo();
      const [sc, sr, w, h] = state.stampDraft.src;
      const cols = map.grid[0]?.length ?? w;
      const rows = map.grid.length;
      const x = clamp(cell.x, 0, Math.max(0, cols - w));
      const y = clamp(cell.y, 0, Math.max(0, rows - h));
      map.stamps = map.stamps ?? [];
      map.stamps.push({ x, y, src: [sc, sr, w, h], collide: stampCollideInput.checked });
      state.selectedStamp = map.stamps.length - 1;
      markDirty();
      renderMap();
      renderStampsTable();
    }
    return;
  }

  if (state.tool === 'npc') {
    const idx = npcAt(map, cell.x, cell.y);
    if (idx >= 0) {
      snapshotForUndo();
      drag = { kind: 'npc', index: idx };
      return;
    }
  } else if (state.tool === 'door') {
    const idx = doorAt(map, cell.x, cell.y);
    if (idx >= 0) {
      snapshotForUndo();
      drag = { kind: 'door', index: idx };
      return;
    }
  } else if (state.tool === 'spawn') {
    const key = spawnKeyAt(map, cell.x, cell.y);
    if (key) {
      snapshotForUndo();
      drag = { kind: 'spawn', key };
      return;
    }
  }
  state.pendingPlacement = { type: state.tool as 'npc' | 'door' | 'spawn', x: cell.x, y: cell.y };
  updatePendingLabel();
  renderMap();
});

function applyDragMove(map: MapDef, cell: { x: number; y: number }): void {
  if (!drag) return;
  if (drag.kind === 'paint') {
    if (!drag.lastCell || drag.lastCell.x !== cell.x || drag.lastCell.y !== cell.y) {
      applyBrush(map, cell.x, cell.y);
      drag.lastCell = cell;
    }
  } else if (drag.kind === 'stamp' && drag.index !== undefined) {
    const s = map.stamps![drag.index];
    const [, , w, h] = s.src;
    const cols = map.grid[0]?.length ?? w;
    const rows = map.grid.length;
    s.x = clamp(cell.x - (drag.offsetX ?? 0), 0, Math.max(0, cols - w));
    s.y = clamp(cell.y - (drag.offsetY ?? 0), 0, Math.max(0, rows - h));
    renderStampsTable();
  } else if (drag.kind === 'npc' && drag.index !== undefined) {
    map.npcs[drag.index].x = cell.x;
    map.npcs[drag.index].y = cell.y;
    renderNpcsTable();
  } else if (drag.kind === 'door' && drag.index !== undefined) {
    map.doors[drag.index].x = cell.x;
    map.doors[drag.index].y = cell.y;
    renderDoorsTable();
  } else if (drag.kind === 'spawn' && drag.key) {
    map.spawns[drag.key] = [cell.x, cell.y];
    renderSpawnsTable();
  }
}

window.addEventListener('mouseup', () => {
  if (stampRectStart && stampRectEnd) {
    const col = Math.min(stampRectStart.col, stampRectEnd.col);
    const row = Math.min(stampRectStart.row, stampRectEnd.row);
    const w = Math.abs(stampRectEnd.col - stampRectStart.col) + 1;
    const h = Math.abs(stampRectEnd.row - stampRectStart.row) + 1;
    state.stampDraft = { src: [col, row, w, h] };
    updateStampDraftLabel();
  }
  stampRectStart = null;
  stampRectEnd = null;
  renderTileset();

  if (drag) {
    markDirty();
    drag = null;
    renderMap();
  }
});

// ---- events: editor mode / tool switching ----
editToggle.addEventListener('change', () => {
  state.editMode = editToggle.checked;
  editorControls.hidden = !state.editMode;
  syncEditTileset();
  renderAll();
});

toolRadios.forEach((r) =>
  r.addEventListener('change', () => {
    if (!r.checked) return;
    state.tool = r.value as Tool;
    state.pendingPlacement = null;
    state.stampDraft = null;
    updatePendingLabel();
    updateStampDraftLabel();
    syncEditTileset();
    (Object.keys(TOOL_PANELS) as Tool[]).forEach((t) => {
      TOOL_PANELS[t].hidden = t !== state.tool;
    });
    renderMap();
    renderTileset();
  })
);

doorToSelect.addEventListener('change', () => {
  const to = doorToSelect.value;
  const keys = to && MAPS[to] ? Object.keys(MAPS[to].spawns) : [];
  doorSpawnKeysDatalist.innerHTML = keys.map((k) => `<option value="${escapeHtml(k)}"></option>`).join('');
});

// ---- events: add-entity forms ----
npcAddBtn.addEventListener('click', () => {
  const p = state.pendingPlacement;
  if (!p || p.type !== 'npc') return;
  const id = npcIdInput.value.trim();
  const name = npcNameInput.value.trim();
  const sprite = npcSpriteInput.value.trim();
  if (!id || !name || !sprite) {
    alert('id, name and sprite are required');
    return;
  }
  const map = currentMap();
  snapshotForUndo();
  const npc: NpcDef = { id, name, sprite, x: p.x, y: p.y };
  const dialogue = npcDialogueInput.value.trim();
  const minigame = npcMinigameInput.value.trim();
  if (dialogue) npc.dialogue = dialogue;
  if (minigame) npc.minigame = minigame;
  if (npcRequiredInput.checked) npc.required = true;
  map.npcs.push(npc);
  markDirty();
  state.pendingPlacement = null;
  updatePendingLabel();
  renderMap();
  renderNpcsTable();
});

doorAddBtn.addEventListener('click', () => {
  const p = state.pendingPlacement;
  if (!p || p.type !== 'door') return;
  const to = doorToSelect.value;
  const spawn = doorSpawnInput.value.trim();
  if (!to || !spawn) {
    alert('to and spawn are required');
    return;
  }
  const map = currentMap();
  snapshotForUndo();
  map.doors.push({ x: p.x, y: p.y, to, spawn });
  markDirty();
  state.pendingPlacement = null;
  updatePendingLabel();
  renderMap();
  renderDoorsTable();
});

spawnAddBtn.addEventListener('click', () => {
  const p = state.pendingPlacement;
  if (!p || p.type !== 'spawn') return;
  const key = spawnKeyInput.value.trim();
  if (!key) {
    alert('key is required');
    return;
  }
  const map = currentMap();
  snapshotForUndo();
  map.spawns[key] = [p.x, p.y];
  markDirty();
  state.pendingPlacement = null;
  updatePendingLabel();
  renderMap();
  renderSpawnsTable();
});

// ---- events: undo / save / copy ----
undoBtn.addEventListener('click', undo);
saveBtn.addEventListener('click', doSave);
copyJsonBtn.addEventListener('click', doCopyJson);

window.addEventListener('beforeunload', (e) => {
  if (state.dirtyMaps.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---- boot ----
function renderAll(): void {
  renderTileset();
  renderMap();
  renderLegendTable();
  renderStampsTable();
  renderNpcsTable();
  renderDoorsTable();
  renderSpawnsTable();
}

loadTilesets().then(() => {
  state.tilesetId = currentMap().tileset;
  tilesetSelect.value = state.tilesetId;
  renderAll();
});
