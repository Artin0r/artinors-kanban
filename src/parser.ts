import { parseYaml, stringifyYaml } from "obsidian";
import {
  type Board,
  type Card,
  type Column,
  type RecurInterval,
  createColumn,
  generateId,
} from "./board";

const PLUGIN_MARKER = "advanced-kanban";

interface FrontmatterColumn {
  id: string;
  name: string;
  color: string;
  wip: number;
  collapsed: boolean;
  sort?: "manual" | "due" | "alpha";
}

interface ParsedFrontmatter {
  "kanban-plugin"?: string;
  "board-name"?: string;
  "board-id"?: string;
  columns?: FrontmatterColumn[];
  settings?: { "hide-archive"?: boolean };
}

export function parseBoard(content: string, defaultName = "Untitled board"): Board {
  let frontmatter: ParsedFrontmatter = {};
  let body = content;

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    try {
      const parsed = parseYaml(fmMatch[1]) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        frontmatter = parsed as ParsedFrontmatter;
      }
    } catch {
      // ignore: malformed frontmatter, fall back to parsing body
    }
    body = content.slice(fmMatch[0].length);
  }

  const fmColumns = Array.isArray(frontmatter.columns) ? frontmatter.columns : [];

  
  const sections = parseBodySections(body);
  const columns: Column[] = [];
  const usedSectionIndexes = new Set<number>();

  for (const fc of fmColumns) {
    const idx = sections.findIndex(
      (s, i) => !usedSectionIndexes.has(i) && (s.id === fc.id || s.name === fc.name)
    );
    let cards: Card[] = [];
    if (idx >= 0) {
      usedSectionIndexes.add(idx);
      cards = sections[idx].cards;
    }
    columns.push({
      id: fc.id || generateId(),
      name: fc.name || "Column",
      color: fc.color || "",
      wip: typeof fc.wip === "number" ? fc.wip : 0,
      collapsed: !!fc.collapsed,
      sort: fc.sort || "manual",
      cards,
    });
  }

  for (let i = 0; i < sections.length; i++) {
    if (usedSectionIndexes.has(i)) continue;
    const s = sections[i];
    columns.push({
      id: s.id || generateId(),
      name: s.name,
      color: "",
      wip: 0,
      collapsed: false,
      sort: "manual",
      cards: s.cards,
    });
  }

  if (columns.length === 0) {
    columns.push(createColumn("To Do"));
  }

  return {
    name: frontmatter["board-name"] || defaultName,
    id: frontmatter["board-id"] || generateId(),
    columns,
    settings: {
      hideArchive: !!frontmatter.settings?.["hide-archive"],
    },
  };
}

interface BodySection {
  name: string;
  id: string | null;
  cards: Card[];
}

