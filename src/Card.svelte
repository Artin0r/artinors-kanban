<script lang="ts">
  import type { App, Component } from "obsidian";
  import type { Card } from "./board";
  import { ARCHIVE_COLUMN_ID } from "./board";
  import type { BoardStore } from "./store.svelte";
  import Markdown from "./Markdown.svelte";
  import { iconAction, formatDueDate, dueStatus } from "./actions";

  let {
    card,
    store,
    app,
    plugin,
    sourcePath,
    dimmed = false,
    onDragStart,
    onDragEnd,
    onEdit,
  }: {
    card: Card;
    store: BoardStore;
    app: App;
    plugin: Component;
    sourcePath: string;
    dimmed?: boolean;
    onDragStart: (cardId: string, e: DragEvent) => void;
    onDragEnd: () => void;
    onEdit: (card: Card) => void;
  } = $props();

  const status = $derived(dueStatus(card.due));

  const checklistTotal = $derived(card.checklist.length);
  const checklistDone = $derived(card.checklist.filter((i) => i.checked).length);
  const checklistPct = $derived(
    checklistTotal === 0 ? 0 : Math.round((checklistDone / checklistTotal) * 100)
  );

  function toggleChecklistItem(index: number) {
    const next = { ...card, checklist: card.checklist.map((it, i) => i === index ? { ...it, checked: !it.checked } : it) };
    store.updateCard(next);
  }

  function archive() {
    store.archiveCard(card.id);
  }

  function remove() {
    store.deleteCard(card.id);
  }

  let showMoveMenu = $state(false);
  let moveButtonRef: HTMLButtonElement;
  let moveMenuEl: HTMLDivElement | null = null;

  function closeMoveMenu() {
    showMoveMenu = false;
    if (moveMenuEl) {
      moveMenuEl.remove();
      moveMenuEl = null;
    }
  }

  function openMoveMenu(e: MouseEvent) {
    e.stopPropagation();
    closeMoveMenu();
    if (!moveButtonRef || otherColumns.length === 0) return;

    const rect = moveButtonRef.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'ak-move-menu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '9999';
    menu.style.top = rect.top + 'px';
    menu.style.left = (rect.right + 4) + 'px';
    menu.style.minWidth = '90px';
    menu.style.maxWidth = '150px';
    menu.style.maxHeight = '160px';
    menu.style.fontSize = '0.75rem';
    menu.style.padding = '2px 0';
    menu.style.overflowY = 'auto';
    menu.style.boxSizing = 'border-box';

    for (const col of otherColumns) {
      const item = document.createElement('div');
      item.className = 'ak-move-menu-item';
      item.textContent = col.name;
      item.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        store.moveCard(card.id, col.id, col.cards.length);
        closeMoveMenu();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    moveMenuEl = menu;
    showMoveMenu = true;
  }

  $effect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const inMenu = t && t.closest('.ak-move-menu');
      const inWrap = t && t.closest('.ak-card-btn-wrap');
      if (!inMenu && !inWrap && showMoveMenu) {
        closeMoveMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      closeMoveMenu();
    };
  });

  const otherColumns = $derived(
    store.board.columns
      .filter(c => c.id !== ARCHIVE_COLUMN_ID && c.id !== (store.board.columns.find(col =>
        col.cards.some(c => c.id === card.id)
      )?.id))
  );

  let tagsExpanded = $state(false);
</script>


<div
  class="ak-card"
  class:is-dimmed={dimmed}
  class:is-done={card.checked}
  data-card={card.id}
  draggable="true"
  ondragstart={(e) => onDragStart(card.id, e)}
  ondragend={onDragEnd}
  onmousedown={(e) => e.stopPropagation()}
  onpointerdown={(e) => e.stopPropagation()}
  onkeydown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEdit(card);
    }
  }}

  role="button"
  tabindex="0"
