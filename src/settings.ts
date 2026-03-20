import { App, PluginSettingTab, Setting } from 'obsidian';
import type CortexPlugin from '../main';
import type { PermissionMode } from './ClaudeProcess';
export type { PermissionMode };

export interface CortexSettings {
  binaryPath: string;
  contextFilePath: string;
  sendOnEnter: boolean;
  resumeLastSession: boolean;
  autonomousMemory: boolean;
  /** Vault tree depth injected at session start. 0=off, 1=root only, N=N levels, -1=unlimited. */
  vaultTreeDepth: number;
  /** User dismissed the context file setup modal and doesn't want to see it again. */
  skipContextFilePrompt: boolean;
  /** Allow Claude to trigger Obsidian UI actions (open files, show notices, etc.) */
  uiBridgeEnabled: boolean;
  /** Which operations Claude is allowed to perform. */
  permissionMode: PermissionMode;
  /** Write a debug log file to the vault. */
  logEnabled: boolean;
  /** Vault-relative path for the log file. */
  logFilePath: string;
  /** How much detail to log. 'verbose' includes raw stream chunks and token breakdowns. */
  logVerbosity: 'normal' | 'verbose';
}

export const DEFAULT_SETTINGS: CortexSettings = {
  binaryPath: '',
  contextFilePath: '_claude-context.md',
  sendOnEnter: true,
  resumeLastSession: true,
  autonomousMemory: true,
  vaultTreeDepth: 3,
  skipContextFilePrompt: false,
  uiBridgeEnabled: true,
  permissionMode: 'standard',
  logEnabled: true,
  logFilePath: '_cortex-debug.log',
  logVerbosity: 'normal',
};

export class CortexSettingsTab extends PluginSettingTab {
  plugin: CortexPlugin;

  constructor(app: App, plugin: CortexPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── General ────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'General' });

    new Setting(containerEl)
      .setName('Claude binary path')
      .setDesc('Path to the claude CLI binary. Leave blank to auto-detect.')
      .addText((text) =>
        text
          .setPlaceholder('/usr/local/bin/claude')
          .setValue(this.plugin.settings.binaryPath)
          .onChange(async (value) => {
            this.plugin.settings.binaryPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Send on Enter')
      .setDesc('Press Enter to send. Shift+Enter always inserts a newline.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.sendOnEnter)
          .onChange(async (value) => {
            this.plugin.settings.sendOnEnter = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Resume last session on startup')
      .setDesc('Automatically resume the most recent session when the panel opens.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.resumeLastSession)
          .onChange(async (value) => {
            this.plugin.settings.resumeLastSession = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Context & Memory ───────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Context & Memory' });

    new Setting(containerEl)
      .setName('Context file path')
      .setDesc('Vault-relative path to the context file injected at session start.')
      .addText((text) =>
        text
          .setPlaceholder('_claude-context.md')
          .setValue(this.plugin.settings.contextFilePath)
          .onChange(async (value) => {
            this.plugin.settings.contextFilePath = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText('Open file')
          .setTooltip('Open the context file in Obsidian for editing')
          .onClick(async () => {
            let file = this.app.vault.getFileByPath(this.plugin.settings.contextFilePath);
            if (!file) {
              file = await this.app.vault.create(this.plugin.settings.contextFilePath, '');
            }
            await this.app.workspace.getLeaf(false).openFile(file);
          })
      );

    new Setting(containerEl)
      .setName('Vault tree depth')
      .setDesc(
        'How many levels of your vault folder/file tree to include at the start of each session. ' +
        'This gives Claude a map of your vault structure (names only — no file contents are read). ' +
        'Deeper trees cost more tokens on the first message of each session. ' +
        '"Off" disables the tree entirely.'
      )
      .addDropdown((drop) =>
        drop
          .addOption('0', 'Off')
          .addOption('1', '1 level (root only)')
          .addOption('2', '2 levels')
          .addOption('3', '3 levels (default)')
          .addOption('4', '4 levels')
          .addOption('5', '5 levels')
          .addOption('6', '6 levels')
          .addOption('7', '7 levels')
          .addOption('8', '8 levels')
          .addOption('9', '9 levels')
          .addOption('10', '10 levels')
          .addOption('-1', 'Unlimited')
          .setValue(String(this.plugin.settings.vaultTreeDepth))
          .onChange(async (value) => {
            this.plugin.settings.vaultTreeDepth = parseInt(value, 10);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Autonomous memory')
      .setDesc(`Claude will autonomously update the context file (${this.plugin.settings.contextFilePath}) as it learns about your vault. Disable if you prefer to manage the context file manually, or if your vault is shared/public.`)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autonomousMemory)
          .onChange(async (value) => {
            this.plugin.settings.autonomousMemory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('UI Bridge')
      .setDesc('Allow Claude to trigger Obsidian UI actions — open files, show notices, navigate headings. Claude is instructed to use these proactively after completing tasks.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.uiBridgeEnabled)
          .onChange(async (value) => {
            this.plugin.settings.uiBridgeEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Permissions ────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Permissions' });

    new Setting(containerEl)
      .setName('Permission mode')
      .setDesc('Controls which vault operations Claude is allowed to perform.')
      .addDropdown((drop) =>
        drop
          .addOption('standard', 'Standard — files + web, no Bash (recommended)')
          .addOption('readonly', 'Read only — no writes or shell commands')
          .addOption('full', 'Full access — everything including Bash')
          .setValue(this.plugin.settings.permissionMode)
          .onChange(async (value) => {
            this.plugin.settings.permissionMode = value as PermissionMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show context file setup prompt')
      .setDesc('Show the setup modal on launch when no context file is found. Disable if you prefer to create the file manually.')
      .addToggle((toggle) =>
        toggle
          .setValue(!this.plugin.settings.skipContextFilePrompt)
          .onChange(async (value) => {
            this.plugin.settings.skipContextFilePrompt = !value;
            await this.plugin.saveSettings();
          })
      );

    // ── Logging ────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Logging' });

    new Setting(containerEl)
      .setName('Enable debug log')
      .setDesc('Write a debug log file to your vault. Useful for troubleshooting. Takes effect on next Obsidian restart.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.logEnabled)
          .onChange(async (value) => {
            this.plugin.settings.logEnabled = value;
            await this.plugin.saveSettings();
            this.plugin.reconfigureLogger();
          })
      );

    new Setting(containerEl)
      .setName('Log file path')
      .setDesc('Vault-relative path for the log file.')
      .addText((text) =>
        text
          .setPlaceholder('_cortex-debug.log')
          .setValue(this.plugin.settings.logFilePath)
          .onChange(async (value) => {
            this.plugin.settings.logFilePath = value || '_cortex-debug.log';
            await this.plugin.saveSettings();
            this.plugin.reconfigureLogger();
          })
      );

    new Setting(containerEl)
      .setName('Log verbosity')
      .setDesc('Normal logs session events and errors. Verbose adds raw stream data and token breakdowns — useful for deep debugging but produces large log files.')
      .addDropdown((drop) =>
        drop
          .addOption('normal', 'Normal')
          .addOption('verbose', 'Verbose')
          .setValue(this.plugin.settings.logVerbosity)
          .onChange(async (value) => {
            this.plugin.settings.logVerbosity = value as 'normal' | 'verbose';
            await this.plugin.saveSettings();
            this.plugin.reconfigureLogger();
          })
      );
  }
}
