import { Modal, App, setIcon } from 'obsidian';
import { StoredSession, saveSession, canResumeLocally, deleteSession } from '../utils/sessionStorage';

export class SessionListModal extends Modal {
  sessions: StoredSession[];
  filteredSessions: StoredSession[];
  vaultRoot: string;
  onSelect: (session: StoredSession) => void;
  onNewSession: () => void;
  onDismiss: () => void;
  listContainer: HTMLElement | null = null;

  constructor(
    app: App,
    vaultRoot: string,
    sessions: StoredSession[],
    onSelect: (s: StoredSession) => void,
    onNewSession: () => void,
    onDismiss: () => void = () => {},
  ) {
    super(app);
    this.vaultRoot = vaultRoot;
    this.sessions = sessions;
    this.filteredSessions = sessions;
    this.onSelect = onSelect;
    this.onNewSession = onNewSession;
    this.onDismiss = onDismiss;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Session history' });

    const topBar = contentEl.createDiv({ cls: 'cortex-modal-topbar' });

    const filterInput = topBar.createEl('input', {
      cls: 'cortex-session-filter',
      attr: { type: 'text', placeholder: 'Search sessions…' },
    });
    filterInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.filteredSessions = this.sessions.filter(s =>
        s.title.toLowerCase().includes(query)
      );
      this.rerenderList();
    });

    const newSessionBtn = topBar.createEl('button', {
      text: '+ New',
      cls: 'cortex-new-session-btn',
    });
    newSessionBtn.addEventListener('click', () => this.createNewSession());

    this.listContainer = contentEl.createDiv({ cls: 'cortex-session-list-container' });
    this.rerenderList();
  }

  private createNewSession() {
    this.onNewSession();
    this.close();
  }

  private rerenderList() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    if (this.filteredSessions.length === 0) {
      this.listContainer.createEl('p', {
        text: this.sessions.length === 0 ? 'No saved sessions yet.' : 'No sessions match your search.',
        cls: 'cortex-modal-empty',
      });
      return;
    }

    const list = this.listContainer.createEl('ul', { cls: 'cortex-session-list' });
    for (const session of this.filteredSessions) {
      this.renderSessionItem(list, session);
    }
  }

  private renderSessionItem(list: HTMLElement, session: StoredSession) {
    const isNew = !session.claudeSessionId;
    const resumable = !isNew && canResumeLocally(session.claudeSessionId);
    const item = list.createEl('li', {
      cls: isNew
        ? 'cortex-session-item cortex-session-new'
        : resumable
          ? 'cortex-session-item'
          : 'cortex-session-item cortex-session-remote',
    });
    const titleEl = item.createEl('span', { text: session.title, cls: 'cortex-session-title' });
    item.createEl('span', {
      text: new Date(session.updatedAt).toLocaleString(),
      cls: 'cortex-session-date',
    });
    if (isNew) {
      item.createEl('span', { text: 'new', cls: 'cortex-session-new-badge' });
    } else if (!resumable) {
      item.createEl('span', { text: 'remote', cls: 'cortex-session-remote-badge' });
    }

    const actionsDiv = item.createEl('div', { cls: 'cortex-session-actions' });
    const renameBtn = actionsDiv.createEl('button', { cls: 'cortex-rename-btn' });
    setIcon(renameBtn, 'pencil');
    renameBtn.title = 'Rename session';
    const deleteBtn = actionsDiv.createEl('button', { cls: 'cortex-delete-btn' });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.title = 'Delete session';

    item.addEventListener('click', (e) => {
      if (e.target === renameBtn || e.target === deleteBtn || (e.target as HTMLElement).closest('.cortex-session-actions')) {
        return;
      }
      this.onSelect(session);
      this.close();
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete session "${session.title}"? This cannot be undone.`)) {
        deleteSession(this.vaultRoot, session.id);
        this.sessions = this.sessions.filter(s => s.id !== session.id);
        this.filteredSessions = this.filteredSessions.filter(s => s.id !== session.id);
        this.rerenderList();
      }
    });

    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = item.createEl('input', {
        cls: 'cortex-rename-input',
        attr: { value: session.title, type: 'text' },
      });
      titleEl.hide();
      renameBtn.hide();
      deleteBtn.hide();
      input.focus();
      input.select();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== session.title) {
          session.title = newTitle;
          saveSession(this.vaultRoot, session);
          titleEl.setText(newTitle);
        }
        input.remove();
        titleEl.show();
        renameBtn.show();
        deleteBtn.show();
      };

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
        if (ke.key === 'Escape') { input.remove(); titleEl.show(); renameBtn.show(); deleteBtn.show(); }
      });
      input.addEventListener('blur', commit);
    });
  }

  onClose() {
    this.contentEl.empty();
    this.onDismiss();
  }
}
