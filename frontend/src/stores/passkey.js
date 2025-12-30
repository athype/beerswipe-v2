import { defineStore } from "pinia";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { passkeysAPI } from "../services/api.js";

export const usePasskeyStore = defineStore("passkey", {
  state: () => ({
    passkeys: [],
    loading: false,
    error: null,
    isSupported: false,
  }),

  actions: {
    async checkSupport() {
      try {
        this.isSupported = await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable() || false;
      }
      catch {
        this.isSupported = false;
      }
      return this.isSupported;
    },

    async registerPasskey(deviceName) {
      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await passkeysAPI.getRegistrationOptions();
        const credential = await startRegistration(optionsResponse.data);

        await passkeysAPI.verifyRegistration(credential, deviceName);

        await this.fetchPasskeys();
        return { success: true };
      }
      catch (error) {
        this.error = error.response?.data?.error || error.message || "Registration failed";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },

    async authenticateWithPasskey(username) {
      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await passkeysAPI.getLoginOptions(username);
        const credential = await startAuthentication(optionsResponse.data);

        const verifyResponse = await passkeysAPI.verifyLogin(credential);

        return { success: true, user: verifyResponse.data.user };
      }
      catch (error) {
        this.error = error.response?.data?.error || error.message || "Authentication failed";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },

    async fetchPasskeys() {
      this.loading = true;
      this.error = null;

      try {
        const response = await passkeysAPI.getAll();
        this.passkeys = response.data.passkeys;
      }
      catch (error) {
        this.error = error.response?.data?.error || "Failed to fetch passkeys";
      }
      finally {
        this.loading = false;
      }
    },

    async deletePasskey(id) {
      this.loading = true;
      this.error = null;

      try {
        await passkeysAPI.delete(id);
        this.passkeys = this.passkeys.filter(p => p.id !== id);
        return { success: true };
      }
      catch (error) {
        this.error = error.response?.data?.error || "Failed to delete passkey";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },

    async updatePasskey(id, deviceName) {
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
      catch (error) {
        this.error = error.response?.data?.error || "Failed to update passkey";
        return { success: false, error: this.error };
      }
      finally {
        this.loading = false;
      }
    },
  },
});
