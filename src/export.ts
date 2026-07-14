import type { Board, Card, CardField, ChecklistItem, RecurInterval } from "./board";
import { ARCHIVE_COLUMN_ID, createColumn, generateId } from "./board";

type RecurConfig = { interval: RecurInterval };

function sanitizeFilename(name: string): string {
  return (name || "kanban-board").replace(/[^\p{L}\p{N}\s_-]+/gu, "").trim() || "kanban-board";
}

function get<T>(row: T[], index: number | null): T | undefined {
  if (index == null) return undefined;
  return row[index];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }

  result.push(cur);
  return result;
}

function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '""';
          i += 2;
        } else {
          current += '"';
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        current += '"';
        inQuotes = true;
        i++;
      } else if (ch === '\n') {
        lines.push(current);
        current = "";
        i++;
      } else if (ch === '\r') {
        const next = i + 1 < text.length ? text[i + 1] : undefined;
        if (next === '\n') {
          i += 2;
        } else {
          i++;
        }
        lines.push(current);
        current = "";
      } else {
        current += ch;
        i++;
      }
    }
  }

  if (current.trim() !== "") {
    lines.push(current);
  }
  return lines;
}


export function exportBoardAsCSV(board: Board, name?: string): void {
  const base = sanitizeFilename(name || board.name);

  const header = [
    "ID",
    "Title",
    "Column",
    "Checked",
    "Due",
    "Repeats",
    "Tags",
    "Color",
    "Custom Fields",
    "Checklist",
    "Body",
  ];

  const lines: string[] = [header.join(",")];

  for (const col of board.columns) {
    
    lines.push(buildColumnMarkerRow(col.name));
    for (const card of col.cards) {
      lines.push(buildCSVRow(card, col.name));
    }
  }

  downloadFile(`${base}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
}

function buildColumnMarkerRow(columnName: string): string {
  const cells = [
    "__COLUMN__",
    esc(columnName),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
  return cells.join(",");
}

function buildCSVRow(card: Card, columnName: string): string {
  const cells: string[] = [
    esc(card.id),
    esc(card.title),
    esc(columnName),
    esc(String(!!card.checked)),
    esc(card.due || ""),
    esc(card.recur?.interval || ""),
    esc(card.tags.map((t) => "#" + t).join(" ")),
    esc(card.color || ""),
    esc(
      card.fields
        .map((f) => (f.name ? `${f.name}=${f.value}` : f.value))
        .join("; ")
    ),
    esc(
      card.checklist
        .map((i) => (i.checked ? "☑" : "☐") + " " + i.text)
        .join("; ")
    ),
    esc(card.body || ""),
  ];
  return cells.join(",");
}

function esc(v: string): string {
  const s = String(v ?? "");
  if (s === "") return '""';
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}



export function exportBoardAsTrelloJSON(board: Board, name?: string): void {
  const base = sanitizeFilename(name || board.name);
  const boardId = `board-${Date.now()}`;

  const allTags = new Set<string>();
  for (const col of board.columns) {
    for (const card of col.cards) {
      for (const t of card.tags) allTags.add(t);
    }
  }
  const tagArray = Array.from(allTags);

  const labelColors = [
    "green", "yellow", "orange", "red", "purple",
    "blue", "sky", "lime", "pink", "foggy",
  ];
  const labelMap: Record<string, { id: string; name: string; color: string }> = {};
  tagArray.forEach((tag, i) => {
    const color = labelColors[i % labelColors.length];
    const id = `label-${i}`;
    labelMap[tag] = { id, name: tag, color };
  });

  const trelloBoard = {
    name: board.name || "Kanban Board",
    desc: "",
    id: boardId,
    lists: board.columns
      .map((col) => ({
        id: col.id,
        name: col.name,
        closed: false,
        cards: col.cards.map((card) => {
          const labels = (card.tags || [])
            .map((t) => labelMap[t]?.id)
            .filter(Boolean);

          const checklists: { id: string; name: string; checkItems: { id: string; name: string; state: string }[] }[] = [];
          if (card.checklist?.length) {
            checklists.push({
              id: `cl-${card.id}`,
              name: "Checklist",
              checkItems: card.checklist.map((item, i) => ({
                id: `cl-${card.id}-item-${i}`,
                name: item.text,
                state: item.checked ? "complete" : "open",
              })),
            });
          }

          const customFields: Array<{ name: string; value: string }> = [];
          if (card.color) {
            customFields.push({ name: "Color", value: card.color });
          }
          if (card.recur?.interval) {
            customFields.push({ name: "Repeats", value: card.recur.interval });
          }

          return {
            id: card.id,
            name: card.title,
            desc: card.body || "",
            due: card.due || undefined,
            dueComplete: card.checked || false,
            labels: labels.length ? labels : undefined,
            url: "",
            idList: col.id,
            idBoard: boardId,
            checklists: checklists.length ? checklists : undefined,
            customFields: customFields.length ? customFields : undefined,
          };
        }),
      })),
    labels: Object.values(labelMap),
  };

  const json = JSON.stringify(trelloBoard, null, 2);
  downloadFile(`${base}-trello.json`, json, "application/json");
}



function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const doc = (typeof window !== "undefined" && window.activeDocument) || document;
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}



export function importBoardFromCSV(board: Board, text: string): void {
  const lines = splitCSVLines(text);
  if (lines.length < 2) return;

  const header = parseCSVLine(lines[0].trim()).map((h) => h.trim());
  const idx = (name: string) => {
    const i = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : null;
  };

  const iId = idx("id");
  const iTitle = idx("Title");
  const iCol = idx("Column");
  const iChecked = idx("Checked");
  const iDue = idx("Due");
  const iRecur = idx("Repeats");
  const iTags = idx("Tags");
  const iColor = idx("Color");
  const iFields = idx("Custom Fields");
  const iChecklist = idx("Checklist");
  const iBody = idx("Body");

  
  board.columns = [];

  const columnMap = new Map<string, typeof board.columns[0]>();
  let archiveCreated = false;

  for (let r = 1; r < lines.length; r++) {
    const rawLine = lines[r].trim();
    if (!rawLine) continue;

    
    
    if (rawLine.startsWith("#")) continue; 

    const row = parseCSVLine(rawLine);
    if (!row || row.length === 0) continue;

    
    const cellId = get(row, iId) || "";
    if (cellId.trim() === "__COLUMN__") {
      const colName = (get(row, iTitle) || "").trim();
      if (colName && !columnMap.has(colName)) {
        const col = createColumn(colName);
        if (colName.toLowerCase() === "archive" && !archiveCreated) {
          col.id = ARCHIVE_COLUMN_ID;
          col.collapsed = true;
          archiveCreated = true;
        }
        board.columns.push(col);
        columnMap.set(colName, col);
      }
      continue;
    }

    let colName = (get(row, iCol) || "To Do").trim();
    let column = columnMap.get(colName);
    if (!column) {
      column = createColumn(colName);
      if (colName.toLowerCase() === "archive" && !archiveCreated) {
        column.id = ARCHIVE_COLUMN_ID;
        column.collapsed = true;
        archiveCreated = true;
      }
      board.columns.push(column);
      columnMap.set(colName, column);
    }

    const title = (get(row, iTitle) || "Imported card").trim();
    const rawChecked = (get(row, iChecked) || "").trim().toLowerCase();
    const checked = rawChecked === "true" || rawChecked === "yes" || rawChecked === "1" || rawChecked === "x";
    const due = (get(row, iDue) || "").trim() || null;
    const recurRaw = (get(row, iRecur) || "").trim().toLowerCase();
    const recur: RecurConfig | null =
      ["daily", "weekly", "biweekly", "monthly"].includes(recurRaw)
        ? { interval: recurRaw as RecurInterval }
        : null;

    const tags = (get(row, iTags) || "")
      .split(/[,;\s]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);

    const color = (get(row, iColor) || "").trim();
    const fields = parseCSVFields(get(row, iFields) || "");
    const checklist = parseCSVChecklist(get(row, iChecklist) || "");
    const body = (get(row, iBody) || "").trim();

    const card: Card = {
      id: (get(row, iId) || generateId()).trim(),
      title,
      checked,
      body,
      due,
      recur,
      tags,
      color,
      fields,
      checklist,
    };

    column.cards.push(card);
  }
}

function parseCSVFields(raw: string): CardField[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, ...rest] = s.split("=");
      return {
        name: name.trim() || "",
        value: rest.length ? rest.join("=").trim() : "",
      };
    });
}

function parseCSVChecklist(raw: string): ChecklistItem[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const text = s.replace(/^☑\s*/, "").replace(/^☐\s*/, "").trim();
      const checked = s.trimStart().startsWith("☑");
      return { text, checked };
    });
}



interface TrelloBoardData {
  lists: Array<{
    name: string;
    cards: Array<{
      name: string;
      desc: string;
      due: string;
      dueComplete: boolean;
      labels: string[];
      checklists: Array<{ checkItems?: Array<{ name?: string; state?: string }> }>;
      customFields: Array<{ name?: string; value?: string | number }>;
    }>;
  }>;
  labels: Array<{ id: string; name: string }>;
}

function parseTrelloData(text: string): TrelloBoardData | null {
  try {
    const raw = JSON.parse(text) as TrelloBoardData | null;
    return typeof raw === "object" && raw !== null ? raw : null;
  } catch {
    return null;
  }
}

export function importBoardFromTrelloJSON(board: Board, text: string): void {
  const data = parseTrelloData(text);
  if (!data) return;

  const lists = Array.isArray(data?.lists) ? data.lists : [];

  const labelToTag: Record<string, string> = (data?.labels || []).reduce<Record<string, string>>((acc, l) => {
    if (l?.id && l?.name) acc[l.id] = String(l.name);
    return acc;
  }, {});

  
  board.columns = [];

  const columnMap = new Map<string, typeof board.columns[0]>();
  let archiveCreated = false;

  for (const list of lists) {
    if (!list) continue;
    let listName = list.name || "To Do";
    let column = columnMap.get(listName);
    if (!column) {
      column = createColumn(listName);
      if (listName.toLowerCase() === "archive" && !archiveCreated) {
        column.id = ARCHIVE_COLUMN_ID;
        column.collapsed = true;
        archiveCreated = true;
      }
      board.columns.push(column);
      columnMap.set(listName, column);
    }

    const cards = Array.isArray(list.cards) ? list.cards : [];
    for (const card of cards) {
      if (!card) continue;
      const title = card.name || "Imported card";
      const body = (card.desc || "").trim();
      const due = (card.due || "").trim() || null;
      const checked = !!card.dueComplete;
      const tags: string[] = [];
      for (const labelId of card.labels || []) {
        const tagName = labelToTag[labelId];
        if (tagName) tags.push(tagName);
      }

      const fields: CardField[] = [];
      const checklist: ChecklistItem[] = [];

      
      let color = "";
      const recurValues = ["daily", "weekly", "biweekly", "monthly"];
      let recur: RecurConfig | null = null;

      const customFields = card.customFields || [];
      for (const cf of customFields) {
        if (cf?.name === "Color" && cf?.value) {
          color = String(cf.value);
        }
        if (cf?.name === "Repeats") {
          const val = String(cf.value || "").trim().toLowerCase();
          if (recurValues.includes(val)) {
            recur = { interval: val as RecurInterval };
          }
        }
      }

      for (const cl of card.checklists || []) {
        for (const item of cl.checkItems || []) {
          checklist.push({
            text: String(item.name || ""),
            checked: item.state === "complete",
          });
        }
      }

      const trelloCard: Card = {
        id: (typeof (card as Record<string, unknown>).id === "string" ? (card as Record<string, unknown>).id as string : generateId()),
        title,
        checked,
        body,
        due,
        recur: recur,
        tags,
        color,
        fields,
        checklist,
      };

      column.cards.push(trelloCard);
    }
  }
}
