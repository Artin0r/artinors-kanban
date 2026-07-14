<script lang="ts">
  import type { App, Component } from "obsidian";
  import { Menu } from "obsidian";
  import type { Card, Column } from "./board";
  import { ARCHIVE_COLUMN_ID } from "./board";
  import type { BoardStore } from "./store.svelte";
  import ColumnCmp from "./Column.svelte";
  import { iconAction } from "./actions";
  import { CardEditorModal, ColumnSettingsModal } from "./modals";
  import { exportBoardAsCSV, exportBoardAsTrelloJSON, importBoardFromCSV, importBoardFromTrelloJSON } from "./export";
  type KanbanViewLike = { openAsMarkdown(): void };

  let {
    store,
    app,
    plugin,
    view,
    sourcePath,
    embedded = false,
    embedKey,
  }: {
    store: BoardStore;
    app: App;
    plugin: Component;
    view: KanbanViewLike;
    sourcePath: string;
    embedded?: boolean;
    embedKey?: string;
  } = $props();

  
  let dragCardId = $state<string | null>(null);
  let dragColumnId = $state<string | null>(null);
  let dropTarget = $state<{ columnId: string; index: number } | null>(null);

  
  let editingName = $state(false);
  let nameDraft = $state("");

  const visibleColumns = $derived(
    store.board.columns.filter(
      (c) => !(c.id === ARCHIVE_COLUMN_ID && store.board.settings.hideArchive)
    )
  );

  function startEditName() {
    nameDraft = store.board.name;
    editingName = true;
  }
  function commitName() {
    const name = nameDraft.trim() || "Untitled board";
    store.setBoardName(name);
    editingName = false;
  }

  function handleBoardNameContext(e: MouseEvent) {
    e.preventDefault();
    const menu = new Menu();
    const boardName = store.board.name || "board";

    menu.addItem((item) => {
      item.setTitle("Export as CSV");
      item.onClick(() => {
        exportBoardAsCSV(store.board, boardName);
      });
    });
    menu.addItem((item) => {
      item.setTitle("Export as Trello JSON");
      item.onClick(() => {
        exportBoardAsTrelloJSON(store.board, boardName);
      });
    });

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle("Import from CSV");
      item.onClick(() => {
        openImportFile(".csv", (text) => {
          importBoardFromCSV(store.board, text);
          store.setBoard(store.board);
        });
      });
    });
    menu.addItem((item) => {
      item.setTitle("Import from Trello JSON");
      item.onClick(() => {
        openImportFile(".json", (text) => {
          importBoardFromTrelloJSON(store.board, text);
          store.setBoard(store.board);
        });
      });
    });

    menu.showAtMouseEvent(e);
  }

  function openImportFile(accept: string, onText: (text: string) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string).trim();
        if (text) onText(text);
      };
      reader.readAsText(file);
    });
    input.click();
  }

  
  function onCardDragStart(cardId: string, e: DragEvent) {
    dragColumnId = null;
    dragCardId = cardId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", cardId);
    }
  }

  function onCardDragEnd() {
    dragCardId = null;
    dropTarget = null;
  }

  function onColumnDragOver(columnId: string, e: DragEvent) {
    if (!dragCardId) return;
    e.preventDefault();

    const hovered = e.target as HTMLElement | null;
    const cardEl = hovered?.closest<HTMLElement>("[data-card]");
    const column = store.board.columns.find(c => c.id === columnId);

    if (!column) return;

    if (!cardEl) {
      dropTarget = { columnId, index: column.cards.length };
      return;
    }

    const hoveredId = cardEl.getAttribute("data-card");
    if (!hoveredId || hoveredId === dragCardId) return;

    const idx = column.cards.findIndex(c => c.id === hoveredId);
    if (idx === -1) {
      dropTarget = { columnId, index: column.cards.length };
      return;
    }

    const rect = cardEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    dropTarget = {
      columnId,
      index: e.clientY < midY ? idx : idx + 1,
    };
  }

  function onColumnDrop(columnId: string, e: DragEvent) {
    if (!dragCardId) return;
    e.preventDefault();
    if (dropTarget && dropTarget.columnId) {
      store.moveCard(dragCardId, dropTarget.columnId, dropTarget.index);
    }
    dragCardId = null;
    dropTarget = null;
  }

  
  function onColumnHeaderDragStart(columnId: string, e: DragEvent) {
    dragCardId = null;
    dragColumnId = columnId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "column:" + columnId);
    }
  }
  function onColumnHeaderDragEnd() {
    dragColumnId = null;
    dropTarget = null;
  }
  function onColumnHeaderDragOver(columnId: string, e: DragEvent) {
    if (!dragColumnId) return;
    e.preventDefault();
    const index = store.board.columns.findIndex((c) => c.id === columnId);
    dropTarget = { columnId, index };
  }
  function onColumnHeaderDrop(columnId: string, e: DragEvent) {
    if (!dragColumnId) return;
    e.preventDefault();
    const toIndex = store.board.columns.findIndex((c) => c.id === columnId);
    store.moveColumn(dragColumnId, toIndex);
    dragColumnId = null;
    dropTarget = null;
  }

  
  function openCardEditor(card: Card) {
    store.pauseSave();
    new CardEditorModal(
      app,
      plugin,
      sourcePath,
      card,
      (updated) => {
        store.updateCard(updated);
        store.resumeSave();
      },
      () => store.resumeSave()
    ).open();
  }

  function onAddCard(column: Column, templatePartial?: Partial<Card>) {
    store.pauseSave();
    const card = store.addCard(column.id, templatePartial ?? { title: "New card" });
    const isPristine = (c: Card) =>
      c.title === "New card" && !c.body && !c.due && c.tags.length === 0 &&
      c.fields.length === 0 && c.checklist.length === 0;
    new CardEditorModal(
      app,
      plugin,
      sourcePath,
      card,
      (updated) => {
        store.updateCard(updated);
        store.resumeSave();
      },
      () => {
        
        const fresh = store.board.columns
          .flatMap((c) => c.cards)
          .find((c) => c.id === card.id);
        if (fresh && isPristine(fresh)) store.deleteCard(card.id);
        store.resumeSave();
      }
    ).open();
  }

  const cardTemplates = $derived(
    (plugin.settings?.cardTemplates as Array<any>) ?? []
  );

  function openColumnSettings(column: Column) {
    store.pauseSave();
    new ColumnSettingsModal(
      app,
      column,
      (name, color, wip) => {
        store.renameColumn(column.id, name);
        store.setColumnColor(column.id, color);
        store.setColumnWip(column.id, wip);
        store.resumeSave();
      },
      () => {
        store.deleteColumn(column.id);
        store.resumeSave();
      },
      () => store.resumeSave()
    ).open();
  }

  function addColumn() {
    store.pauseSave();
    const col = store.addColumn("New column");
    if (col) {
      openColumnSettings(col);
    } else {
      store.resumeSave();
    }
  }

  function openAsMarkdown() {
    view.openAsMarkdown();
  }
