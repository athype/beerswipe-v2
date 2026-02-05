import express from "express";
import { authenticateToken, requireAdmin, generateToken } from "../middleware/auth.js";
import { Passkey, User } from "../models/index.js";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  rpName,
  rpID,
  origin,
  storeChallenge,
  getChallenge,
  clearChallenge,
} from "../utils/webauthn.js";
import { env } from "../env.js";

const router = express.Router();

router.post("/register-options", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = req.user;

    const existingPasskeys = await Passkey.findAll({
      where: { userId: user.id },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      userDisplayName: user.username,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    storeChallenge(`reg-${user.id}`, options.challenge);

    res.json(options);
  }
  catch (error) {
    console.error("Generate registration options error:", error);
    res.status(500).json({ error: "Failed to generate registration options" });
  }
});

router.post("/register-verify", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const { credential, deviceName } = req.body;

    const expectedChallenge = getChallenge(`reg-${user.id}`);
    if (!expectedChallenge) {
      return res.status(400).json({ error: "Challenge expired or not found" });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Verification failed" });
    }

    const { credential: credentialData } = verification.registrationInfo;

    // credential.id from browser is already base64url
    // credentialData.id is Uint8Array which would need conversion, but not necessary
    const credentialIdToStore = credential.id;
  if (env.NODE_ENV !== "production") {
      console.log("Registration - Browser credential.id:", credential.id);
      console.log("Registration - Storing credentialId:", credentialIdToStore);
      console.log("Registration - Match:", credential.id === credentialIdToStore);
    }
    await Passkey.create({
      userId: user.id,
      credentialId: credentialIdToStore,
      publicKey: Buffer.from(credentialData.publicKey).toString("base64url"),
      counter: credentialData.counter,
      transports: credential.response.transports || [],
      deviceName: deviceName || "Unnamed Device",
    });

    clearChallenge(`reg-${user.id}`);

    res.json({ verified: true, message: "Passkey registered successfully" });
  }
  catch (error) {
    console.error("Verify registration error:", error);
    res.status(500).json({ error: "Failed to verify registration" });
  }
});

router.post("/login-options", async (req, res) => {
  try {
    const { username } = req.body;

    let allowCredentials;

    if (username) {
      const user = await User.findOne({ where: { username } });
      if (user) {
        const passkeys = await Passkey.findAll({ where: { userId: user.id } });
        allowCredentials = passkeys.map(passkey => ({
          id: passkey.credentialId, // Already base64url string
          transports: passkey.transports,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });

    storeChallenge(`auth-${options.challenge}`, options.challenge);

    res.json(options);
  }
  catch (error) {
    res.status(500).json({ error: "Failed to generate authentication options" });
  }
});

router.post("/login-verify", async (req, res) => {
  try {
    const { credential } = req.body;
    
    const credentialId = credential.rawId || credential.id;

    const passkey = await Passkey.findOne({
      where: { credentialId },
      include: [{ model: User, as: "user" }],
    });

    if (!passkey) {
      return res.status(401).json({ error: "Passkey not found" });
    }

    const user = passkey.user;

    if (!user.isActive || !user.canLogin()) {
      return res.status(401).json({ error: "User cannot login" });
    }
    
    const actualChallenge = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, "base64url").toString()
    ).challenge;

    const storedChallenge = getChallenge(`auth-${actualChallenge}`);

    if (!storedChallenge) {
      return res.status(400).json({ error: "Challenge expired or not found" });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId, // Already base64url string
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: Number(passkey.counter),
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ error: "Verification failed" });
    }

    await passkey.update({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    });

    clearChallenge(`auth-${actualChallenge}`);

    const token = generateToken(user);

    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        userType: user.userType,
        credits: user.credits,
      },
    });
  }
  catch (error) {
    console.error("Verify authentication error:", error);
    res.status(500).json({ error: "Failed to verify authentication" });
  }
});

router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const passkeys = await Passkey.findAll({
      where: { userId: req.user.id },
      attributes: ["id", "deviceName", "createdAt", "lastUsedAt", "transports"],
      order: [["createdAt", "DESC"]],
    });

    res.json({ passkeys });
  }
  catch (error) {
    console.error("Get passkeys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const passkey = await Passkey.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!passkey) {
      return res.status(404).json({ error: "Passkey not found" });
    }

    await passkey.destroy();

    res.json({ message: "Passkey deleted successfully" });
  }
  catch (error) {
    console.error("Delete passkey error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { deviceName } = req.body;

    const passkey = await Passkey.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!passkey) {
      return res.status(404).json({ error: "Passkey not found" });
    }

    await passkey.update({ deviceName });

    res.json({ message: "Passkey updated successfully", passkey });
  }
  catch (error) {
    console.error("Update passkey error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
