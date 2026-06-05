import { defineStore } from "pinia";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type {
  AuthUser,
  DeletePasskeyResponse,
  ListPasskeysResponse,
  LoginPasskeyVerifyResponse,
  PasskeyDevice,
  RegisterPasskeyVerifyResponse,
  StoreActionResult,
  UpdatePasskeyResponse,
  WebAuthnAuthenticationCredentialJSON,
  WebAuthnRegistrationCredentialJSON,
} from "@beerswipe/types";
import { passkeysAPI } from "../services/api.js";

interface PasskeyState {
  passkeys: PasskeyDevice[];
  loading: boolean;
  error: string | null;
  isSupported: boolean;
}

interface PasskeyAuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
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
        this.isSupported = (await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable()) || false;
      }
      catch {
        this.isSupported = false;
      }
      return this.isSupported;
    },

    async registerPasskey(deviceName: string): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await passkeysAPI.getRegistrationOptions();
        const credential = await startRegistration(optionsResponse.data as any);

        await passkeysAPI.verifyRegistration(
          credential as WebAuthnRegistrationCredentialJSON,
          deviceName
        );

        await this.fetchPasskeys();
        return { success: true };
      }
      catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        this.error = err.response?.data?.error || err.message || "Registration failed";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },

    async authenticateWithPasskey(username?: string): Promise<PasskeyAuthResult> {
      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await passkeysAPI.getLoginOptions(username);
        const credential = await startAuthentication(optionsResponse.data as any);

        const verifyResponse = await passkeysAPI.verifyLogin(
          credential as WebAuthnAuthenticationCredentialJSON
        );

        return { success: true, user: verifyResponse.data.user };
      }
      catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        this.error = err.response?.data?.error || err.message || "Authentication failed";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },

    async fetchPasskeys(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const response = await passkeysAPI.getAll();
        this.passkeys = response.data.passkeys;
      }
      catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || "Failed to fetch passkeys";
      }
      finally {
        this.loading = false;
      }
    },

    async deletePasskey(id: number): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        await passkeysAPI.delete(id);
        this.passkeys = this.passkeys.filter(p => p.id !== id);
        return { success: true };
      }
      catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || "Failed to delete passkey";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },

    async updatePasskey(id: number, deviceName: string): Promise<StoreActionResult> {
      this.loading = true;
      this.error = null;

      try {
        await passkeysAPI.update(id, deviceName);
        const passkey = this.passkeys.find(p => p.id === id);
        if (passkey) {
          passkey.deviceName = deviceName;
        }
        return { success: true };
      }
      catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        this.error = err.response?.data?.error || "Failed to update passkey";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },
  },
});
