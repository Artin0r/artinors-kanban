import { App, TFile } from "obsidian";

export function createWikilinkSuggest(
  app: App,
  el: HTMLInputElement | HTMLTextAreaElement
) {
  let popup: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let currentFiles: TFile[] = [];

  function getLinkInfo() {
    const cursor = el.selectionStart ?? 0;
    const before = el.value.substring(0, cursor);
    const m = before.match(/\[\[([^\]]*)$/);
    if (!m) return null;
    return {
      query: m[1].trim().toLowerCase(),
      matchIndex: m.index ?? before.lastIndexOf("[["),
    };
  }

  function findFiles(query: string): TFile[] {
    const all = app.vault.getMarkdownFiles();
    if (!query) return all;
    return all.filter((f) => {
      const base = f.basename.toLowerCase();
      const path = f.path.toLowerCase();
      return base.includes(query) || path.includes(query);
    });
  }

  function showPopup(files: TFile[]) {
    currentFiles = files;
    selectedIndex = 0;
    if (!files.length) {
      hidePopup();
      return;
    }

    if (!popup) {
      popup = document.createElement("div");
      popup.className = "suggestion-container ak-wikilink-popup";
      document.body.appendChild(popup);
    }

    popup.empty();
    popup.removeClass("ak-wikilink-hidden");

    const itemEls: HTMLElement[] = [];

    for (const f of files) {
      const item = popup.createDiv({ cls: "suggestion-item" });

      item.createDiv({
        cls: "suggestion-title",
        text: f.basename,
      });

      item.createDiv({
        cls: "suggestion-content",
        text: f.path,
      });

      const onSelect = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        selectFile(f);
      };
      item.addEventListener("mousedown", onSelect, true);

      item.addEventListener("mouseenter", () => {
        const idx = itemEls.indexOf(item);
        if (idx >= 0) {
          selectedIndex = idx;
          updateSelection();
        }
      });

      itemEls.push(item);
    }

    updateSelection();
    positionPopup();
  }

  function hidePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
    currentFiles = [];
    selectedIndex = 0;
  }

  function updateSelection() {
    if (!popup) return;
    const items = popup.findAll<HTMLElement>(".suggestion-item");
    items.forEach((el, idx) => {
      if (idx === selectedIndex) {
        el.addClass("is-selected");
      } else {
        el.removeClass("is-selected");
      }
    });
  }

  function positionPopup() {
    if (!popup) return;
    const rect = el.getBoundingClientRect();
    popup.setCssStyles({
      left: rect.left + "px",
      top: rect.bottom + "px",
    });
  }

  function selectFile(file: TFile) {
    const info = getLinkInfo();
    if (!info) return;

    const cursor = el.selectionStart ?? 0;
    const before = el.value.substring(0, info.matchIndex);
    const after = el.value.substring(cursor);

    const newText = `${before}[[${file.basename}]]${after}`;
    const newCursor = info.matchIndex + file.basename.length + 4;

    el.value = newText;
    el.setSelectionRange(newCursor, newCursor);
    el.dispatchEvent(new Event("input"));
    hidePopup();
    el.focus();
  }

  function onInput() {
    const info = getLinkInfo();
    if (!info) {
      hidePopup();
      return;
    }
    const files = findFiles(info.query);
    if (files.length) showPopup(files);
    else hidePopup();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!popup || !currentFiles.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % currentFiles.length;
      updateSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + currentFiles.length) % currentFiles.length;
      updateSelection();
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (selectedIndex >= 0 && selectedIndex < currentFiles.length) {
        e.preventDefault();
        selectFile(currentFiles[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      hidePopup();
    }
  }

  function onBlur(e: FocusEvent) {
    activeWindow.setTimeout(() => {
      const related = e.relatedTarget as Node | null;
      if (!popup || !related) {
        hidePopup();
        return;
      }
      if (popup.contains(related)) return;
      hidePopup();
    }, 80);
  }

  // Attach
  el.addEventListener("input", onInput);
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("blur", onBlur);

  return {
    destroy() {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("blur", onBlur);
      hidePopup();
    },
  };
}
