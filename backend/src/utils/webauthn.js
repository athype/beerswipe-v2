import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { env } from "../env.js";

export const rpName = env.RP_NAME || "Beer Machine";
export const rpID = env.RP_ID || (env.NODE_ENV === "production" ? env.DOMAIN : "localhost");
export const origin = env.NODE_ENV === "production"
  ? `https://${env.DOMAIN}`
  : `http://localhost:${env.FEPORT || 5173}`;

const challengeStore = new Map();

export function storeChallenge(identifier, challenge) {
  challengeStore.set(identifier, {
    challenge,
    timestamp: Date.now(),
  });

  setTimeout(() => challengeStore.delete(identifier), 5 * 60 * 1000);
}

export function getChallenge(identifier) {
  const data = challengeStore.get(identifier);
  if (!data) return null;

  if (Date.now() - data.timestamp > 5 * 60 * 1000) {
    challengeStore.delete(identifier);
    return null;
  }

  return data.challenge;
}

export function clearChallenge(identifier) {
  challengeStore.delete(identifier);
}

export {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};
