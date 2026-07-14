import { Notice, normalizePath, Plugin, TFile, requireApiVersion, type ViewState } from "obsidian";
import { KanbanView, VIEW_TYPE_KANBAN } from "./view";
import {
  AdvancedKanbanSettingTab,
  DEFAULT_SETTINGS,
  type AdvancedKanbanSettings,
} from "./settings";
import { createBoard, DEFAULT_CARD_TEMPLATES } from "./board";
import { isPluginFrontmatter, serializeBoard } from "./parser";
import { BoardPickerModal, promptUser } from "./modals";
import { KanbanRenderChild } from "./embed";

export default class AdvancedKanbanPlugin extends Plugin {
  settings: AdvancedKanbanSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    if (!requireApiVersion("1.12.7")) {
      new Notice(
        "Advanced Kanban is running! For the best experience, please update Obsidian to version 1.12.7 or newer.",
                 10000
      );
    }

    
    this.registerView(VIEW_TYPE_KANBAN, (leaf) => new KanbanView(leaf, this));
    

    
    
    this.registerMarkdownCodeBlockProcessor("kanban", (source, el, ctx) => {
      const renderChild = new KanbanRenderChild(el, source, ctx, this);
      ctx.addChild(renderChild);
    });

    
    this.addRibbonIcon("layout-dashboard", "Open kanban board", async () => {
      await this.openBoard();
    });

    this.addCommand({
      id: "open-kanban-board",
      name: "Open kanban board",
      callback: async () => {
        await this.openBoard();
      },
    });

    this.addCommand({
      id: "create-kanban-board",
      name: "Create new kanban board",
      callback: async () => {
        const file = await this.createBoard();
        if (file) await this.openBoard(file);
      },
    });

    this.addCommand({
      id: "open-as-kanban",
      name: "Open current file as kanban board",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return;
        const isBoard =
          isPluginFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
        if (!isBoard) return;
        await this.openBoard(file);
      },
    });

    this.addCommand({
      id: "open-as-markdown",
      name: "Open current board as markdown",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(KanbanView);
        if (!view) return false;
        if (checking) return true;
        void view.openAsMarkdown();
        return true;
      },
    });

    
    this.addSettingTab(new AdvancedKanbanSettingTab(this.app, this));
  }

  onunload(): void {
    
    
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<AdvancedKanbanSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {}) as AdvancedKanbanSettings;
    if (!this.settings.lastOpenTimes) this.settings.lastOpenTimes = {};

    
    if (!Array.isArray(this.settings.cardTemplates) || this.settings.cardTemplates.length === 0) {
      this.settings.cardTemplates = JSON.parse(JSON.stringify(DEFAULT_CARD_TEMPLATES)) as typeof DEFAULT_CARD_TEMPLATES;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

    async openBoard(file?: TFile | null): Promise<void> {
    if (!file) {
      file = await this.pickBoard();
      if (!file) return;
    }

    if (!file || !file.path) {
      new Notice("Advanced Kanban: failed to select a board file.");
      return;
    }

    
    if (!this.settings.lastOpenTimes) this.settings.lastOpenTimes = {};
    this.settings.lastOpenTimes[file.path] = Date.now();
    this.settings.lastBoard = file.path;
    await this.saveSettings();

    const leaf = this.app.workspace.getLeaf(false) || this.app.workspace.getLeaf(true);
    if (!leaf) {
      new Notice("Advanced Kanban: no leaf available to open board.");
      return;
    }

    const viewState: ViewState = {
      type: VIEW_TYPE_KANBAN,
      state: { file: file.path },
      active: true,
    };

    try {
      await leaf.setViewState(viewState);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Advanced Kanban: failed to open board", err, file.path);
      new Notice("Advanced Kanban: failed to open board — " + message);
    }
    }

    async createBoard(): Promise<TFile | null> {
    const name = await promptUser(this.app, "New kanban board", "Board name", "My Board");
    if (!name) return null;

    const folder = this.settings.boardFolder?.trim() || "";
    if (folder && folder !== "/") {
      try {
        await this.app.vault.createFolder(folder);
      } catch {
        // ignore: folder may already exist, non-critical
      }
    }

    const fileName = this.uniqueFileName(name, folder);
    const board = createBoard(name);
    const md = serializeBoard(board);

    let file: TFile;
    try {
      file = await this.app.vault.create(fileName, md);
    } catch (err) {
      new Notice("Advanced Kanban: could not create board — " + (err as Error).message);
      return null;
    }

    return file;
  }

  private uniqueFileName(name: string, folder: string): string {
    const base = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled";
    const dir = folder && folder !== "/" ? folder + "/" : "";
    return normalizePath(`${dir}${base}.md`);
  }

  
  private async pickBoard(): Promise<TFile | null> {
    const boards = this.listBoards();
    if (boards.length === 0) {
      new Notice("No kanban boards yet — creating one.");
      return await this.createBoard();
    }
    if (boards.length === 1) return boards[0];

    return new Promise<TFile | null>((resolve) => {
      let chosen = false;
      const modal = new BoardPickerModal(
        this.app,
        boards,
        this.settings.lastOpenTimes || {},
        (file) => {
          chosen = true;
          resolve(file);
        }
      );
      const origOnClose = modal.onClose.bind(modal);
      modal.onClose = () => {
        origOnClose();
        if (!chosen) resolve(null);
      };
      modal.open();
    });
  }

  
  listBoards(): TFile[] {
    const boards: TFile[] = [];

    for (const f of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(f);
      if (cache?.frontmatter && isPluginFrontmatter(cache.frontmatter)) {
        boards.push(f);
      }
    }
    return boards;
  }

}
