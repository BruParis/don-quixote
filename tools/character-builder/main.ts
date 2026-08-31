import { CHARACTER_PALETTES } from '../../src/data';
import { CHAR_SHEET, SOURCE_PALETTE, recolorSheet } from '../../src/core/characters';
import type { CharacterPalette } from '../../src/types';

type Direction = 'down' | 'left' | 'up' | 'right';
// Sheet row order: row 1 sprite faces right, row 3 faces left (see src/core/characters.ts).
const DIRS: Direction[] = ['down', 'right', 'up', 'left'];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- DOM ----
function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const sourceZoomInput = el<HTMLInputElement>('source-zoom');
const sourceCanvas = el<HTMLCanvasElement>('source-canvas');

const charsBody = document.querySelector<HTMLTableSectionElement>('#chars-table tbody')!;
const newCharIdInput = el<HTMLInputElement>('new-char-id');
const newCharAddBtn = el<HTMLButtonElement>('new-char-add-btn');
const newCharError = el<HTMLParagraphElement>('new-char-error');

const paletteSelectedLabel = el<HTMLSpanElement>('palette-selected-label');
const paletteEditor = el<HTMLDivElement>('palette-editor');
const paletteEmptyHint = el<HTMLParagraphElement>('palette-empty-hint');
const shirtInputs = [el<HTMLInputElement>('shirt-0'), el<HTMLInputElement>('shirt-1'), el<HTMLInputElement>('shirt-2')];
const pantsToggle = el<HTMLInputElement>('pants-toggle');
const pantsInput = el<HTMLInputElement>('pants-0');
const hairToggle = el<HTMLInputElement>('hair-toggle');
const hairInputs = [el<HTMLInputElement>('hair-0'), el<HTMLInputElement>('hair-1')];

const previewZoomInput = el<HTMLInputElement>('preview-zoom');
const directionRadios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="direction"]'));
const animateToggle = el<HTMLInputElement>('animate-toggle');

const undoBtn = el<HTMLButtonElement>('undo-btn');
const saveBtn = el<HTMLButtonElement>('save-btn');
const copyJsonBtn = el<HTMLButtonElement>('copy-json-btn');
const saveStatus = el<HTMLParagraphElement>('save-status');

const gridTitle = el<HTMLSpanElement>('grid-title');
const gridCanvas = el<HTMLCanvasElement>('grid-canvas');
const walkTitle = el<HTMLSpanElement>('walk-title');
const walkCanvas = el<HTMLCanvasElement>('walk-canvas');

const sctx = sourceCanvas.getContext('2d')!;
const gctx = gridCanvas.getContext('2d')!;
const wctx = walkCanvas.getContext('2d')!;

// ---- state ----
const state = {
  selectedId: null as string | null,
  direction: 'down' as Direction,
  animate: true,
  animFrame: 0,
  dirty: false
};

let baseImg: HTMLImageElement;
let currentRecolored: HTMLCanvasElement | null = null;
const undoStack: Record<string, CharacterPalette>[] = [];

// A color-picker gesture (drag inside the OS color dialog) fires many 'input'
// events; we only want one undo snapshot per gesture, taken before the first change.
let editSnapshotTaken = false;
function ensureEditSnapshot(): void {
  if (!editSnapshotTaken) {
    snapshotForUndo();
    editSnapshotTaken = true;
  }
}
function endEditGesture(): void {
  editSnapshotTaken = false;
}

const ID_RE = /^[a-z][a-z0-9_]*$/;

// ---- mutation helpers ----
function snapshotForUndo(): void {
  undoStack.push(JSON.parse(JSON.stringify(CHARACTER_PALETTES)));
  if (undoStack.length > 30) undoStack.shift();
  updateUndoButton();
}

function replaceAll(next: Record<string, CharacterPalette>): void {
  for (const k of Object.keys(CHARACTER_PALETTES)) delete CHARACTER_PALETTES[k];
  Object.assign(CHARACTER_PALETTES, next);
}

function markDirty(): void {
  state.dirty = true;
  saveBtn.disabled = false;
}

