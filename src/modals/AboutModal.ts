import { App, Modal, Plugin } from 'obsidian';
import logoDataUrl from '../../assets/media/logo.png';

export class AboutModal extends Modal {
  private plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('obsidibot-about-modal');

    // Logo — embedded as base64 data URL at build time (portable across all install methods)
    const logoWrap = contentEl.createDiv({ cls: 'obsidibot-about-logo' });
    const logo = logoWrap.createEl('img');
    logo.src = logoDataUrl;
    logo.alt = 'ObsidiBot logo';

    // Name + version
    contentEl.createEl('h2', { text: 'ObsidiBot', cls: 'obsidibot-about-title' });
    contentEl.createEl('p', { text: `Version ${this.plugin.manifest.version}`, cls: 'obsidibot-about-version' });

    contentEl.createEl('p', {
      text: 'Claude Code agentic file management for Obsidian vaults.',
      cls: 'obsidibot-about-desc',
    });

    // Links
    const btnRow = contentEl.createDiv({ cls: 'obsidibot-about-buttons' });

    const helpBtn = btnRow.createEl('a', {
      text: 'Documentation',
      href: 'https://www.scottkirvan.com/ObsidiBot/',
      cls: 'mod-cta obsidibot-about-link-btn',
    });
    helpBtn.setAttr('target', '_blank');
    helpBtn.setAttr('rel', 'noopener');

    const discordBtn = btnRow.createEl('a', {
      text: 'Discord',
      href: 'https://discord.gg/TN6XJSNK5Y',
      cls: 'obsidibot-about-link-btn',
    });
    discordBtn.setAttr('target', '_blank');
    discordBtn.setAttr('rel', 'noopener');
  }

  onClose() {
    this.contentEl.empty();
  }
}
