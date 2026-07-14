import { setIcon } from "obsidian";

export function iconAction(el: HTMLElement, id: string) {
  setIcon(el, id);
  return {
    update(next: string) {
      setIcon(el, next);
    },
  };
}

export function formatDueDate(due: string): string {
  const d = parseDate(due);
  if (!d) return due;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function parseDate(due: string): Date | null {
  const m = due.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function dueStatus(due: string | null): "overdue" | "today" | "soon" | "future" | "none" {
  if (!due) return "none";
  const d = parseDate(due);
  if (!d) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 3) return "soon";
  return "future";
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function resolveDateShortcut(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const toISO = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  };
  const today = new Date();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const m2 = v.match(/^(\d{1,4})[/.\s-](\d{1,2})[/.\s-](\d{1,2})$/);
  if (m2) {
    const a = Number(m2[1]), b = Number(m2[2]), c = Number(m2[3]);
    const yr = a >= 1000 ? a : (a >= 50 ? 1900 + a : 2000 + a);
    const d = new Date(yr, b - 1, c);
    if (!isNaN(d.getTime()) && d.getFullYear() === yr && d.getMonth() === b - 1 && d.getDate() === c) return toISO(d);
  }

  const lower = v.toLowerCase();
  if (lower === "today") return toISO(today);
  if (lower === "tom" || lower === "tomorrow") return toISO(new Date(+today + 86400000));
  const pm = lower.match(/^\+\s*(\d+)\s*(d|w)?$/);
  if (pm) {
    const n = Number(pm[1]), u = (pm[2] || "d").toLowerCase();
    const r = new Date(today); r.setDate(r.getDate() + (u === "w" ? n * 7 : n)); return toISO(r);
  }
  const dayMap: Record<string, number> = {sun:0,sunday:0,mon:1,monday:1,tue:2,tuesday:2,wed:3,wednesday:3,thu:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
  const nm = lower.match(/^next\s+([a-z]+)$/);
  if (nm) {
    const target = dayMap[nm[1]];
    if (target != null) {
      const r = new Date(today);
      const diff = (target - r.getDay() + 7) % 7;
      r.setDate(r.getDate() + (diff === 0 ? 7 : diff));
      return toISO(r);
    }
  }
  if (lower === "eom" || lower === "end of month") return toISO(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  return null;
}

export function getNextRecurDate(due: string, interval: string): string | null {
  const d = parseDate(due);
  if (!d) return null;

  const toISO = (date: Date) => {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${day}`;
  };

  const next = new Date(d);
  switch (interval) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return toISO(next);
    case "weekly":
      next.setDate(next.getDate() + 7);
      return toISO(next);
    case "biweekly":
      next.setDate(next.getDate() + 14);
      return toISO(next);
    case "monthly": {
      const originalDay = next.getDate();
      next.setMonth(next.getMonth() + 1);
      if (next.getDate() !== originalDay) {
        next.setDate(0);
      }
      return toISO(next);
    }
    default:
      return null;
  }
}
