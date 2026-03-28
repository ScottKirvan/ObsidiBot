import { Modal, App } from 'obsidian';

export class ExportToVaultModal extends Modal {
  constructor(
    app: App,
    private defaultPath: string,
    private onConfirm: (path: string) => void,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Export session to vault' });
    contentEl.createEl('p', {
      text: 'Vault-relative path for the note (folder will be created if needed):',
      cls: 'cortex-export-hint',
    });

    const input = contentEl.createEl('input', {
      cls: 'cortex-export-path-input',
      attr: { type: 'text', value: this.defaultPath },
    });

    const btnRow = contentEl.createDiv({ cls: 'cortex-export-btn-row' });
    btnRow.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());
    const exportBtn = btnRow.createEl('button', { text: 'Save to vault', cls: 'mod-cta' });
    exportBtn.addEventListener('click', () => {
      const path = input.value.trim();
      if (path) { this.onConfirm(path); this.close(); }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { exportBtn.click(); }
      if (e.key === 'Escape') { this.close(); }
    });

    setTimeout(() => { input.focus(); input.select(); }, 50);
  }

  onClose() { this.contentEl.empty(); }
}
