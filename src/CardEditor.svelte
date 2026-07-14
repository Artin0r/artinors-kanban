<script lang="ts">
  import type { App, Component } from "obsidian";
  import type { Card, CardField, ChecklistItem, RecurInterval } from "./board";
  import { DEFAULT_COLORS } from "./board";
  import { iconAction, todayISO, resolveDateShortcut } from "./actions";

  let {
    card,
    app,
    plugin,
    sourcePath,
    onSave,
    onCancel,
  }: {
    card: Card;
    app: App;
    plugin: Component;
    sourcePath: string;
    onSave: (card: Card) => void;
    onCancel: () => void;
  } = $props();

  
  
  
  let title = $state(card.title);
  
  let body = $state(card.body);
  
  let due = $state(card.due ?? "");

  let recurInterval = $state(card.recur?.interval ?? "");
  
  let color = $state(card.color);
  
  let tagsText = $state(card.tags.map((t) => "#" + t).join(" "));
  
  let fields = $state<CardField[]>(card.fields.map((f) => ({ ...f })));
  
  let checklist = $state<ChecklistItem[]>(card.checklist.map((i) => ({ ...i })));

  const colorKeys = $derived(Object.keys(DEFAULT_COLORS));

  function addField() {
    fields.push({ name: "", value: "" });
  }
  function removeField(i: number) {
    fields.splice(i, 1);
  }
  function addChecklistItem() {
    checklist.push({ text: "", checked: false });
  }
  function removeChecklistItem(i: number) {
    checklist.splice(i, 1);
  }

  function parseTags(text: string): string[] {
    return text
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter((t) => t.length > 0);
  }

  function save() {
    const recur = (recurInterval && ["daily", "weekly", "biweekly", "monthly"].includes(recurInterval))
      ? { interval: recurInterval as RecurInterval }
      : null;
    const updated: Card = {
      ...card,
      title: title.trim() || "Untitled",
      body: body.trim(),
      due: due ? due : null,
      recur,
      color,
      tags: parseTags(tagsText),
      fields: fields.filter((f) => f.name.trim() || f.value.trim()),
      checklist: checklist
        .filter((i) => i.text.trim())
        .map((i) => ({ text: i.text.trim(), checked: i.checked })),
    };
    onSave(updated);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onCancel();
    }
  }

  function onDueBlur() {
    if (!due) return;
    const resolved = resolveDateShortcut(due);
    if (resolved && resolved !== due) {
      due = resolved;
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="ak-editor">
  <div class="ak-editor-row">
    <label for="ak-title">Title</label>
    <input id="ak-title" type="text" bind:value={title} placeholder="Card title (supports [[wikilinks]])" />
  </div>

  <div class="ak-editor-row">
    <label for="ak-body">Description / body (markdown)</label>
    <textarea id="ak-body" bind:value={body} rows="4" placeholder="Add notes, [[links]], details…"></textarea>
  </div>

  <div class="ak-editor-grid">
    <div class="ak-editor-row">
      <label for="ak-due">Due date <span class="ak-hint">(today, tom, +3d, next mon, eom)</span></label>
      <input
        id="ak-due"
        type="text"
        bind:value={due}
        placeholder="YYYY-MM-DD or shortcut"
        onblur={onDueBlur}
      />
    </div>
    <div class="ak-editor-row">
      <label for="ak-recur">Repeats</label>
      <select id="ak-recur" bind:value={recurInterval}>
        <option value="">None</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
  </div>

  <div class="ak-editor-grid">
    <div class="ak-editor-row">
      <label for="ak-color">Cover color</label>
      <select id="ak-color" bind:value={color}>
        {#each colorKeys as k}
          <option value={k}>{k === "" ? "None" : k}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="ak-editor-row">
    <label for="ak-tags">Tags</label>
    <input id="ak-tags" type="text" bind:value={tagsText} placeholder="#urgent #work" />
  </div>

  <div class="ak-editor-row">
    <div class="ak-editor-label-row">
      
      <label>Custom fields</label>
      <button class="ak-editor-add" onclick={addField} title="Add field"><span use:iconAction={"plus"}></span></button>
    </div>
    <div class="ak-fields-list">
      {#each fields as f, i}
        <div class="ak-field-row">
          <input type="text" bind:value={f.name} placeholder="name (e.g. estimate)" />
          <input type="text" bind:value={f.value} placeholder="value (e.g. 2h)" />
          <button class="ak-editor-remove" onclick={() => removeField(i)} title="Remove"><span use:iconAction={"x"}></span></button>
        </div>
      {/each}
      {#if fields.length === 0}
        <div class="ak-empty-hint">No custom fields yet.</div>
      {/if}
    </div>
  </div>

  <div class="ak-editor-row">
    <div class="ak-editor-label-row">
      
      <label>Checklist</label>
      <button class="ak-editor-add" onclick={addChecklistItem} title="Add item"><span use:iconAction={"plus"}></span></button>
    </div>
    <div class="ak-checklist-list">
      {#each checklist as item, i}
        <div class="ak-checklist-row">
          <input type="checkbox" bind:checked={item.checked} />
          <input type="text" bind:value={item.text} placeholder="Subtask…" />
          <button class="ak-editor-remove" onclick={() => removeChecklistItem(i)} title="Remove"><span use:iconAction={"x"}></span></button>
        </div>
      {/each}
      {#if checklist.length === 0}
        <div class="ak-empty-hint">No checklist items yet.</div>
      {/if}
    </div>
  </div>

  <div class="ak-editor-footer">
    <button class="ak-btn ak-btn-secondary" onclick={onCancel}>Cancel</button>
    <button class="ak-btn ak-btn-primary" onclick={save}>Save card</button>
  </div>
</div>