</script>

<div class="ak-board" class:is-embedded={embedded}>
  <div class="ak-toolbar">
    <div class="ak-toolbar-left">
      {#if embedded}
        <span class="ak-board-name ak-board-name-static" oncontextmenu={handleBoardNameContext}>{store.board.name}</span>
      {:else if editingName}
        <input
          class="ak-board-name-input"
          type="text"
          bind:value={nameDraft}
          onblur={commitName}
          onkeydown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") editingName = false; }}
        />
      {:else}
        <button
          type="button"
          class="ak-board-name"
          onclick={startEditName}
          oncontextmenu={handleBoardNameContext}
          title="Click to rename"
        >{store.board.name}</button>
      {/if}
    </div>

    <div class="ak-toolbar-center">
      <div class="ak-search">
        <span class="ak-search-icon" use:iconAction={"search"}></span>
        <input
          type="text"
          class="ak-search-input"
          placeholder="Search cards…"
          bind:value={store.search}
        />
        {#if store.search}
          <button class="ak-search-clear" title="Clear search" onclick={() => (store.search = "")}><span use:iconAction={"x"}></span></button>
        {/if}
      </div>
      {#if store.activeTags.length > 0}
        <div class="ak-tag-filter">
          {#each store.activeTags as tag}
            <button
              class="ak-tag-chip is-active"
              onclick={() => store.toggleTag(tag)}
              title="Remove tag filter"
            >#{tag}</button>
          {/each}
        </div>
      {/if}
      {#if store.activeTags.length || store.search}
        <button class="ak-btn ak-btn-secondary" onclick={() => store.clearFilters()}>Clear</button>
      {/if}
    </div>

    {#if !embedded}
      <div class="ak-toolbar-right">
        <button class="ak-btn ak-btn-secondary" onclick={() => store.toggleArchiveVisibility()} title="Toggle archive column">
          <span use:iconAction={"archive"}></span> Archive
        </button>
        <button class="ak-btn ak-btn-secondary" onclick={openAsMarkdown} title="Open as markdown">
          <span use:iconAction={"file-text"}></span> Markdown
        </button>
        <button class="ak-btn ak-btn-primary" onclick={addColumn} title="Add column">
          <span use:iconAction={"plus"}></span> Column
        </button>
      </div>
    {:else}
      <div class="ak-toolbar-right">
        <button class="ak-btn ak-btn-secondary" onclick={() => store.toggleArchiveVisibility()} title="Toggle archive column">
          <span use:iconAction={"archive"}></span> Archive
        </button>
        <button class="ak-btn ak-btn-primary" onclick={addColumn} title="Add column">
          <span use:iconAction={"plus"}></span> Column
        </button>
      </div>
    {/if}
  </div>

  <div class="ak-columns is-scroll">
    {#each visibleColumns as column (column.id)}
      <ColumnCmp
        {column}
        {store}
        {app}
        {plugin}
        {sourcePath}
        {cardTemplates}
        dragCardId={dragCardId}
        dragColumnId={dragColumnId}
        {dropTarget}
        {embedded}
        {embedKey}
        onCardDragStart={onCardDragStart}
        onCardDragEnd={onCardDragEnd}
        onEditCard={openCardEditor}
        onColumnDragOver={onColumnDragOver}
        onColumnDrop={onColumnDrop}
        onColumnHeaderDragStart={onColumnHeaderDragStart}
        onColumnHeaderDragEnd={onColumnHeaderDragEnd}
        onColumnHeaderDragOver={onColumnHeaderDragOver}
        onColumnHeaderDrop={onColumnHeaderDrop}
        onColumnSettings={openColumnSettings}
        onAddCard={onAddCard}
      />
    {/each}
  </div>
</div>
