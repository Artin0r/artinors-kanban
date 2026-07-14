<script lang="ts">
  import type { Column } from "./board";
  import { iconAction } from "./actions";

  let {
    column,
    onSave,
    onDelete,
    onCancel,
  }: {
    column: Column;
    onSave: (name: string, color: string, wip: number) => void;
    onDelete: () => void;
    onCancel: () => void;
  } = $props();

  
  let name = $state(column.name);
  
  let color = $state(column.color);
  
  
  
  let wipStr = $state(column.wip > 0 ? String(column.wip) : "");

  function save() {
    const w = wipStr.trim() === "" ? 0 : Math.max(0, parseInt(wipStr, 10) || 0);
    onSave(name.trim() || "Column", color, w);
  }
</script>

<div class="ak-colsettings">
  <div class="ak-editor-row">
    <label for="ak-colname">Column name</label>
    <input id="ak-colname" type="text" bind:value={name} />
  </div>
  <div class="ak-editor-grid">
    <div class="ak-editor-row">
      <label for="ak-colcolor">Accent color</label>
      <div class="ak-color-row">
        <input id="ak-colcolor" type="color" bind:value={color} />
        <button class="ak-btn ak-btn-secondary" onclick={() => (color = "")}>Clear</button>
      </div>
    </div>
    <div class="ak-editor-row">
      <label for="ak-colwip">Card limit <span class="ak-hint">(0 = no limit)</span></label>
      <input id="ak-colwip" type="text" inputmode="numeric" pattern="[0-9]*" bind:value={wipStr} placeholder="0" />
    </div>
  </div>
  <div class="ak-editor-footer">
    <button class="ak-btn ak-btn-danger" onclick={onDelete} title="Delete column">
      <span use:iconAction={"trash"}></span> Delete
    </button>
    <div class="ak-editor-footer-right">
      <button class="ak-btn ak-btn-secondary" onclick={onCancel}>Cancel</button>
      <button class="ak-btn ak-btn-primary" onclick={save}>Save</button>
    </div>
  </div>
</div>
