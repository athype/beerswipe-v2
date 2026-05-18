import type { ISODateString } from "./common.js";
import type { AuthUser } from "./domain.js";

export type AuthenticatorTransport =
  | "ble"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb"
  | string;

export type UserVerificationRequirement = "discouraged" | "preferred" | "required";

export type ResidentKeyRequirement = "discouraged" | "preferred" | "required";

export interface PublicKeyCredentialDescriptorJSON {
  id: string;
  type?: "public-key";
  transports?: AuthenticatorTransport[];
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id?: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: "public-key";
    alg: number;
  }>;
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[];
  authenticatorSelection?: {
    residentKey?: ResidentKeyRequirement;
    userVerification?: UserVerificationRequirement;
  };
  attestation?: string;
  [key: string]: unknown;
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  rpId?: string;
  timeout?: number;
  allowCredentials?: PublicKeyCredentialDescriptorJSON[];
  userVerification?: UserVerificationRequirement;
  [key: string]: unknown;
}

export interface WebAuthnRegistrationCredentialJSON {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON?: string;
    attestationObject?: string;
    transports?: AuthenticatorTransport[];
    [key: string]: unknown;
  };
  authenticatorAttachment?: string | null;
  clientExtensionResults?: Record<string, unknown>;
}

export interface WebAuthnAuthenticationCredentialJSON {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string | null;
    [key: string]: unknown;
  };
  authenticatorAttachment?: string | null;
  clientExtensionResults?: Record<string, unknown>;
}

export interface PasskeyDevice {
  id: number;
  deviceName: string;
  createdAt: ISODateString;
  lastUsedAt: ISODateString | null;
  transports: string[];
}

export interface PasskeyRecord extends PasskeyDevice {
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number | string;
  updatedAt: ISODateString;
}

export interface RegisterPasskeyVerifyRequest {
  credential: WebAuthnRegistrationCredentialJSON;
  deviceName?: string;
}

export interface RegisterPasskeyVerifyResponse {
  verified: boolean;
  message: string;
}

export interface LoginPasskeyOptionsRequest {
  username?: string;
}

export interface LoginPasskeyVerifyRequest {
  credential: WebAuthnAuthenticationCredentialJSON;
}

export interface LoginPasskeyVerifyResponse {
  message: string;
  user: AuthUser;
}

export interface ListPasskeysResponse {
  passkeys: PasskeyDevice[];
}

export interface DeletePasskeyResponse {
  message: string;
}

export interface UpdatePasskeyRequest {
  deviceName: string;
}

export interface UpdatePasskeyResponse {
  message: string;
  passkey: PasskeyRecord;
}
