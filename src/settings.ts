import { App, Modal, PluginSettingTab, Setting } from "obsidian";
import type AdvancedKanbanPlugin from "./main";
import { DEFAULT_CARD_TEMPLATES, type CardTemplate } from "./board";
import { resolveDateShortcut } from "./actions";

export interface AdvancedKanbanSettings {
  boardFolder: string;
  lastBoard: string | null;
  lastOpenTimes: Record<string, number>;
  cardTemplates: CardTemplate[];
  autoMoveOnComplete: boolean;
  autoMoveTargetColumn: string;
}

export const DEFAULT_SETTINGS: AdvancedKanbanSettings = {
  boardFolder: "Kanban",
  lastBoard: null,
  lastOpenTimes: {},
  cardTemplates: JSON.parse(JSON.stringify(DEFAULT_CARD_TEMPLATES)) as CardTemplate[],
  autoMoveOnComplete: false,
  autoMoveTargetColumn: "Done",
};

export class AdvancedKanbanSettingTab extends PluginSettingTab {
  plugin: AdvancedKanbanPlugin;

  constructor(app: App, plugin: AdvancedKanbanPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const box = containerEl.createDiv({ cls: "setting-section" });

    new Setting(box)
      .setName("Board folder")
      .setDesc("Folder where new kanban board files are created.")
      .addText((text) =>
        text
          .setPlaceholder("Kanban")
          .setValue(this.plugin.settings.boardFolder)
          .onChange((value) => {
            (async () => {
              this.plugin.settings.boardFolder = value;
              await this.plugin.saveSettings();
            })()
              .catch((err) => console.error("Advanced Kanban: error saving board folder", err));
          })
      );

    box.createDiv({ cls: "setting-item ak-section-separator" });

    new Setting(box)
      .setName("Card templates")
      .setDesc(
        "These templates appear when adding a card using the template menu in each column."
      );

    this.plugin.settings.cardTemplates.forEach((t) => {
      new Setting(box)
        .setName(t.label)
        .addButton((btn) => {
          btn
            .setButtonText("Edit")
            .setClass("ak-tpl-edit-btn")
            .onClick(() => {
              this.editTemplate(t).catch((err) => console.error("Advanced Kanban: error editing template", err));
            });
        })
        .addButton((btn) => {
          btn
            .setButtonText("Delete")
            .setClass("ak-tpl-del-btn")
            .onClick(() => {
              (async () => {
                const idx = this.plugin.settings.cardTemplates.findIndex(
                  (x) => x.id === t.id
                );
                if (idx >= 0) {
                  this.plugin.settings.cardTemplates.splice(idx, 1);
                  await this.plugin.saveSettings();
                  this.display();
                }
              })()
                .catch((err) => console.error("Advanced Kanban: error deleting template", err));
            });
        });
    });

    new Setting(box)
      .setName("")
      .addButton((btn) => {
        btn
          .setButtonText("+ Add template")
          .setClass("mod-cta")
          .onClick(() => {
            (async () => {
              const id = "t-" + Date.now().toString(36);
              const newTemplate: CardTemplate = {
                id,
                label: "New template",
                title: "",
                body: "",
                due: null,
                recur: null,
                tags: [],
                color: "",
                fields: [],
                checklist: [],
              };
              this.plugin.settings.cardTemplates.push(newTemplate);
              await this.plugin.saveSettings();
              this.editTemplate(newTemplate).catch((err) => console.error("Advanced Kanban: error editing template", err));
            })()
              .catch((err) => console.error("Advanced Kanban: error adding template", err));
          });
      });

    box.createDiv({ cls: "setting-item ak-section-separator" });

    new Setting(box)
      .setName("Auto-move cards on complete")
      .setDesc(
        "When all checklist items on a card are completed, automatically move the card to the specified column."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoMoveOnComplete)
          .onChange((v) => {
            (async () => {
              this.plugin.settings.autoMoveOnComplete = v;
              await this.plugin.saveSettings();
            })()
              .catch((err) => console.error("Advanced Kanban: error saving auto-move setting", err));
          })
      );