function undo(): void {
  const snap = undoStack.pop();
  if (!snap) return;
  replaceAll(snap);
  if (state.selectedId && !(state.selectedId in CHARACTER_PALETTES)) {
    state.selectedId = Object.keys(CHARACTER_PALETTES)[0] ?? null;
  }
  markDirty();
  updateUndoButton();
  renderCharsTable();
  syncPaletteInputs();
  renderAllPreviews();
}

function selectCharacter(id: string): void {
  state.selectedId = id;
  syncPaletteInputs();
  renderCharsTable();
  renderAllPreviews();
}

function deleteCharacter(id: string): void {
  snapshotForUndo();
  delete CHARACTER_PALETTES[id];
  if (state.selectedId === id) {
    state.selectedId = Object.keys(CHARACTER_PALETTES)[0] ?? null;
  }
  markDirty();
  renderCharsTable();
  syncPaletteInputs();
  renderAllPreviews();
}

// ---- serialization (matches the hand-formatted style of src/data/characters.json) ----
function fmtPalette(p: CharacterPalette): string {
  const parts = [`"shirt": [${p.shirt.map((c) => JSON.stringify(c)).join(', ')}]`];
  if (p.pants) parts.push(`"pants": [${JSON.stringify(p.pants[0])}]`);
  if (p.hair) parts.push(`"hair": [${p.hair.map((c) => JSON.stringify(c)).join(', ')}]`);
  return `{ ${parts.join(', ')} }`;
}

function serializeCharacters(data: Record<string, CharacterPalette>): string {
  const lines = Object.entries(data).map(([id, p]) => `  ${JSON.stringify(id)}: ${fmtPalette(p)}`);
  return '{\n' + lines.join(',\n') + '\n}\n';
}

