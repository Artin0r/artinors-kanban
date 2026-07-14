import {
  ARCHIVE_COLUMN_ID,
  createCard,
  createColumn,
  type Board,
  type Card,
  type Column,
} from "./board";
import { getNextRecurDate } from "./actions";

export interface BoardStore {
  get board(): Board;
  search: string;
  activeTags: string[];
  allTags: string[];
  matches: (card: Card) => boolean;
  setBoard(board: Board): void;
  addCard(columnId: string, card?: Partial<Card>): Card;
  updateCard(card: Card): void;
  deleteCard(cardId: string): void;
  moveCard(cardId: string, toColumnId: string, toIndex: number): void;
  archiveCard(cardId: string): void;
  addColumn(name: string): Column;
  renameColumn(columnId: string, name: string): void;
  setColumnColor(columnId: string, color: string): void;
  setColumnWip(columnId: string, wip: number): void;
  setColumnSort(columnId: string, sort: "manual" | "due" | "alpha"): void;
  toggleCollapse(columnId: string): void;
  moveColumn(columnId: string, toIndex: number): void;
  deleteColumn(columnId: string): void;
  toggleArchiveVisibility(): void;
  toggleTag(tag: string): void;
  clearFilters(): void;
  setBoardName(name: string): void;
  pauseSave(): void;
  resumeSave(): void;
  getArchiveColumn(create?: boolean): Column | undefined;
  flush(): Promise<void>;
}

interface AutoMoveConfig {
  enabled: boolean;
  targetColumnName: string;
}

