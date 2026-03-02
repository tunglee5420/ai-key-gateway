export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface Session {
  subKeyId: string;
  messages: Message[];
  updatedAt: Date;
}

export interface SessionStorage {
  createSession(subKeyId: string): Session;
  getSession(subKeyId: string): Session | null;
  appendMessage(subKeyId: string, role: 'user' | 'assistant', content: string): void;
  clearSession(subKeyId: string): void;
  listSessions(): Session[];
}

// Default max history turns (20 turns = 40 messages)
const DEFAULT_MAX_HISTORY_TURNS = 20;

export function createSessionStorage(maxHistoryTurns: number = DEFAULT_MAX_HISTORY_TURNS): SessionStorage {
  const sessions = new Map<string, Session>();

  return {
    createSession(subKeyId: string): Session {
      const session: Session = {
        subKeyId,
        messages: [],
        updatedAt: new Date()
      };
      sessions.set(subKeyId, session);
      return session;
    },

    getSession(subKeyId: string): Session | null {
      return sessions.get(subKeyId) || null;
    },

    appendMessage(subKeyId: string, role: 'user' | 'assistant', content: string): void {
      let session = sessions.get(subKeyId);
      if (!session) {
        session = this.createSession(subKeyId);
      }

      session.messages.push({
        role,
        content,
        timestamp: new Date()
      });

      // Trim history if exceeds max turns
      const maxMessages = maxHistoryTurns * 2;
      if (session.messages.length > maxMessages) {
        session.messages = session.messages.slice(-maxMessages);
      }

      session.updatedAt = new Date();
    },

    clearSession(subKeyId: string): void {
      sessions.delete(subKeyId);
    },

    listSessions(): Session[] {
      return Array.from(sessions.values());
    }
  };
}
