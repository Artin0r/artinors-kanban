import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
  TFile,
} from "obsidian";
import { mount, unmount } from "svelte";
import Board from "./Board.svelte";
import { parseBoard, serializeBoard } from "./parser";
import { createBoardStore } from "./store.svelte";
import type { Board as BoardModel } from "./board";
import type AdvancedKanbanPlugin from "./main";

export class KanbanRenderChild extends MarkdownRenderChild {
  private plugin: AdvancedKanbanPlugin;
  private ctx: MarkdownPostProcessorContext;
  private source: string;
  private store: ReturnType<typeof createBoardStore> | null = null;
  private component: Record<string, unknown> | null = null;
  private lastSavedMarkdown: string | null = null;
  private boardModel: BoardModel | null = null;
  private linkedFile: TFile | null = null;
  private _destroyed = false;

  constructor(
    containerEl: HTMLElement,
    source: string,
    ctx: MarkdownPostProcessorContext,
    plugin: AdvancedKanbanPlugin
  ) {
    super(containerEl);
    this.plugin = plugin;
    this.ctx = ctx;
    this.source = source;
  }

  onload(): void {
    if (this._destroyed) return;

    const trimmed = this.source.trim();

    const linkMatch = trimmed.match(/^\s*\[\[([^\]]+)\]\]\s*$/);

    if (!linkMatch) {
      this.containerEl.empty();
      this.containerEl.addClass("advanced-kanban-embed");
      this.containerEl.createEl("div", {
        cls: "ak-embed-hint",
        text: "Forgot to link board? Use: ```kanban [[BoardName]] ```"
      });
      return;
    }

    this.initLinkedBoard(linkMatch[1].trim())
      .catch(err => {
        console.error("Advanced Kanban: failed to initialize linked board", err);
      });
  }

  onunload(): void {
    this._destroyed = true;

    if (this.component) {
      try {
        unmount(this.component).catch(() => {});
      } catch {
        // unmount error intentionally ignored during unload
      }
      this.component = null;
    }

    this.store = null;
    this.boardModel = null;
    this.linkedFile = null;
  }

  private async initLinkedBoard(link: string): Promise<void> {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    const linkedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
      link,
      activeFile?.path || ""
    );

    if (!linkedFile || !(linkedFile instanceof TFile)) {
      this.renderError(`Board not found: ${link}`);
      return;
    }

    this.linkedFile = linkedFile;

    let fileContent: string;
    try {
      fileContent = await this.plugin.app.vault.read(linkedFile);
    } catch {
      this.renderError(`Could not read board file: ${linkedFile.path}`);
      return;
    }

    const board = parseBoard(fileContent, linkedFile.basename);
    if (!board) {
      this.renderError("Invalid kanban board.");
      return;
    }

    this.boardModel = board;

    const lastSaved = serializeBoard(board);
    this.lastSavedMarkdown = lastSaved;

    this.store = createBoardStore(
      board,
      (b) => this.persistBoard(b),
      undefined,
      "",
      [],
      () => ({
        enabled: this.plugin.settings?.autoMoveOnComplete ?? false,
        targetColumnName: this.plugin.settings?.autoMoveTargetColumn ?? "Done",
      })
    );

    this.containerEl.empty();
    this.containerEl.addClass("advanced-kanban-embed");

    const wrapper = this.containerEl.createDiv({ cls: "ak-embed-wrapper" });
    wrapper.setCssStyles({
      display: "flex",
      flexDirection: "column",
      flex: "1",
      minHeight: "0",
    });

    
    wrapper.setAttribute("contenteditable", "false");

    
    
    
    wrapper.addEventListener("mousedown", (e) => e.stopPropagation(), { capture: true });

    
    
    const dragEvents = ["dragstart", "drag", "dragenter", "dragover", "dragleave", "drop", "dragend"] as const;
    const stopBubble: EventListener = (e: Event) => e.stopPropagation();

    for (const evt of dragEvents) {
      const eventName = evt as keyof HTMLElementEventMap;
      this.containerEl.addEventListener(eventName, stopBubble, { capture: false });
    }

    this.component = mount(Board, {
      target: wrapper,
      props: {
        store: this.store,
        app: this.plugin.app,
        plugin: this.plugin,
        view: { openAsMarkdown() {} },
        sourcePath: this.ctx.sourcePath,
        embedded: true,
        embedKey: `embed-${this.linkedFile.path}`,
      },
    }) as Record<string, unknown>;
  }

  private async persistBoard(board: BoardModel): Promise<void> {
    if (this._destroyed || !this.store || !this.linkedFile) return;

    let md: string;
    try {
      md = serializeBoard(board);
    } catch (err) {
      console.error("Advanced Kanban: failed to serialize linked board", err);
      return;
    }

    if (this.lastSavedMarkdown === md) return;
    this.lastSavedMarkdown = md;

    try {
      await this.plugin.app.vault.modify(this.linkedFile, md);
    } catch (err) {
      console.error("Advanced Kanban: failed to write linked board file", err);
    }
  }

  private renderError(message: string): void {
    this.containerEl.empty();
    this.containerEl.addClass("advanced-kanban-embed");
    this.containerEl.createEl("div", {
      cls: "ak-embed-error",
      text: message,
    });
  }
}