export function createBoardStore(
  initial: Board,
  onSave: (board: Board) => void | Promise<void>,
  onFiltersChange?: (search: string, activeTags: string[]) => void,
  initSearch: string = "",
  initActiveTags: string[] = [],
  autoMoveConfig: AutoMoveConfig | (() => AutoMoveConfig) = { enabled: false, targetColumnName: "Done" }
): BoardStore {
  let board = $state<Board>(initial);
  let _search = $state(initSearch);
  let _activeTags = $state<string[]>(initActiveTags);
  let saveTimer: ReturnType<typeof window.setTimeout> | null = null;
  let dirty = false;
  let paused = false;

  const getAutoMoveConfig = typeof autoMoveConfig === "function" ? autoMoveConfig : () => autoMoveConfig;

  const notifyFilters = () => {
    if (onFiltersChange) onFiltersChange(_search, _activeTags);
  };

  const allTagsSet = $derived.by(() => {
    const set = new Set<string>();
    for (const col of board.columns) {
      for (const card of col.cards) {
        for (const t of card.tags) set.add(t);
      }
    }
    return set;
  });

  function scheduleSave() {
    dirty = true;
    if (paused) return;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushSave, 300);
  }

  async function flushSave() {
    if (!dirty) return;
    dirty = false;
    const snap = JSON.parse(JSON.stringify(board)) as Board;
    const r = onSave(snap);
    if (r && typeof r.then === "function") await r;
  }

  async function flush() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    await flushSave();
  }

  
  function pauseSave() {
    paused = true;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  
  function resumeSave() {
    paused = false;
    if (dirty) scheduleSave();
  }

  function findColumn(id: string): Column | undefined {
    return board.columns.find((c) => c.id === id);
  }

  function findCard(cardId: string): { column: Column; card: Card; index: number } | undefined {
    for (const column of board.columns) {
      const index = column.cards.findIndex((c) => c.id === cardId);
      if (index >= 0) return { column, card: column.cards[index], index };
    }
    return undefined;
  }

  function getArchiveColumn(create = false): Column | undefined {
    let arch = board.columns.find((c) => c.id === ARCHIVE_COLUMN_ID);
    if (!arch && create) {
      arch = createColumn("Archive", "#8a8a8a", 0);
      arch.id = ARCHIVE_COLUMN_ID;
      arch.collapsed = true;
      board.columns.push(arch);
      scheduleSave();
    }
    return arch;
  }

  function matches(card: Card): boolean {
    const term = _search.trim().toLowerCase();
    if (term) {
      const hay = (
        card.title +
        " " +
        card.body +
        " " +
        card.tags.join(" ") +
        " " +
        card.fields.map((f) => f.name + " " + f.value).join(" ")
      ).toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (_activeTags.length) {
      for (const t of _activeTags) {
        if (!card.tags.includes(t)) return false;
      }
    }
    return true;
  }

  function setBoard(next: Board) {
    board = next;
    scheduleSave();
  }

  function addCard(columnId: string, partial?: Partial<Card>): Card {
    const column = findColumn(columnId);
    if (!column) return createCard();
    const card = { ...createCard(), ...partial };
    column.cards.push(card);
    scheduleSave();
    return card;
  }

  function updateCard(updated: Card) {
    const found = findCard(updated.id);
    if (!found) return;
    found.column.cards[found.index] = updated;
    autoMoveIfComplete(updated, found);
    scheduleSave();
  }

  function autoMoveIfComplete(card: Card, found: { column: Column; index: number }) {
    const cfg = getAutoMoveConfig();
    if (!cfg.enabled) return;
    const targetName = (cfg.targetColumnName || "").trim();
    if (!targetName) return;
    if (!card.checklist || card.checklist.length === 0) return;

    const allDone = card.checklist.every((item) => item.checked);
    if (!allDone) return;

    const targetColumn = board.columns.find(
      (c) => c.name.toLowerCase() === targetName.toLowerCase()
    );
    if (!targetColumn) return;
    if (targetColumn.id === found.column.id) return;

    const [moved] = found.column.cards.splice(found.index, 1);

    
    if (card.recur) {
      const nextCard = createCard(card.title);
      if (card.due) {
        const nextDue = getNextRecurDate(card.due, card.recur.interval);
        if (nextDue) nextCard.due = nextDue;
      }
      nextCard.recur = card.recur;
      nextCard.tags = card.tags.map((t) => t);
      nextCard.color = card.color;
      nextCard.fields = card.fields.map((f) => ({ ...f }));
      nextCard.checklist = card.checklist.map((i) => ({
        text: i.text,
        checked: false,
      }));
      nextCard.body = card.body;
      nextCard.checked = false;

      found.column.cards.push(nextCard);
    }

    
    targetColumn.cards.push(moved);
  }

  function deleteCard(cardId: string) {
    const found = findCard(cardId);
    if (!found) return;
    found.column.cards.splice(found.index, 1);
    scheduleSave();
  }

  function moveCard(cardId: string, toColumnId: string, toIndex: number) {
    const found = findCard(cardId);
    if (!found) return;
    const target = findColumn(toColumnId);
    if (!target) return;

    const [card] = found.column.cards.splice(found.index, 1);
    
    let idx = toIndex;
    if (found.column === target && idx > found.index) idx -= 1;
    if (idx < 0) idx = 0;
    if (idx > target.cards.length) idx = target.cards.length;
    target.cards.splice(idx, 0, card);
    scheduleSave();
  }

  function archiveCard(cardId: string) {
    const found = findCard(cardId);
    if (!found) return;
    const archive = getArchiveColumn(true)!;
    const [card] = found.column.cards.splice(found.index, 1);
    archive.cards.unshift(card);

    if (card.recur) {
      const nextCard = createCard(card.title);
      if (card.due) {
        const nextDue = getNextRecurDate(card.due, card.recur.interval);
        if (nextDue) nextCard.due = nextDue;
      }
      nextCard.recur = card.recur;
      nextCard.tags = card.tags.map(t => t);
      nextCard.color = card.color;
      nextCard.fields = card.fields.map(f => ({ ...f }));
      nextCard.checklist = card.checklist.map(i => ({ text: i.text, checked: false }));
      nextCard.body = card.body;
      nextCard.checked = false;
      found.column.cards.push(nextCard);
    }

    scheduleSave();
  }

  function addColumn(name: string): Column {
    const newCol = createColumn(name || "New column");
    const archiveIdx = board.columns.findIndex((c) => c.id === ARCHIVE_COLUMN_ID);
    if (archiveIdx >= 0) {
      board.columns.splice(archiveIdx, 0, newCol);
    } else {
      board.columns.push(newCol);
    }
    scheduleSave();
    return newCol;
  }

  function renameColumn(columnId: string, name: string) {
    const col = findColumn(columnId);
    if (!col) return;
    col.name = name;
    scheduleSave();
  }

  function setColumnColor(columnId: string, color: string) {
    const col = findColumn(columnId);
    if (!col) return;
    col.color = color;
    scheduleSave();
  }

  function setColumnWip(columnId: string, wip: number) {
    const col = findColumn(columnId);
    if (!col) return;
    col.wip = Math.max(0, Math.floor(wip) || 0);
    scheduleSave();
  }

  function setColumnSort(columnId: string, sort: "manual" | "due" | "alpha") {
    const col = findColumn(columnId);
    if (!col) return;
    col.sort = sort;
    scheduleSave();
  }

  function toggleCollapse(columnId: string) {
    const col = findColumn(columnId);
    if (!col) return;
    col.collapsed = !col.collapsed;
    scheduleSave();
  }

  function moveColumn(columnId: string, toIndex: number) {
    const from = board.columns.findIndex((c) => c.id === columnId);
    if (from < 0) return;
    const isArchive = columnId === ARCHIVE_COLUMN_ID;
    let idx = toIndex;
    if (idx < 0) idx = 0;
    if (idx >= board.columns.length) idx = board.columns.length - 1;
    if (idx === from) return;

    const [col] = board.columns.splice(from, 1);
    board.columns.splice(idx, 0, col);

    
    const archiveIdx = board.columns.findIndex((c) => c.id === ARCHIVE_COLUMN_ID);
    if (archiveIdx >= 0 && archiveIdx !== board.columns.length - 1) {
      const [arch] = board.columns.splice(archiveIdx, 1);
      board.columns.push(arch);
    } else if (!isArchive && archiveIdx >= 0) {
      const movedIdx = board.columns.findIndex((c) => c.id === columnId);
      if (movedIdx > archiveIdx) {
        const [movedCol] = board.columns.splice(movedIdx, 1);
        board.columns.splice(archiveIdx, 0, movedCol);
      }
    }

    scheduleSave();
  }

  function deleteColumn(columnId: string) {
    const idx = board.columns.findIndex((c) => c.id === columnId);
    if (idx < 0) return;
    if (columnId === ARCHIVE_COLUMN_ID) return;
    board.columns.splice(idx, 1);
    scheduleSave();
  }

  function toggleArchiveVisibility() {
    board.settings.hideArchive = !board.settings.hideArchive;
    scheduleSave();
  }

  function setBoardName(name: string) {
    board.name = name;
    scheduleSave();
  }


  function toggleTag(tag: string) {
    const i = _activeTags.indexOf(tag);
    if (i >= 0) _activeTags.splice(i, 1);
    else _activeTags.push(tag);
    notifyFilters();
  }

  function clearFilters() {
    _search = "";
    _activeTags = [];
    notifyFilters();
  }

  return {
    get board() {
      return board;
    },
    get search() {
      return _search;
    },
    set search(v: string) {
      _search = v;
      notifyFilters();
    },
    get activeTags() {
      return _activeTags;
    },
    get allTags() {
      return Array.from(allTagsSet).sort();
    },
    matches,
    setBoard,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    archiveCard,
    addColumn,
    renameColumn,
    setColumnColor,
    setColumnWip,
    setColumnSort,
    toggleCollapse,
    moveColumn,
    deleteColumn,
    toggleArchiveVisibility,
    toggleTag,
    clearFilters,
    setBoardName,

    pauseSave,
    resumeSave,
    getArchiveColumn,
    flush,
  };
}

export type { Card, Column } from "./board";
