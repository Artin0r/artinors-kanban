# Artin0rs Advanced Kanban

A markdown‑backed kanban board for Obsidian. Boards are stored as plain Markdown, editable by hand, safe to diff, and still feel like a real Trello‑style app when opened.

<img width="1200" height="515" alt="Showcase" src="https://github.com/user-attachments/assets/9c3d6900-18eb-47a8-adf0-a25cb5070cd3" />


---
## Features

- Markdown-backed boards: one .md file per board; columns, cards, and metadata in plain text
- Multiple boards with a quick picker 
- Drag & drop:
    - Cards within and across columns
    - Column headers to reorder columns
- Rich card editor:
    - Title and description with full markdown
    - Due dates (today/tomorrow/+3d/next mon/eom shortcuts)
    - Due date highlighting: overdue, today, soon, future
    - Recurring tasks: daily, weekly, biweekly, monthly
    - Tags field
    - Custom fields (arbitrary key/value pairs)
    - Inline checklists with live progress bar
    - Cover color accent
    - Move card to another column via dropdown
- Archive column:
	-  Archive cards instead of deleting them
    - Toggle visibility
    - Recurring cards rescheduled instead of lost
- Column controls:
    - Add, rename, delete
    - Per‑column card limit (WIP) with visual warning
    - Per‑column sort: manual, by due date, alphabetical
    - Collapse/expand
    - Accent color (Dot before column name)
- Search and filters:
    - Live search across title, body, tags, and custom fields
    - Tag filters from cards; combine multiple
- Auto‑move on complete:
    - Move card to a target column when all checklist items are done
- Import / export:
    - Import/Export as CSV (full metadata) and as Trello‑compatible JSON (lists, labels, checklists, due dates, custom fields)
    - Right-click board name menu: quick access to export/import
- Card templates:
    - Build your own custom card templates for quick use.
    - Fully customizable: title, body, tags, fields, checklist, due, color
- Embedded boards in notes:
    - Use a kanban code block with [[BoardName]]
    - Edits write back to the board file
    - Use inside notes, dashboards, Canvas cards


All in one view. One plugin, zero boilerplate, everything human‑readable.

---
## Usage

- Ribbon icon (dashboard):
    - Opens your last-used board, or the board picker
- Command palette:
    - A.A. Kanban: Open kanban board
    - A.A. Kanban: Create new kanban board
    - A.A. Kanban: Open current file as kanban board
    - A.A. Kanban: Open current board as markdown
- Cards:
    - Drag cards to move them
    - Hover for edit / archive / delete / send
    - Click a tag chip to filter the board
    - Checklists update live
- Columns:
    - Add / rename / delete 
    - Insert card templates
    - Set card limit
    - Change sort mode
    - Collapse / expand
---
## Board file format

Each board is a Markdown file with YAML frontmatter describing columns and settings.

Example:

```yaml
---
kanban-plugin: advanced-kanban
board-name: My Board 1
board-id: mrjh7z2d39ja5nusd8
columns:
  - id: mrjh7z2ds0xwnx01zk
    name: Backlog
    color: ""
    wip: 0
    collapsed: false
    sort: manual
  - id: mrjh7z2di26fnaw3o2
    name: To Do
    color: "#3a7bd5"
    wip: 5
    collapsed: false
    sort: manual
  - id: mrjh7z2dpb87yjqiou
    name: In Progress
    color: "#e08a3c"
    wip: 3
    collapsed: false
    sort: manual
  - id: mrjh7z2dbrbt2czi5n
    name: Done
    color: "#4caf50"
    wip: 0
    collapsed: false
    sort: manual
settings:
  hide-archive: false
---

## Backlog <!--col:mrjh7z2ds0xwnx01zk-->

- [ ] Feature: <!--id:mrjh9irzk6evhddj9x-->
  tags:: #feature
  color:: blue
  Priority:: Medium
  ## Summary

  ## Motivation

  ## Proposed solution
  - [ ] Check related issues
  - [ ] Gather feedback

## In Progress <!--col:mrjh7z2dpb87yjqiou-->

- [ ] Bug: <!--id:mrjh9lifh70g8o59no-->
  tags:: #bug
  color:: red
  Priority:: Medium
  ## Description

  ## Steps to reproduce
  1. 
  2. 
  3. 

  ## Expected behavior

  ## Actual behavior
  - [ ] Verify in latest version
  - [ ] Attach screenshot/logs

## Done <!--col:mrjh7z2dbrbt2czi5n-->
```

Quick rules:

- Columns = `##` headings with an ID comment: `<!--col:<id>-->`
- Cards = list items:
    - Optional `[x]` marks a completed card
    - ID comment: `<!--id:<id>-->` (internal; don’t edit unless you know why)
- Per-card metadata: `key:: value`
    - Reserved: `due`, `recur`, `tags`, `color`, `id`
    - Everything else becomes a custom field
- Checklists = sub-items: `- [ ]` / `- [x]`
- Remaining indented lines = card body (markdown allowed)

---
## Embedding boards in notes

Embed a live board in any note with a kanban code block:

````markdown
```kanban
[[My Board]]
```
````

- Edits inside the embed update the board file.
- Multiple embeddings of the same board can coexist with its main view.
- A short hint is shown if the code block is missing the link.

---
## Settings

- Board folder:
    - Where new board files are created
- Card templates:
    - View, edit, delete, add
    - Customize title, body, tags, fields, checklist, due, color
- Auto-move cards on complete:
    - Toggle
    - Set target column name (default: "Done")

---
## Tech

- TypeScript + esbuild
- Svelte 5 (runes mode) for the reactive UI
- js-yaml for frontmatter parsing

---
## License

Licensed under a custom Use-Only License (see LICENSE.txt).
You may use it for any purpose (personal, educational, commercial), but may not fork, redistribute, or sell it.
