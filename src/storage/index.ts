import * as fs from 'fs-extra';
import * as path from 'path';
import { SubKey, SubKeyStatus, SubKeyStorage, CreateSubKeyOptions } from './subkey';
import { SessionStorage, createSessionStorage } from './session';

export { SubKeyStorage, SubKey, SubKeyStatus, CreateSubKeyOptions } from './subkey';
export { SessionStorage, Session, Message, createSessionStorage } from './session';

const SUBKEY_FILE = path.join(process.cwd(), 'ai-key-gateway.subkeys.json');

function generateKey(): string {
  const random = Math.random().toString(36).substring(2, 15) +
                 Math.random().toString(36).substring(2, 15);
  return `sk_${random}`;
}

function generateId(): string {
  return `subkey_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class InMemorySubKeyStorage implements SubKeyStorage {
  private subKeys: Map<string, SubKey> = new Map();
  private keyIndex: Map<string, string> = new Map();

  create(options: CreateSubKeyOptions): SubKey {
    const id = generateId();
    const key = generateKey();
    const now = new Date();

    const subKey: SubKey = {
      id,
      key,
      status: SubKeyStatus.ACTIVE,
      description: options.description,
      createdAt: now,
      updatedAt: now
    };

    this.subKeys.set(id, subKey);
    this.keyIndex.set(key, id);
    this.save();

    return subKey;
  }

  findByKey(key: string): SubKey | null {
    const id = this.keyIndex.get(key);
    if (!id) return null;
    return this.subKeys.get(id) || null;
  }

  findById(id: string): SubKey | null {
    return this.subKeys.get(id) || null;
  }

  list(): SubKey[] {
    return Array.from(this.subKeys.values());
  }

  revoke(id: string): SubKey | null {
    const subKey = this.subKeys.get(id);
    if (!subKey) return null;

    subKey.status = SubKeyStatus.REVOKED;
    subKey.updatedAt = new Date();
    this.save();

    return subKey;
  }

  revokeAll(): number {
    let count = 0;
    for (const subKey of this.subKeys.values()) {
      if (subKey.status === SubKeyStatus.ACTIVE) {
        subKey.status = SubKeyStatus.REVOKED;
        subKey.updatedAt = new Date();
        count++;
      }
    }
    if (count > 0) {
      this.save();
    }
    return count;
  }

  save(): void {
    const data = Array.from(this.subKeys.values()).map(sk => ({
      ...sk,
      createdAt: sk.createdAt.toISOString(),
      updatedAt: sk.updatedAt.toISOString()
    }));
    fs.writeFileSync(SUBKEY_FILE, JSON.stringify(data, null, 2));
  }

  load(): void {
    try {
      if (fs.existsSync(SUBKEY_FILE)) {
        const data = fs.readFileSync(SUBKEY_FILE, 'utf-8');
        const items = JSON.parse(data);

        this.subKeys.clear();
        this.keyIndex.clear();

        for (const item of items) {
          const subKey: SubKey = {
            ...item,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt)
          };
          this.subKeys.set(subKey.id, subKey);
          this.keyIndex.set(subKey.key, subKey.id);
        }
      }
    } catch (error) {
      console.error('Failed to load subkeys:', error);
    }
  }
}

export function createSubKeyStorage(): SubKeyStorage {
  const storage = new InMemorySubKeyStorage();
  storage.load();
  return storage;
}