>
  {#if card.color}
    <div class="ak-card-cover" style="background: var(--ak-color-{card.color}, var(--text-muted));"></div>
  {/if}

  <div class="ak-card-actions">
    <button class="ak-card-btn" title="Edit" onclick={(e) => { e.stopPropagation(); onEdit(card); }}><span use:iconAction={"pencil"}></span></button>
    <button class="ak-card-btn" title="Archive" onclick={(e) => { e.stopPropagation(); archive(); }}><span use:iconAction={"archive"}></span></button>
    <button class="ak-card-btn" title="Delete" onclick={(e) => { e.stopPropagation(); remove(); }}><span use:iconAction={"trash"}></span></button>
    <div class="ak-card-btn-wrap">
      <button
        bind:this={moveButtonRef}
        class="ak-card-btn"
        title="Move to column"
        onclick={openMoveMenu}
      ><span use:iconAction={"shuffle"}></span></button>
    </div>
  </div>

  <div class="ak-card-body">
    {#if card.tags.length}
      <div class="ak-card-tags">
        {#if card.tags.length <= 3}
          {#each card.tags as tag}
            <button
              type="button"
              class="ak-tag"
              class:is-active={store.activeTags.includes(tag)}
              onclick={(e) => { e.stopPropagation(); store.toggleTag(tag); }}
            >#{tag}</button>
          {/each}
        {:else}
          {#each card.tags.slice(0, 3) as tag}
            <button
              type="button"
              class="ak-tag"
              class:is-active={store.activeTags.includes(tag)}
              onclick={(e) => { e.stopPropagation(); store.toggleTag(tag); }}
            >#{tag}</button>
          {/each}
          {#if !tagsExpanded}
            <button
              type="button"
              class="ak-tag ak-tag-more"
              title="Show {card.tags.length - 3} more tag(s)"
              onclick={(e) => { e.stopPropagation(); tagsExpanded = true; }}
            >+{card.tags.length - 3}</button>
          {:else}
            {#each card.tags.slice(3) as tag}
              <button
                type="button"
                class="ak-tag"
                class:is-active={store.activeTags.includes(tag)}
                onclick={(e) => { e.stopPropagation(); store.toggleTag(tag); }}
              >#{tag}</button>
            {/each}
            <button
              type="button"
              class="ak-tag ak-tag-more"
              title="Show less"
              onclick={(e) => { e.stopPropagation(); tagsExpanded = false; }}
            >...</button>
          {/if}
        {/if}
      </div>
    {/if}

    <div class="ak-card-title">
      <Markdown {app} sourcePath={sourcePath} markdown={card.title || "Untitled"} component={plugin} />
    </div>

    {#if card.due}
      <div class="ak-card-due ak-due-{status}">
        <span class="ak-icon-sm" use:iconAction={"calendar-clock"}></span>
        {formatDueDate(card.due)}
      </div>
    {/if}

    {#if card.recur}
      <div class="ak-card-recur" title="Recurring">
        <span class="ak-icon-sm" use:iconAction={"repeat-2"}></span>
      </div>
    {/if}

    {#if card.fields.length}
      <div class="ak-card-fields">
        {#each card.fields as f}
          {#if f.name}
            <span class="ak-field"><span class="ak-field-name">{f.name}</span><span class="ak-field-value">{f.value}</span></span>
          {/if}
        {/each}
      </div>
    {/if}

    {#if checklistTotal > 0}
      <div class="ak-checklist">
        <div class="ak-checklist-progress">
          <div class="ak-progress-bar"><div class="ak-progress-fill" style="width:{checklistPct}%"></div></div>
          <span class="ak-progress-text">{checklistDone}/{checklistTotal}</span>
        </div>
        <ul class="ak-checklist-items">
          {#each card.checklist as item, i}
            <li>
              <input type="checkbox" checked={item.checked} onclick={(e) => e.stopPropagation()} onchange={() => toggleChecklistItem(i)} />
              <span class:is-checked={item.checked}>{item.text}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if card.body && card.body.trim()}
      <div class="ak-card-content">
        <Markdown {app} sourcePath={sourcePath} markdown={card.body} component={plugin} />
      </div>
    {/if}
  </div>
</div>