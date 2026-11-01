import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { env } from "../env.ts";

export const rpName = env.RP_NAME || "Beer Machine";
export const rpID = env.RP_ID || (env.NODE_ENV === "production" ? env.DOMAIN : "localhost");
export const origin = env.NODE_ENV === "production"
  ? `https://${env.DOMAIN}`
  : `https://localhost`;

type ChallengeRecord = { challenge: string; timestamp: number };

const challengeStore = new Map<string, ChallengeRecord>();

export function storeChallenge(identifier: string, challenge: string): void {
  challengeStore.set(identifier, {
    challenge,
    timestamp: Date.now(),
  });

  setTimeout(() => challengeStore.delete(identifier), 5 * 60 * 1000);
}

export function getChallenge(identifier: string): string | null {
  const data = challengeStore.get(identifier);
  if (!data)
    return null;

  if (Date.now() - data.timestamp > 5 * 60 * 1000) {
    challengeStore.delete(identifier);
    return null;
  }

  return data.challenge;
}

export function clearChallenge(identifier: string): void {
  challengeStore.delete(identifier);
}

export {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
};
