<script lang="ts">
  import type { App, Component } from "obsidian";
  import type { Column } from "./board";
  import { ARCHIVE_COLUMN_ID } from "./board";
  import type { BoardStore } from "./store.svelte";
  import Card from "./Card.svelte";
  import { iconAction } from "./actions";

  let {
    column,
    store,
    app,
    plugin,
    sourcePath,
    cardTemplates,
    dragCardId,
    dragColumnId,
    dropTarget,
    embedKey,
    onCardDragStart,
    onCardDragEnd,
    onEditCard,
    onColumnDragOver,
    onColumnDrop,
    onColumnHeaderDragStart,
    onColumnHeaderDragEnd,
    onColumnHeaderDragOver,
    onColumnHeaderDrop,
    onColumnSettings,
    onAddCard,
  }: {
    column: Column;
    store: BoardStore;
    app: App;
    plugin: Component;
    sourcePath: string;
    cardTemplates: Array<any>;
    dragCardId: string | null;
    dragColumnId: string | null;
    dropTarget: { columnId: string; index: number } | null;
    embedKey?: string;
    onCardDragStart: (cardId: string, e: DragEvent) => void;
    onCardDragEnd: () => void;
    onEditCard: (card: import("./board").Card) => void;
    onColumnDragOver: (columnId: string, e: DragEvent) => void;
    onColumnDrop: (columnId: string, e: DragEvent) => void;
    onColumnHeaderDragStart: (columnId: string, e: DragEvent) => void;
    onColumnHeaderDragEnd: () => void;
    onColumnHeaderDragOver: (columnId: string, e: DragEvent) => void;
    onColumnHeaderDrop: (columnId: string, e: DragEvent) => void;
    onColumnSettings: (column: Column) => void;
    onAddCard: (column: Column, partial?: Partial<import("./board").Card>) => void;
  } = $props();

  const baseCards = $derived(column.cards.filter((c) => store.matches(c)));

  const visibleCards = $derived.by(() => {
    const mode = column.sort ?? "manual";
    if (mode === "manual") return baseCards;

    const sorted = [...baseCards];
    if (mode === "due") {
      sorted.sort((a, b) => {
        const aHas = !!a.due;
        const bHas = !!b.due;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (!aHas && !bHas) return 0;
        return (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99");
      });
    } else if (mode === "alpha") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return sorted;
  });
  const isArchive = $derived(column.id === ARCHIVE_COLUMN_ID);
  const overLimit = $derived(column.wip > 0 && column.cards.length > column.wip);
  const isCardDropTarget = $derived(!!dragCardId && dropTarget?.columnId === column.id);
  const isColumnDropTarget = $derived(!!dragColumnId && dropTarget?.columnId === column.id && dragColumnId !== column.id);

  
  
  let placeholderIndex = $derived(isCardDropTarget ? dropTarget!.index : -1);

  function dragOver(e: DragEvent) {
    if (!dragCardId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    onColumnDragOver(column.id, e);
  }

  function drop(e: DragEvent) {
    if (!dragCardId) return;
    e.preventDefault();
    onColumnDrop(column.id, e);
  }

  let showTemplates = $state(false);
  let templateButtonRef: HTMLButtonElement;
  let templateMenuEl: HTMLDivElement | null = null;

  function closeTemplateMenu() {
    showTemplates = false;
    if (templateMenuEl) {
      templateMenuEl.remove();
      templateMenuEl = null;
    }
  }

  function openTemplateMenu(e: MouseEvent) {
    e.stopPropagation();
    closeTemplateMenu();
    closeSortMenu();
    if (!templateButtonRef || !cardTemplates.length) return;

    const rect = templateButtonRef.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "ak-template-menu";
    menu.style.position = "fixed";
    menu.style.zIndex = "9999";
    menu.style.top = rect.bottom + "px";
    menu.style.left = rect.left + "px";
    menu.style.minWidth = "140px";
    menu.style.fontSize = "0.78rem";
    menu.style.padding = "2px 0";

    for (const t of cardTemplates) {
      const item = document.createElement("div");
      item.className = "ak-template-menu-item";
      item.textContent = t.label;
      item.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        const partial: any = {
          title: t.title,
          body: t.body,
          due: t.due,
          recur: t.recur,
          tags: t.tags,
          color: t.color,
          fields: t.fields,
          checklist: t.checklist,
        };
        onAddCard(column, partial);
        closeTemplateMenu();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    templateMenuEl = menu;
    showTemplates = true;
  }

  let showSort = $state(false);
  let sortButtonRef: HTMLButtonElement;
  let sortMenuEl: HTMLDivElement | null = null;

  function closeSortMenu() {
    showSort = false;
    if (sortMenuEl) {
      sortMenuEl.remove();
      sortMenuEl = null;
    }
  }

  function openSortMenu(e: MouseEvent) {
    e.stopPropagation();
    closeSortMenu();
    closeTemplateMenu();
    if (!sortButtonRef) return;

    const rect = sortButtonRef.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "ak-sort-menu";
    menu.style.position = "fixed";
    menu.style.zIndex = "9999";
    menu.style.top = rect.bottom + "px";
    menu.style.left = rect.left + "px";
    menu.style.minWidth = "140px";
    menu.style.fontSize = "0.78rem";
    menu.style.padding = "2px 0";

    const modes = [
      { v: "manual" as const, label: "Manual" },
      { v: "due" as const, label: "Due date (soonest first)" },
      { v: "alpha" as const, label: "Alphabetical (A–Z)" },
    ];

    for (const m of modes) {
      const item = document.createElement("div");
      item.className = "ak-sort-menu-item";
      item.textContent = m.label;
      if ((column.sort ?? "manual") === m.v) {
        item.style.fontWeight = "600";
        item.style.color = "var(--text-accent)";
      }
      item.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        store.setColumnSort(column.id, m.v);
        closeSortMenu();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    sortMenuEl = menu;
    showSort = true;
  }

  $effect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const inTemplateMenu = t && t.closest(".ak-template-menu");
      const inSortMenu = t && t.closest(".ak-sort-menu");
      const inWrap = t && t.closest(".ak-column-controls");
      if (!inTemplateMenu && !inWrap && showTemplates) {
        closeTemplateMenu();
      }
      if (!inSortMenu && !inWrap && showSort) {
        closeSortMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      closeTemplateMenu();
      closeSortMenu();
    };
  });
</script>


<section
  class="ak-column"
  class:is-collapsed={column.collapsed}
  class:is-over-limit={overLimit}
  class:is-card-target={isCardDropTarget}
  class:is-column-target={isColumnDropTarget}
  class:is-archive={isArchive}
  data-column={column.id}
  ondragover={dragOver}
  ondrop={drop}

>
  
  <header
    class="ak-column-header"
    draggable="true"
    ondragstart={(e) => onColumnHeaderDragStart(column.id, e)}
    ondragend={onColumnHeaderDragEnd}
    ondragover={(e) => onColumnHeaderDragOver(column.id, e)}
    ondrop={(e) => onColumnHeaderDrop(column.id, e)}
  >
    <span class="ak-column-grip" use:iconAction={"grip-vertical"}></span>
    {#if column.color}
      <span class="ak-column-dot" style="background:{column.color}"></span>
    {/if}
    <span class="ak-column-name">{column.name}</span>
    <span class="ak-column-count" class:is-over={overLimit} title={column.wip > 0 ? `Card limit: ${column.wip}` : ""}>
      {column.cards.length}{column.wip > 0 ? ` / ${column.wip}` : ""}
    </span>
    <div class="ak-column-controls">
      <button class="ak-icon-btn" title="Add card" onclick={() => onAddCard(column)}>
        <span use:iconAction={"plus"}></span>
      </button>
      <button
        bind:this={templateButtonRef}
        class="ak-icon-btn"
        title="Add card from template"
        onclick={openTemplateMenu}
      >
        <span use:iconAction={"layout-template"}></span>
      </button>
      <button class="ak-icon-btn" title="Column settings" onclick={() => onColumnSettings(column)}>
        <span use:iconAction={"settings"}></span>
      </button>
      <button
        bind:this={sortButtonRef}
        class="ak-icon-btn"
        title="Sort cards"
        onclick={openSortMenu}
      >
        <span use:iconAction={"sort-asc"}></span>
      </button>
      <button
        class="ak-icon-btn"
        title={column.collapsed ? "Expand" : "Collapse"}
        onclick={() => store.toggleCollapse(column.id)}
      >
        <span use:iconAction={column.collapsed ? "chevrons-right" : "chevrons-down"}></span>
      </button>
    </div>
  </header>

  {#if !column.collapsed}
    <div class="ak-column-cards">
      {#each visibleCards as card, i (card.id)}
        {#if placeholderIndex === i}
          <div class="ak-drop-placeholder"></div>
        {/if}
        <Card
          {card}
          {store}
          {app}
          {plugin}
          {sourcePath}
          onDragStart={onCardDragStart}
          onDragEnd={onCardDragEnd}
          onEdit={onEditCard}
        />
      {/each}
      {#if placeholderIndex >= visibleCards.length}
        <div class="ak-drop-placeholder"></div>
      {/if}
      {#if visibleCards.length === 0 && placeholderIndex < 0}
        <div class="ak-column-empty">Drop cards here</div>
      {/if}
      <button class="ak-add-card" onclick={() => onAddCard(column)}>
        <span use:iconAction={"plus"}></span> Add a card
      </button>
    </div>
  {:else}
    <div class="ak-column-collapsed-body">
      <button class="ak-add-card" onclick={() => store.toggleCollapse(column.id)}>Expand ({column.cards.length})</button>
    </div>
  {/if}
</section>
