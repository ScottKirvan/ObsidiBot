import { App, Modal, Plugin } from 'obsidian';
import logoDataUrl from '../../assets/media/logo.jpg';

export class AboutModal extends Modal {
  private plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('cortex-about-modal');

    // Logo — embedded as base64 data URL at build time (portable across all install methods)
    const logoWrap = contentEl.createDiv({ cls: 'cortex-about-logo' });
    const logo = logoWrap.createEl('img');
    logo.src = logoDataUrl;
    logo.alt = 'Cortex logo';

    // Name + version
    contentEl.createEl('h2', { text: 'Cortex', cls: 'cortex-about-title' });
    contentEl.createEl('p', { text: `Version ${(this.plugin as any).manifest.version}`, cls: 'cortex-about-version' });

    contentEl.createEl('p', {
      text: 'Claude Code agentic file management for Obsidian vaults.',
      cls: 'cortex-about-desc',
    });

    // Links
    const btnRow = contentEl.createDiv({ cls: 'cortex-about-buttons' });

    const helpBtn = btnRow.createEl('a', {
      text: 'Documentation',
      href: 'https://www.scottkirvan.com/Cortex/notes/USER_README',
      cls: 'mod-cta cortex-about-link-btn',
    });
    helpBtn.setAttr('target', '_blank');
    helpBtn.setAttr('rel', 'noopener');

    const discordBtn = btnRow.createEl('a', {
      text: 'Discord',
      href: 'https://discord.gg/TN6XJSNK5Y',
      cls: 'cortex-about-link-btn',
    });
    discordBtn.setAttr('target', '_blank');
    discordBtn.setAttr('rel', 'noopener');
  }

  onClose() {
    this.contentEl.empty();
  }
}