function parseBodySections(body: string): BodySection[] {
  const sections: BodySection[] = [];
  let current: BodySection | null = null;
  let currentCard: Card | null = null;

  const lines = body.split(/\r?\n/);

  const flushCard = () => {
    if (current && currentCard) {
      current.cards.push(currentCard);
    }
    currentCard = null;
  };

  for (const rawLine of lines) {
    const line = rawLine;

    
    const headingMatch = line.match(/^##\s+(.*?)(?:\s*<!--col:([A-Za-z0-9_-]+)-->)?\s*$/);
    if (headingMatch) {
      flushCard();
      current = { name: headingMatch[1].trim(), id: headingMatch[2] || null, cards: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      
      continue;
    }

    
    const cardMatch = line.match(/^-\s+(?:\[([ xX])\]\s+)?(.*)$/);
    if (cardMatch) {
      flushCard();
      const titleRaw = cardMatch[2] ?? "";
      const { title, id } = extractIdComment(titleRaw);
      currentCard = {
        id: id || generateId(),
        title: title.trim(),
        checked: (cardMatch[1] || " ").toLowerCase() === "x",
        body: "",
        due: null,
        recur: null,
        tags: [],
        color: "",
        fields: [],
        checklist: [],
      };
      continue;
    }

    if (!currentCard) continue;

    
    const childMatch = line.match(/^(\s{2,}|\t+)(.*)$/);
    if (childMatch) {
      const inner = childMatch[2];

      
      const subCheck = inner.match(/^-\s+\[([ xX])\]\s+(.*)$/);
      if (subCheck) {
        currentCard.checklist.push({
          text: subCheck[2].trim(),
          checked: subCheck[1].toLowerCase() === "x",
        });
        continue;
      }

      
      const meta = inner.match(/^([A-Za-z0-9_.-]+)::\s*(.*)$/);
      if (meta) {
        const key = meta[1];
        const value = meta[2].trim();
        switch (key) {
          case "due":
            currentCard.due = value || null;
            break;
          case "recur":
            if (["daily", "weekly", "biweekly", "monthly"].includes(value)) {
              currentCard.recur = { interval: value as RecurInterval };
            }
            break;
          case "tags":
            currentCard.tags = parseTags(value);
            break;
          case "color":
            currentCard.color = value;
            break;
          case "id":
            if (value) currentCard.id = value;
            break;
          default: {
            
            const fieldName = key.startsWith("field.") ? key.slice(6) : key;
            currentCard.fields.push({ name: fieldName, value });
          }
        }
        continue;
      }

      
      if (currentCard.body) {
        currentCard.body += "\n" + inner;
      } else {
        currentCard.body = inner;
      }
      continue;
    }

    
    if (line.trim() === "") {
      flushCard();
    }
  }

  flushCard();
  return sections;
}

function extractIdComment(text: string): { title: string; id: string | null } {
  const m = text.match(/^(.*?)\s*<!--id:([A-Za-z0-9_-]+)-->\s*$/);
  if (m) return { title: m[1], id: m[2] };
  return { title: text, id: null };
}

function parseTags(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t.length > 0);
}


export function serializeBoard(board: Board): string {
  const fm: ParsedFrontmatter = {
    "kanban-plugin": PLUGIN_MARKER,
    "board-name": board.name,
    "board-id": board.id || generateId(),
    columns: board.columns.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color || "",
      wip: c.wip || 0,
      collapsed: !!c.collapsed,
      sort: c.sort || "manual",
    })),
    settings: { "hide-archive": !!board.settings.hideArchive },
  };

  const fmYaml = stringifyYaml(fm);

  const lines: string[] = [];
  lines.push("---");
  lines.push(fmYaml.trimEnd());
  lines.push("---");
  lines.push("");

  for (const column of board.columns) {
    lines.push(`## ${column.name} <!--col:${column.id}-->`);
    lines.push("");
    for (const card of column.cards) {
      lines.push(serializeCard(card));
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function serializeCard(card: Card): string {
  const check = card.checked ? "[x]" : "[ ]";
  const titleLine = `- ${check} ${card.title} <!--id:${card.id}-->`;
  const out: string[] = [titleLine];

  if (card.due) out.push(`  due:: ${card.due}`);
  if (card.recur) out.push(`  recur:: ${card.recur.interval}`);
  if (card.tags.length) out.push(`  tags:: ${card.tags.map((t) => "#" + t).join(" ")}`);
  if (card.color) out.push(`  color:: ${card.color}`);
  for (const f of card.fields) {
    if (f.name) out.push(`  ${f.name}:: ${f.value}`);
  }

  if (card.body && card.body.trim()) {
    for (const bodyLine of card.body.split(/\r?\n/)) {
      out.push("  " + bodyLine);
    }
  }

  for (const item of card.checklist) {
    const c = item.checked ? "[x]" : "[ ]";
    out.push(`  - ${c} ${item.text}`);
  }

  return out.join("\n");
}

export function isPluginFrontmatter(frontmatter: Record<string, unknown> | null | undefined): boolean {
  return !!frontmatter && frontmatter["kanban-plugin"] === PLUGIN_MARKER;
}
