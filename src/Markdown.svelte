<script lang="ts">
  import { MarkdownRenderer } from "obsidian";
  import type { App, Component } from "obsidian";

  let {
    app,
    sourcePath,
    markdown,
    component,
  }: {
    app: App;
    sourcePath: string;
    markdown: string;
    component: Component;
  } = $props();

  let el: HTMLElement;

  $effect(() => {
    const md = markdown;
    if (!el) return;
    el.empty();
    if (md && md.trim()) {
      MarkdownRenderer.render(app, md, el, sourcePath, component);
    }

    
    return () => {
      el.empty();
      MarkdownRenderer.render(app, "", el, sourcePath, component);
    };
  });
</script>

<div bind:this={el} class="ak-md"></div>
