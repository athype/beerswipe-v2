import { defineStore } from 'pinia';
import type {
  ApiKeyListItem,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  RevokeApiKeyResponse,
  StoreActionResult,
} from '@beerswipe/types';
import { apiKeysAPI } from '../services/api.js';

interface ApiKeysState {
  apiKeys: ApiKeyListItem[];
  loading: boolean;
  error: string | null;
}

export const useApiKeysStore = defineStore('apiKeys', {
  state: (): ApiKeysState => ({
    apiKeys: [],
    loading: false,
    error: null,
  }),

  actions: {
    async listApiKeys(): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.getAll();
        this.apiKeys = response.data.apiKeys;
        return { success: true };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to fetch API keys';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async createApiKey(data: CreateApiKeyRequest): Promise<StoreActionResult<CreateApiKeyResponse>> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.create(data);
        await this.listApiKeys(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to create API key';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async revokeApiKey(id: number): Promise<StoreActionResult<RevokeApiKeyResponse>> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.revoke(id);
        await this.listApiKeys(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to revoke API key';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async removeApiKey(id: number): Promise<StoreActionResult<RevokeApiKeyResponse>> {
      this.loading = true;
      this.error = null;

      try {
        const response = await apiKeysAPI.remove(id);
        await this.listApiKeys(); // Refresh the list
        return { success: true, data: response.data };
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || 'Failed to delete API key';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
