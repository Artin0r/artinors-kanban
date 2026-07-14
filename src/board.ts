export interface CardField {
  name: string;
  value: string;
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export type RecurInterval = "daily" | "weekly" | "biweekly" | "monthly";

export interface RecurConfig {
  interval: RecurInterval;
}

export interface CardTemplate {
  id: string;
  label: string;
  title: string;
  body: string;
  due: string | null;
  recur: RecurConfig | null;
  tags: string[];
  color: string;
  fields: CardField[];
  checklist: ChecklistItem[];
}

export interface Card {
    id: string;
    title: string;
    checked: boolean;
    body: string;
    due: string | null;
    recur: RecurConfig | null;
    tags: string[];
    color: string;
    fields: CardField[];
    checklist: ChecklistItem[];
}

export interface Column {
  id: string;
  name: string;
    color: string;
    wip: number;
  collapsed: boolean;
  sort: "manual" | "due" | "alpha";
  cards: Card[];
}

export interface BoardSettings {
  hideArchive: boolean;
}

export interface Board {
  name: string;
  id: string | null;
  columns: Column[];
  settings: BoardSettings;
}

export const ARCHIVE_COLUMN_ID = "__archive__";

export const DEFAULT_COLORS: Record<string, string> = {
  "": "var(--text-muted)",
  red: "#e05260",
  orange: "#e08a3c",
  yellow: "#c9a23c",
  green: "#4caf50",
  teal: "#26a69a",
  blue: "#3a7bd5",
  purple: "#8e5bd9",
  pink: "#d94f9a",
  gray: "#8a8a8a",
};

const DEFAULT_COLUMN_TEMPLATES: { name: string; color: string; wip: number }[] = [
  { name: "Backlog", color: "", wip: 0 },
  { name: "To Do", color: "#3a7bd5", wip: 5 },
  { name: "In Progress", color: "#e08a3c", wip: 3 },
  { name: "Done", color: "#4caf50", wip: 0 },
];

export const DEFAULT_CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    title: "New card",
    body: "",
    due: null,
    recur: null,
    tags: [],
    color: "",
    fields: [],
    checklist: [],
  },
  {
    id: "bug",
    label: "Bug Report",
    title: "Bug: ",
    body: "## Description\n\n## Steps to reproduce\n1. \n2. \n3. \n\n## Expected behavior\n\n## Actual behavior\n",
    due: null,
    recur: null,
    tags: ["bug"],
    color: "red",
    fields: [{ name: "Priority", value: "Medium" }],
    checklist: [
      { text: "Verify in latest version", checked: false },
      { text: "Attach screenshot/logs", checked: false },
    ],
  },
  {
    id: "feature",
    label: "Feature Request",
    title: "Feature: ",
    body: "## Summary\n\n## Motivation\n\n## Proposed solution\n",
    due: null,
    recur: null,
    tags: ["feature"],
    color: "blue",
    fields: [{ name: "Priority", value: "Medium" }],
    checklist: [
      { text: "Check related issues", checked: false },
      { text: "Gather feedback", checked: false },
    ],
  },
  {
    id: "meeting",
    label: "Meeting Note",
    title: "Meeting: ",
    body: "## Attendees\n\n## Agenda\n\n## Notes\n\n## Action items\n",
    due: null,
    recur: null,
    tags: ["meeting"],
    color: "teal",
    fields: [],
    checklist: [
      { text: "Review action items with attendees", checked: false },
    ],
  },
];

export function generateId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
  );
}

export function createCard(title = "New card"): Card {
  return {
    id: generateId(),
    title,
    checked: false,
    body: "",
    due: null,
    recur: null,
    tags: [],
    color: "",
    fields: [],
    checklist: [],
  };
}


export function createColumn(name: string, color = "", wip = 0, sort: "manual" | "due" | "alpha" = "manual"): Column {
  return {
    id: generateId(),
    name,
    color,
    wip,
    collapsed: false,
    sort,
    cards: [],
  };
}

export function createBoard(name: string): Board {
  return {
    name,
    id: generateId(),
    columns: DEFAULT_COLUMN_TEMPLATES.map((c) =>
      createColumn(c.name, c.color, c.wip)
    ),
    settings: { hideArchive: false },
  };
}
