import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  claudeSessionId: string;
}

export function getSessionsDir(vaultRoot: string): string {
  return join(vaultRoot, '.obsidian', 'plugins', 'cortex', '.claude', 'sessions');
}

export function saveSession(vaultRoot: string, session: StoredSession): void {
  const dir = getSessionsDir(vaultRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${session.id}.json`), JSON.stringify(session, null, 2));
}

export function loadAllSessions(vaultRoot: string): StoredSession[] {
  const dir = getSessionsDir(vaultRoot);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as StoredSession)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function deleteSession(vaultRoot: string, sessionId: string): void {
  const filePath = join(getSessionsDir(vaultRoot), `${sessionId}.json`);
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
          let content = typeof msg?.content === 'string' ? msg.content : '';
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
