import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  claudeSessionId: string;
  sortOrder?: number;
  userLabel?: string;
  assistantLabel?: string;
}

export function getSessionsDir(vaultRoot: string): string {
  // Stored outside the plugin directory so symlinked dev installs don't
  // cause multiple vaults to share the same physical sessions folder.
  return join(vaultRoot, '.obsidian', 'obsidibot', 'sessions');
}

/** Legacy path used before the project was renamed from Cortex to ObsidiBot. */
export function getLegacySessionsDir(vaultRoot: string): string {
  return join(vaultRoot, '.obsidian', 'cortex', 'sessions');
}

export function saveSession(vaultRoot: string, session: StoredSession): void {
  const dir = getSessionsDir(vaultRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // If this session came from the legacy dir, migrate it: delete the old file
  // after saving to the new location. Strip _legacyDir before persisting.
  const legacyDir = (session as StoredSession & { _legacyDir?: string })._legacyDir;
  const { _legacyDir: _ignored, ...toSave } = session as StoredSession & { _legacyDir?: string };
  writeFileSync(join(dir, `${toSave.id}.json`), JSON.stringify(toSave, null, 2));
  if (legacyDir) {
    const oldPath = join(legacyDir, `${toSave.id}.json`);
    if (existsSync(oldPath)) unlinkSync(oldPath);
    // Clear the marker so subsequent saves don't look for the old file again
    delete (session as StoredSession & { _legacyDir?: string })._legacyDir;
  }
}

export function loadAllSessions(vaultRoot: string): StoredSession[] {
  const loadDir = (dir: string, legacy: boolean): StoredSession[] => {
    if (!existsSync(dir)) return [];
    try {
      return readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as StoredSession;
          if (legacy) (s as StoredSession & { _legacyDir?: string })._legacyDir = dir;
          return s;
        });
    } catch {
      return [];
    }
  };

  const currentSessions = loadDir(getSessionsDir(vaultRoot), false);
  const legacySessions = loadDir(getLegacySessionsDir(vaultRoot), true);

  // Merge: deduplicate by id (current takes precedence if same id exists in both)
  const seen = new Set(currentSessions.map(s => s.id));
  const merged = [...currentSessions, ...legacySessions.filter(s => !seen.has(s.id))];

  return merged.sort((a, b) => {
    const aHas = a.sortOrder !== undefined;
    const bHas = b.sortOrder !== undefined;
    if (aHas && bHas) return a.sortOrder! - b.sortOrder!;
    if (aHas || bHas) return aHas ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * Save a new session at the top of the ordered list.
 * If any existing sessions have a sortOrder, the new session gets sortOrder=0
 * and all others are shifted down by 1. Otherwise just saves normally.
 */
export function saveSessionAtTop(vaultRoot: string, session: StoredSession): void {
  const existing = loadAllSessions(vaultRoot);
  const anyOrdered = existing.some(s => s.sortOrder !== undefined);
  if (anyOrdered) {
    existing.forEach(s => {
      s.sortOrder = (s.sortOrder ?? 0) + 1;
      writeFileSync(join(getSessionsDir(vaultRoot), `${s.id}.json`), JSON.stringify(s, null, 2));
    });
    session.sortOrder = 0;
  }
  saveSession(vaultRoot, session);
}

export function deleteSession(vaultRoot: string, sessionId: string, fromDir?: string): void {
  const dir = fromDir ?? getSessionsDir(vaultRoot);
  const filePath = join(dir, `${sessionId}.json`);
  if (existsSync(filePath)) unlinkSync(filePath);
}

export function titleFromPrompt(prompt: string): string {
  const first = prompt.trim().replace(/\s+/g, ' ');
  return first.length > 60 ? first.substring(0, 60) + '…' : first;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function findJsonlPath(claudeSessionId: string): string | undefined {
  const projectsDir = join(homedir(), '.claude', 'projects');
  if (!existsSync(projectsDir)) return undefined;
  try {
    for (const project of readdirSync(projectsDir)) {
      const candidate = join(projectsDir, project, `${claudeSessionId}.jsonl`);
      if (existsSync(candidate)) return candidate;
    }
  } catch { /* ignore */ }
  return undefined;
}

/**
 * Check if a claude session can be resumed on this machine by looking for
 * its .jsonl file in any ~/.claude/projects/ subdirectory.
 */
export function canResumeLocally(claudeSessionId: string): boolean {
  return findJsonlPath(claudeSessionId) !== undefined;
}

/**
 * Parse the .jsonl session file and return user/assistant turns.
 * Strips vault_context injection from the first user message.
 */
export function loadSessionMessages(claudeSessionId: string): ChatMessage[] {
  const jsonlPath = findJsonlPath(claudeSessionId);
  if (!jsonlPath) return [];

  try {
    const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter(l => l.trim());
    const messages: ChatMessage[] = [];
    let isFirstUser = true;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;

        if (entry.type === 'user') {
          const msg = entry.message as Record<string, unknown> | undefined;
          let content: string;
          if (typeof msg?.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg?.content)) {
            // Claude stores user messages as content block arrays in some formats
            content = (msg.content as Array<Record<string, unknown>>)
              .filter(b => b.type === 'text')
              .map(b => b.text as string)
              .join('');
          } else {
            content = '';
          }
          if (isFirstUser) {
            // Strip injected vault context from display
            content = content.replace(/<vault_context>[\s\S]*?<\/vault_context>\s*/g, '').trim();
            isFirstUser = false;
          }
          if (content) messages.push({ role: 'user', content, timestamp: entry.timestamp as string });

        } else if (entry.type === 'assistant') {
          const msg = entry.message as Record<string, unknown> | undefined;
          const blocks = (msg?.content as Array<Record<string, unknown>> | undefined) ?? [];
          const text = blocks
            .filter(b => b.type === 'text')
            .map(b => b.text as string)
            .join('');
          if (text.trim()) messages.push({ role: 'assistant', content: text.trim(), timestamp: entry.timestamp as string });
        }
      } catch { /* skip malformed lines */ }
    }

    return messages;
  } catch {
    return [];
  }
}
