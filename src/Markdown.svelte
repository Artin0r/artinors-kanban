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

    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest('a');
      if (!link) return;
      const href = (link.getAttribute('data-href') || link.getAttribute('href') || '').replace(/^#/, '');
      if (!href) return;

      if (link.classList.contains('internal-link')) {
        e.preventDefault();
        e.stopPropagation();
        void app.workspace.openLinkText(href, sourcePath || '', false);
        return;
      }

      if (href.startsWith('file://')) {
        e.preventDefault();
        e.stopPropagation();
        const fullPath = href.replace(/^file:\/\//, '');
        const vaultRoot = (app.vault.adapter as any).getBasePath?.() ?? '';
        if (vaultRoot && fullPath.startsWith(vaultRoot)) {
          const relPath = fullPath.slice(vaultRoot.length).replace(/^\//, '');
          void app.workspace.openLinkText(relPath, '');
        }
        return;
      }
    };

    el.addEventListener('click', onClick);

    return () => {
      el.removeEventListener('click', onClick);
      el.empty();
      MarkdownRenderer.render(app, "", el, sourcePath, component);
    };
  });
</script>

<div bind:this={el} class="ak-md"></div>
