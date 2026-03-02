export enum SubKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked'
}

export interface SubKey {
  id: string;
  key: string;
  status: SubKeyStatus;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubKeyOptions {
  description?: string;
}

export interface SubKeyStorage {
  create(options: CreateSubKeyOptions): SubKey;
  findByKey(key: string): SubKey | null;
  findById(id: string): SubKey | null;
  list(): SubKey[];
  revoke(id: string): SubKey | null;
  revokeAll(): number;
  save(): void;
  load(): void;
}
