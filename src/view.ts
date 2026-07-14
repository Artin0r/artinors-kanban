import { FileView, type EventRef, type TFile, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import Board from "./Board.svelte";
import { parseBoard, serializeBoard } from "./parser";
import { createBoardStore, type BoardStore } from "./store.svelte";
import type { Board as BoardModel } from "./board";
import type AdvancedKanbanPlugin from "./main";

export const VIEW_TYPE_KANBAN = "advanced-kanban-view";

export class KanbanView extends FileView {
  plugin: AdvancedKanbanPlugin;
  store: BoardStore | null = null;
  private component: Record<string, unknown> | null = null;
  private lastSavedMarkdown: string | null = null;
  private modifyRef: EventRef | null = null;
  private currentFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: AdvancedKanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  private refreshFromDisk(): void {
    if (!this.file) return;
    const current = this.lastSavedMarkdown;
    const readTask = this.app.vault.read(this.file);
    void (async () => {
      const content = await readTask;
      if (content === current) return;
      try {
        const board = parseBoard(content, this.file?.basename ?? "Kanban");
        if (this.store) {
          this.store.setBoard(board);
        }
      } catch (err) {
        console.error("Advanced Kanban: failed to refresh board from disk", err);
      }
    })();
  }

  getViewType(): string {
    return VIEW_TYPE_KANBAN;
  }

  getDisplayText(): string {
    return this.store?.board.name ?? this.file?.basename ?? "Kanban";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onLoadFile(file: TFile): Promise<void> {
    this.registerFileChangeListener();

    let content: string;
    try {
      content = await this.app.vault.read(file);
    } catch (err) {
      console.error("Advanced Kanban: failed to read board file", err);
      return; 
    }

    
    if (file === this.currentFile && content === this.lastSavedMarkdown) {
      return;
    }

    
    if (file === this.currentFile) {
      try {
        const board = parseBoard(content, file.basename);
        if (this.store) {
          this.store.setBoard(board);
        }
        this.lastSavedMarkdown = content;
      } catch (err) {
        console.error("Advanced Kanban: failed to refresh board from disk", err);
      }
      return;
    }

    
    await this.teardown();
    this.currentFile = file;
    this.lastSavedMarkdown = content;

    let board: BoardModel;
    try {
      board = parseBoard(content, file.basename);
    } catch (err) {
      console.error("Advanced Kanban: failed to parse board", err);
      board = { name: file.basename, id: null, columns: [], settings: { hideArchive: false } };
    }

    await this.renderBoard(board);
  }

  private registerFileChangeListener(): void {
    this.unregisterFileChangeListener();
    this.modifyRef = this.app.vault.on("modify", (f: TFile) => {
      if (f === this.file) {
        this.refreshFromDisk();
      }
    });
  }

  private unregisterFileChangeListener(): void {
    if (this.modifyRef != null) {
      this.app.vault.offref(this.modifyRef);
      this.modifyRef = null;
    }
  }

  async onUnloadFile(_file: TFile): Promise<void> {
    
    
    
    this.unregisterFileChangeListener();
  }

  private async renderBoard(board: BoardModel): Promise<void> {
    await this.teardown();
    this.store = createBoardStore(
      board,
      (b) => this.saveBoard(b),
      undefined,
      "",
      [],
      () => ({
        enabled: this.plugin.settings?.autoMoveOnComplete ?? false,
        targetColumnName: this.plugin.settings?.autoMoveTargetColumn ?? "Done",
      })
    );
    this.contentEl.empty();
    this.contentEl.addClass("advanced-kanban-view");
    this.contentEl.addClass("ak-layout-scroll");
    this.component = mount(Board, {
      target: this.contentEl,
      props: {
        store: this.store,
        app: this.app,
        plugin: this.plugin,
        view: this,
        sourcePath: this.file?.path ?? "",
      },
    }) as Record<string, unknown>;
  }

  private async saveBoard(board: BoardModel): Promise<void> {
    if (!this.file) return;
    let md: string;
    try {
      md = serializeBoard(board);
    } catch (err) {
      console.error("Advanced Kanban: failed to serialize board", err);
      return;
    }
    if (this.lastSavedMarkdown === md) return;
    this.lastSavedMarkdown = md;
    try {
      await this.app.vault.modify(this.file, md);
    } catch (err) {
      console.error("Advanced Kanban: failed to write board file", err);
    }
  }

    async openAsMarkdown(): Promise<void> {
    if (!this.file) return;
    await this.leaf.setViewState({
      type: "markdown",
      state: { file: this.file.path },
    });
  }

  private async teardown(): Promise<void> {
    const store = this.store;
    const component = this.component;
    this.store = null;
    this.component = null;

    if (store && store.flush) {
      await store.flush();
    }

    if (component) {
      unmount(component).catch((err) => {
        console.error("Advanced Kanban: error unmounting board", err);
      });
    }
  }

  async onClose(): Promise<void> {
    this.unregisterFileChangeListener();
    this.currentFile = null;
    this.lastSavedMarkdown = null;
    await this.teardown();
    if (super.onClose) {
      await super.onClose();
    }
  }
}
