import { App, Modal, TFile } from "obsidian";
import { mount, unmount } from "svelte";
import type { Component } from "obsidian";
import CardEditor from "./CardEditor.svelte";
import ColumnSettings from "./ColumnSettings.svelte";
import type { Card } from "./board";
import type { Column } from "./board";

export class CardEditorModal extends Modal {
  private component: Record<string, unknown> | null = null;
  private saved = false;
  private onCancel?: () => void;

  constructor(
    app: App,
    plugin: Component,
    sourcePath: string,
    card: Card,
    onSave: (card: Card) => void,
    onCancel?: () => void
  ) {
    super(app);
    this.onCancel = onCancel;
    this.titleEl.setText("Edit card");
    this.component = mount(CardEditor, {
      target: this.contentEl,
      props: {
        card,
        app,
        plugin,
        sourcePath,
        onSave: (updated: Card) => {
          this.saved = true;
          onSave(updated);
          this.close();
        },
        onCancel: () => this.close(),
      },
    }) as Record<string, unknown>;
  }

  onClose() {
    if (this.component) {
      unmount(this.component).catch(() => {});
      this.component = null;
    }
    if (!this.saved) this.onCancel?.();
  }
}

export class ColumnSettingsModal extends Modal {
  private component: Record<string, unknown> | null = null;
  private saved = false;
  private onCancel?: () => void;

  constructor(
    app: App,
    column: Column,
    onSave: (name: string, color: string, wip: number) => void,
    onDelete: () => void,
    onCancel?: () => void
  ) {
    super(app);
    this.onCancel = onCancel;
    this.titleEl.setText("Column settings");
    this.component = mount(ColumnSettings, {
      target: this.contentEl,
      props: {
        column,
        onSave: (name: string, color: string, wip: number) => {
          this.saved = true;
          onSave(name, color, wip);
          this.close();
        },
        onDelete: () => {
          this.saved = true;
          onDelete();
          this.close();
        },
        onCancel: () => this.close(),
      },
    }) as Record<string, unknown>;
  }

  onClose() {
    if (this.component) {
      unmount(this.component).catch(() => {});
      this.component = null;
    }
    if (!this.saved) this.onCancel?.();
  }
}

export class PromptModal extends Modal {
  private resolve: (value: string | null) => void;
  private inputEl: HTMLInputElement;
  private resolved = false;

  constructor(app: App, title: string, placeholder: string, defaultValue: string, resolve: (value: string | null) => void) {
    super(app);
    this.titleEl.setText(title);
    this.resolve = resolve;

    const wrapper = this.contentEl.createDiv({ cls: "ak-prompt" });
    this.inputEl = wrapper.createEl("input", { type: "text", cls: "ak-prompt-input" });
    this.inputEl.placeholder = placeholder;
    this.inputEl.value = defaultValue;

    const btns = wrapper.createDiv({ cls: "ak-prompt-buttons" });
    const cancel = btns.createEl("button", { text: "Cancel", cls: "ak-btn ak-btn-secondary" });
    const ok = btns.createEl("button", { text: "OK", cls: "ak-btn ak-btn-primary" });

    const submit = () => {
      if (this.resolved) return;
      this.resolved = true;
      this.resolve(this.inputEl.value.trim() || null);
      this.close();
    };
    const cancelFn = () => {
      if (this.resolved) return;
      this.resolved = true;
      this.resolve(null);
      this.close();
    };
    ok.onclick = submit;
    cancel.onclick = cancelFn;
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
      if (e.key === "Escape") cancelFn();
    });
  }

  onOpen() {
    void super.onOpen();
    window.setTimeout(() => this.inputEl.focus(), 50);
  }

  onClose() {
    super.onClose();
    if (!this.resolved) {
      this.resolved = true;
      void this.resolve(null);
    }
  }
}

export class BoardPickerModal extends Modal {
  private boards: TFile[];
  private lastOpenTimes: Record<string, number>;
  private onChoose: (file: TFile) => void;
  private resolved = false;

  constructor(app: App, boards: TFile[], lastOpenTimes: Record<string, number>, onChoose: (file: TFile) => void) {
    super(app);
    this.boards = boards;
    this.lastOpenTimes = lastOpenTimes;
    this.onChoose = onChoose;
    this.titleEl.setText("Select a kanban board");
  }

  onOpen(): void {
    const container = this.contentEl.createDiv({ cls: "ak-board-picker-compact" });

    const searchWrap = container.createDiv({ cls: "ak-board-picker-search-wrap" });
    const input = searchWrap.createEl("input", { type: "text", placeholder: "Search boards…", cls: "ak-board-picker-input" });

    const listWrap = container.createDiv({ cls: "ak-board-picker-list" });
    const emptyWrap = container.createDiv({ cls: "ak-board-picker-empty", text: "No boards found." });
    emptyWrap.setCssStyles({ display: "none" });

    
    const sorted = [...this.boards].sort((a, b) => {
      const ta = this.lastOpenTimes[a.path] || a.stat?.mtime || 0;
      const tb = this.lastOpenTimes[b.path] || b.stat?.mtime || 0;
      return tb - ta;
    });

    const maxInitial = 4;

    const buttons: Array<{ btn: HTMLButtonElement; file: TFile }> = sorted.map((file) => {
      const btn = listWrap.createEl("button", {
        cls: "ak-board-picker-btn",
        text: file.basename,
      });
      btn.addEventListener("click", () => {
        if (this.resolved) return;
        this.resolved = true;
        this.onChoose(file);
        this.close();
      });
      return { btn, file };
    });

    const applyFilter = (query: string) => {
      const q = query.trim().toLowerCase();
      const filtered = q
        ? sorted.filter((f) => f.basename.toLowerCase().includes(q))
        : sorted;

      buttons.forEach(({ btn, file }) => {
        btn.setCssStyles({
          display: filtered.some((f) => f.path === file.path) ? "" : "none",
        });
      });

      const anyVisible = filtered.length > 0;
      listWrap.setCssStyles({ display: anyVisible ? "" : "none" });
      emptyWrap.setCssStyles({ display: anyVisible ? "none" : "" });
    };

    
    if (sorted.length > maxInitial) {
      buttons.forEach(({ btn }, i) => {
        btn.setCssStyles({ display: i < maxInitial ? "" : "none" });
      });
      listWrap.setCssStyles({ display: "" });
      emptyWrap.setCssStyles({ display: "none" });
    }

    input.addEventListener("input", () => {
      const q = input.value;
      const hasQuery = q.trim().length > 0;

      if (hasQuery) {
        buttons.forEach(({ btn }) => btn.setCssStyles({ display: "" }));
        applyFilter(q);
      } else {
        buttons.forEach(({ btn }, i) => {
          btn.setCssStyles({
            display: (sorted.length <= maxInitial || i < maxInitial) ? "" : "none",
          });
        });
        listWrap.setCssStyles({ display: "" });
        emptyWrap.setCssStyles({ display: "none" });
      }
    });

    
    window.setTimeout(() => input.focus(), 50);
  }

  onClose(): void {
    super.onClose();
    this.boards = [];
    this.onChoose = () => {};
  }
}

export function promptUser(app: App, title: string, placeholder: string, defaultValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const wrapped = (v: string | null) => {
      if (resolved) return;
      resolved = true;
      resolve(v);
    };
    new PromptModal(app, title, placeholder, defaultValue, wrapped).open();
  });
}
