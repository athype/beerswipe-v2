import { defineStore } from "pinia";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { passkeysAPI } from "../services/api.ts";

export interface Passkey {
  id: number;
  deviceName: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface PasskeyState {
  passkeys: Passkey[];
  loading: boolean;
  error: string | null;
  isSupported: boolean;
}

interface ActionResult {
  success: boolean;
  error?: string;
  user?: unknown;
}

export const usePasskeyStore = defineStore("passkey", {
  state: (): PasskeyState => ({
    passkeys: [],
    loading: false,
    error: null,
    isSupported: false,
  }),

  actions: {
    async checkSupport(): Promise<boolean> {
      try {
        this.isSupported =
          (await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable()) ||
          false;
      } catch {
        this.isSupported = false;
      }
      return this.isSupported;
    },

    async registerPasskey(deviceName: string): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await passkeysAPI.getRegistrationOptions();
        const credential = await startRegistration({ optionsJSON: optionsResponse.data });

        await passkeysAPI.verifyRegistration(credential, deviceName);

        await this.fetchPasskeys();
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        this.error = err.response?.data?.error ?? err.message ?? "Registration failed";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async authenticateWithPasskey(username: string): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await passkeysAPI.getLoginOptions(username);
        const credential = await startAuthentication({ optionsJSON: optionsResponse.data });

        const verifyResponse = await passkeysAPI.verifyLogin(credential);
        const data = verifyResponse.data as { user: unknown };

        return { success: true, user: data.user };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        this.error = err.response?.data?.error ?? err.message ?? "Authentication failed";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async fetchPasskeys(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const response = await passkeysAPI.getAll();
        this.passkeys = (response.data as { passkeys: Passkey[] }).passkeys;
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to fetch passkeys";
      } finally {
        this.loading = false;
      }
    },

    async deletePasskey(id: number): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        await passkeysAPI.delete(id);
        this.passkeys = this.passkeys.filter((p) => p.id !== id);
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to delete passkey";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    async updatePasskey(id: number, deviceName: string): Promise<ActionResult> {
      this.loading = true;
      this.error = null;

      try {
        await passkeysAPI.update(id, deviceName);
        const passkey = this.passkeys.find((p) => p.id === id);
        if (passkey) {
          passkey.deviceName = deviceName;
        }
        return { success: true };
      } catch (error) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error ?? "Failed to update passkey";
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
  },
});
