import type { ISODateString } from "./common.js";

export type ApiKeyScope = "admin" | "seller";

// Persisted API key metadata. The plaintext key is never stored; the hash
// never leaves the backend. The plaintext is returned exactly once, in the
// POST /api-keys response, as CreateApiKeyResponse.key.
export interface ApiKey {
  id: number;
  name: string;
  prefix: string;            // first 12 chars ("bsk_" + 8 hex), for display + lookup
  scope: ApiKeyScope;
  createdBy: number;         // User id of the creating admin
  isRevoked: boolean;
  expiresAt: ISODateString | null;
  lastUsedAt: ISODateString | null;
  createdAt: ISODateString;
}

// List row: the creating admin joined in for the "created by" column.
export interface ApiKeyListItem extends ApiKey {
  creator: { id: number; username: string };
}

export interface CreateApiKeyRequest {
  name: string;
  scope?: ApiKeyScope;
  expiresAt?: ISODateString;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string;               // one-time plaintext, "bsk_…"
}

export interface ListApiKeysResponse {
  apiKeys: ApiKeyListItem[];
}

export interface RevokeApiKeyResponse {
  message: string;
}