    new Setting(box)
      .setName("Target column name")
      .setDesc(
        "Column name to move completed cards to (e.g., Done, Finished)."
      )
      .addText((text) =>
        text
          .setPlaceholder("Done")
          .setValue(this.plugin.settings.autoMoveTargetColumn || "")
          .onChange((v) => {
            (async () => {
              this.plugin.settings.autoMoveTargetColumn = v.trim();
              await this.plugin.saveSettings();
            })()
              .catch((err) => console.error("Advanced Kanban: error saving target column", err));
          })
      );
  }

  private async editTemplate(t: CardTemplate): Promise<void> {
      const { app } = this;
      const modal = new Modal(app);
      modal.titleEl.setText("Edit card template");

      const wrap = modal.contentEl.createDiv({ cls: "ak-editor" });

      const makeInput = (container: HTMLElement, label: string, value: string, rows?: number): HTMLInputElement | HTMLTextAreaElement => {
        const row = container.createDiv({ cls: "ak-editor-row" });
        const lbl = row.createDiv({ cls: "ak-editor-row-label" });
        lbl.createSpan({ text: label });
        const el = rows
          ? row.createEl("textarea", { cls: "ak-template-input", rows })
          : row.createEl("input", { type: "text", value, cls: "ak-template-input" });
        if (rows) (el as HTMLTextAreaElement).value = value;
        return el;
      };

      const makeSelect = (container: HTMLElement, label: string, options: Array<{ v: string; text: string }>, selectedValue: string): HTMLSelectElement => {
        const row = container.createDiv({ cls: "ak-editor-row" });
        row.createDiv({ cls: "ak-editor-row-label", text: label });
        const sel = row.createEl("select", { cls: "ak-template-input" });
        options.forEach((o) => {
          const opt = sel.createEl("option", { value: o.v, text: o.text });
          if (o.v === selectedValue) opt.selected = true;
        });
        return sel;
      };

      const labelInput = makeInput(wrap, "Label (e.g. Bug Report)", t.label);
      const titleInput = makeInput(wrap, "Default title", t.title || "");
      const bodyInput = makeInput(wrap, "Default body (markdown)", t.body || "", 6) as HTMLTextAreaElement;
      const tagsInput = makeInput(wrap, "Default tags", (t.tags || []).map((x) => "#" + x).join(" "));

      
      const dueRow = wrap.createDiv({ cls: "ak-editor-row" });
      const dueLbl = dueRow.createDiv({ cls: "ak-editor-row-label" });
      dueLbl.createSpan({ text: "Default due date (today, tom, +3d, next mon, eom)" });
      const dueInput = dueRow.createEl("input", { type: "text", value: t.due || "", cls: "ak-template-input" });
      dueInput.addEventListener("blur", () => {
        const v = dueInput.value.trim();
        if (!v) return;
        const resolved = resolveDateShortcut(v);
        if (resolved && resolved !== v) {
          dueInput.value = resolved;
        }
      });

      const recurSelect = makeSelect(wrap, "Repeats", [
        { v: "", text: "None" },
        { v: "daily", text: "Daily" },
        { v: "weekly", text: "Weekly" },
        { v: "biweekly", text: "Biweekly" },
        { v: "monthly", text: "Monthly" },
      ], t.recur?.interval || "");

      const colorSelect = makeSelect(wrap, "Cover color", [
        { v: "", text: "None" },
        { v: "red", text: "Red" },
        { v: "orange", text: "Orange" },
        { v: "yellow", text: "Yellow" },
        { v: "green", text: "Green" },
        { v: "teal", text: "Teal" },
        { v: "blue", text: "Blue" },
        { v: "purple", text: "Purple" },
        { v: "pink", text: "Pink" },
        { v: "gray", text: "Gray" },
      ], t.color || "");

      
      const fieldsSection = wrap.createDiv({ cls: "ak-editor-row" });
      const fieldsLabel = fieldsSection.createDiv({ cls: "ak-editor-row-label" });
      fieldsLabel.createSpan({ text: "Default custom fields" });
      const fieldsWrap = fieldsSection.createDiv({ cls: "ak-fields-list" });
      const fieldsData: Array<{ name: string; value: string }> =
        Array.isArray(t.fields)
          ? t.fields.map((f) => ({
              name: typeof f.name === "string" ? f.name : String(f.name ?? ""),
              value: typeof f.value === "string" ? f.value : String(f.value ?? ""),
            }))
          : [];

      const renderFields = () => {
        fieldsWrap.empty();
        fieldsData.forEach((f, i) => {
          const row = fieldsWrap.createDiv({ cls: "ak-field-row" });
          const nameInput = row.createEl("input", {
            type: "text",
            value: f.name,
            cls: "ak-template-input",
            placeholder: "Name (e.g. Priority)",
          });
          const valInput = row.createEl("input", {
            type: "text",
            value: f.value,
            cls: "ak-template-input",
            placeholder: "Value (e.g. High)",
          });
          const removeBtn = row.createEl("button", { cls: "ak-editor-remove", text: "✕" });

          removeBtn.addEventListener("click", () => {
            fieldsData.splice(i, 1);
            renderFields();
          });

          nameInput.addEventListener("input", () => {
            fieldsData[i].name = nameInput.value;
          });
          valInput.addEventListener("input", () => {
            fieldsData[i].value = valInput.value;
          });
        });
        if (fieldsData.length === 0) {
          fieldsWrap.createDiv({ cls: "ak-empty-hint", text: "No custom fields yet." });
        }
      };
      renderFields();

      const addFieldBtn = fieldsSection.createEl("button", { cls: "ak-editor-add", text: "+ Add field" });
      addFieldBtn.addEventListener("click", () => {
        fieldsData.push({ name: "", value: "" });
        renderFields();
      });

      
      const checklistSection = wrap.createDiv({ cls: "ak-editor-row" });
      const clLabel = checklistSection.createDiv({ cls: "ak-editor-row-label" });
      clLabel.createSpan({ text: "Default checklist items" });
      const clWrap = checklistSection.createDiv({ cls: "ak-checklist-list" });
      const clData: Array<{ text: string; checked: boolean }> =
        Array.isArray(t.checklist)
          ? t.checklist.map((i) => ({
              text: typeof i.text === "string" ? i.text : String(i.text ?? ""),
              checked: !!i.checked,
            }))
          : [];

      const renderChecklist = () => {
        clWrap.empty();
        clData.forEach((item, i) => {
          const row = clWrap.createDiv({ cls: "ak-checklist-row" });
          const cb = row.createEl("input", { type: "checkbox" });
          cb.checked = item.checked;
          const input = row.createEl("input", {
            type: "text",
            value: item.text,
            cls: "ak-template-input",
            placeholder: "Item text",
          });
          const removeBtn = row.createEl("button", { cls: "ak-editor-remove", text: "✕" });

          removeBtn.addEventListener("click", () => {
            clData.splice(i, 1);
            renderChecklist();
          });

          cb.addEventListener("change", () => {
            clData[i].checked = cb.checked;
          });
          input.addEventListener("input", () => {
            clData[i].text = input.value;
          });
        });
        if (clData.length === 0) {
          clWrap.createDiv({ cls: "ak-empty-hint", text: "No checklist items yet." });
        }
      };
      renderChecklist();

      const addCLBtn = checklistSection.createEl("button", { cls: "ak-editor-add", text: "+ Add item" });
      addCLBtn.addEventListener("click", () => {
        clData.push({ text: "", checked: false });
        renderChecklist();
      });

      
      const btnWrap = wrap.createDiv({ cls: "ak-editor-footer" });
      const footerRight = btnWrap.createDiv({ cls: "ak-editor-footer-right" });
      const cancelBtn = footerRight.createEl("button", { text: "Cancel", cls: "ak-btn ak-btn-secondary" });
      const saveBtn = footerRight.createEl("button", { text: "Save", cls: "ak-btn ak-btn-primary" });

      const close = () => {
        modal.close();
      };
      cancelBtn.addEventListener("click", close);

      saveBtn.addEventListener("click", () => {
        (async () => {
          try {
            t.label = (labelInput.value || "Untitled").trim();
            t.title = titleInput.value.trim();
            t.body = bodyInput.value.trim();
            const rawTags = tagsInput.value
              .split(/[\s,]+/)
              .map((x) => x.replace(/^#/, "").trim())
              .filter(Boolean);
            t.tags = rawTags;
            t.due = dueInput.value.trim() || null;
            t.recur = recurSelect.value
              ? { interval: recurSelect.value as "daily" | "weekly" | "biweekly" | "monthly" }
              : null;
            t.color = colorSelect.value || "";

            
            t.fields = fieldsData
              .map((f) => ({ name: String(f.name || "").trim(), value: String(f.value || "").trim() }))
              .filter((f) => f.name || f.value);

            
            t.checklist = clData
              .map((i) => ({ text: String(i.text || "").trim(), checked: !!i.checked }))
              .filter((i) => i.text);

            await this.plugin.saveSettings();
            this.display();
            close();
          } catch (e) {
            console.error("Advanced Kanban: error saving tag", e);
          }
        })();
      });

      modal.open();
      labelInput.focus();
    }
  }