async function doSave(): Promise<void> {
  const json = serializeCharacters(CHARACTER_PALETTES);
  saveStatus.textContent = 'saving…';
  try {
    const res = await fetch('/__character-builder/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json })
    });
    if (!res.ok) throw new Error(await res.text());
    state.dirty = false;
    saveBtn.disabled = true;
    saveStatus.textContent = `saved ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    saveStatus.textContent = `save failed — ${String(err)}`;
  }
}

function doCopyJson(): void {
  const json = serializeCharacters(CHARACTER_PALETTES);
  navigator.clipboard
    ?.writeText(json)
    .then(() => {
      saveStatus.textContent = 'copied JSON to clipboard';
    })
    .catch(() => {});
}

// ---- UI sync ----
function updateUndoButton(): void {
  undoBtn.disabled = undoStack.length === 0;
}

function swatchHtml(p: CharacterPalette): string {
  return `<div class="swatch-preview">${p.shirt.map((c) => `<span style="background:${c}"></span>`).join('')}</div>`;
}

function renderCharsTable(): void {
  charsBody.innerHTML = '';
  for (const id of Object.keys(CHARACTER_PALETTES)) {
    const p = CHARACTER_PALETTES[id];
    const tr = document.createElement('tr');
    if (id === state.selectedId) tr.classList.add('selected');
    tr.innerHTML =
      `<td>${swatchHtml(p)}</td><td>${escapeHtml(id)}</td>` +
      `<td><button type="button" class="del-btn" title="delete">×</button></td>`;
    tr.addEventListener('click', () => selectCharacter(id));
    tr.querySelector('.del-btn')!.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteCharacter(id);
    });
    charsBody.appendChild(tr);
  }
}

function syncPaletteInputs(): void {
  const id = state.selectedId;
  paletteSelectedLabel.textContent = id ?? 'none selected';
  if (!id) {
    paletteEditor.hidden = true;
    paletteEmptyHint.hidden = false;
    return;
  }
  paletteEditor.hidden = false;
  paletteEmptyHint.hidden = true;

  const p = CHARACTER_PALETTES[id];
  shirtInputs.forEach((inp, i) => (inp.value = p.shirt[i]));

  pantsToggle.checked = !!p.pants;
  pantsInput.disabled = !p.pants;
  pantsInput.value = p.pants ? p.pants[0] : SOURCE_PALETTE.pants[0];

  hairToggle.checked = !!p.hair;
  hairInputs[0].disabled = !p.hair;
  hairInputs[1].disabled = !p.hair;
  hairInputs[0].value = p.hair ? p.hair[0] : SOURCE_PALETTE.hair[0];
  hairInputs[1].value = p.hair ? p.hair[1] : SOURCE_PALETTE.hair[1];
}

// ---- rendering ----
function renderSource(): void {
  const zoom = Number(sourceZoomInput.value);
  const w = baseImg.naturalWidth * zoom;
  const h = baseImg.naturalHeight * zoom;
  sourceCanvas.width = w;
  sourceCanvas.height = h;
  sctx.imageSmoothingEnabled = false;
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(baseImg, 0, 0, w, h);

  sctx.strokeStyle = '#4fc3ff';
  sctx.lineWidth = 2;
  sctx.strokeRect(1, 1, CHAR_SHEET.FRAME_W * 4 * zoom - 2, CHAR_SHEET.FRAME_H * 4 * zoom - 2);
}

function recomputeRecolor(): void {
  currentRecolored = state.selectedId ? recolorSheet(baseImg, CHARACTER_PALETTES[state.selectedId]) : null;
}

function renderGrid(): void {
  gridTitle.textContent = state.selectedId ?? 'none selected';
  const zoom = Number(previewZoomInput.value);
  const cols = 4;
  const rows = 4;
  const w = CHAR_SHEET.FRAME_W * cols * zoom;
  const h = CHAR_SHEET.FRAME_H * rows * zoom;
  gridCanvas.width = w;
  gridCanvas.height = h;
  gctx.imageSmoothingEnabled = false;
  gctx.clearRect(0, 0, w, h);
  if (!currentRecolored) return;

  gctx.drawImage(
    currentRecolored,
    0, 0, CHAR_SHEET.FRAME_W * cols, CHAR_SHEET.FRAME_H * rows,
    0, 0, w, h
  );

  gctx.strokeStyle = 'rgba(255,255,255,0.15)';
  gctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) {
    gctx.beginPath();
    gctx.moveTo(c * CHAR_SHEET.FRAME_W * zoom + 0.5, 0);
    gctx.lineTo(c * CHAR_SHEET.FRAME_W * zoom + 0.5, h);
    gctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    gctx.beginPath();
    gctx.moveTo(0, r * CHAR_SHEET.FRAME_H * zoom + 0.5);
    gctx.lineTo(w, r * CHAR_SHEET.FRAME_H * zoom + 0.5);
    gctx.stroke();
  }

  gctx.font = '10px monospace';
  DIRS.forEach((dir, r) => {
    gctx.fillStyle = dir === state.direction ? '#ffe066' : 'rgba(245,233,208,0.6)';
    gctx.fillText(dir, 4, r * CHAR_SHEET.FRAME_H * zoom + 12);
  });

  const row = DIRS.indexOf(state.direction);
  gctx.strokeStyle = '#ffe066';
  gctx.lineWidth = 2;
  gctx.strokeRect(1, row * CHAR_SHEET.FRAME_H * zoom + 1, w - 2, CHAR_SHEET.FRAME_H * zoom - 2);
}

function renderWalk(): void {
  walkTitle.textContent = state.selectedId ? `${state.selectedId} — ${state.direction}` : 'none selected';
  const zoom = Number(previewZoomInput.value) * 2;
  const w = CHAR_SHEET.FRAME_W * zoom;
  const h = CHAR_SHEET.FRAME_H * zoom;
  walkCanvas.width = w;
  walkCanvas.height = h;
  wctx.imageSmoothingEnabled = false;
  wctx.clearRect(0, 0, w, h);
  if (!currentRecolored) return;

  const row = DIRS.indexOf(state.direction);
  const col = state.animate ? state.animFrame % 4 : 0;
  wctx.drawImage(
    currentRecolored,
    col * CHAR_SHEET.FRAME_W, row * CHAR_SHEET.FRAME_H, CHAR_SHEET.FRAME_W, CHAR_SHEET.FRAME_H,
    0, 0, w, h
  );
}

function renderAllPreviews(): void {
  recomputeRecolor();
  renderGrid();
  renderWalk();
}

// walk cycle animates at the same 8fps as buildCharacterTextures' frameRate.
window.setInterval(() => {
  if (!state.animate || !state.selectedId) return;
  state.animFrame = (state.animFrame + 1) % 4;
  renderWalk();
}, 125);

// ---- events ----
sourceZoomInput.addEventListener('input', renderSource);
previewZoomInput.addEventListener('input', () => {
  renderGrid();
  renderWalk();
});

directionRadios.forEach((r) =>
  r.addEventListener('change', () => {
    if (!r.checked) return;
    state.direction = r.value as Direction;
    state.animFrame = 0;
    renderGrid();
    renderWalk();
  })
);

animateToggle.addEventListener('change', () => {
  state.animate = animateToggle.checked;
  state.animFrame = 0;
  renderWalk();
});

newCharAddBtn.addEventListener('click', () => {
  const id = newCharIdInput.value.trim();
  newCharError.textContent = '';
  if (!ID_RE.test(id)) {
    newCharError.textContent = 'id must be lowercase letters/digits/underscore, starting with a letter';
    return;
  }
  if (CHARACTER_PALETTES[id]) {
    newCharError.textContent = `"${id}" already exists`;
    return;
  }
  snapshotForUndo();
  CHARACTER_PALETTES[id] = { shirt: [...SOURCE_PALETTE.shirt] as [string, string, string] };
  markDirty();
  newCharIdInput.value = '';
  selectCharacter(id);
});

shirtInputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    if (!state.selectedId) return;
    ensureEditSnapshot();
    CHARACTER_PALETTES[state.selectedId].shirt[i] = inp.value;
    markDirty();
    renderCharsTable();
    renderAllPreviews();
  });
  inp.addEventListener('change', endEditGesture);
});

pantsToggle.addEventListener('change', () => {
  if (!state.selectedId) return;
  snapshotForUndo();
  const p = CHARACTER_PALETTES[state.selectedId];
  if (pantsToggle.checked) {
    p.pants = [pantsInput.value || SOURCE_PALETTE.pants[0]];
  } else {
    delete p.pants;
  }
  markDirty();
  syncPaletteInputs();
  renderAllPreviews();
});
pantsInput.addEventListener('input', () => {
  if (!state.selectedId || !pantsToggle.checked) return;
  ensureEditSnapshot();
  CHARACTER_PALETTES[state.selectedId].pants = [pantsInput.value];
  markDirty();
  renderAllPreviews();
});
pantsInput.addEventListener('change', endEditGesture);

hairToggle.addEventListener('change', () => {
  if (!state.selectedId) return;
  snapshotForUndo();
  const p = CHARACTER_PALETTES[state.selectedId];
  if (hairToggle.checked) {
    p.hair = [hairInputs[0].value || SOURCE_PALETTE.hair[0], hairInputs[1].value || SOURCE_PALETTE.hair[1]];
  } else {
    delete p.hair;
  }
  markDirty();
  syncPaletteInputs();
  renderAllPreviews();
});
hairInputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    if (!state.selectedId || !hairToggle.checked) return;
    ensureEditSnapshot();
    CHARACTER_PALETTES[state.selectedId].hair![i] = inp.value;
    markDirty();
    renderAllPreviews();
  });
  inp.addEventListener('change', endEditGesture);
});

undoBtn.addEventListener('click', undo);
saveBtn.addEventListener('click', doSave);
copyJsonBtn.addEventListener('click', doCopyJson);

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---- boot ----
loadImage('/assets/character.png').then((img) => {
  baseImg = img;
  state.selectedId = Object.keys(CHARACTER_PALETTES)[0] ?? null;
  renderCharsTable();
  syncPaletteInputs();
  renderSource();
  renderAllPreviews();
});
