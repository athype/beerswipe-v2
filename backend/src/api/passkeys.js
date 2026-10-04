import express from "express";
import { env } from "../env.js";
import { authenticateRequest, generateToken, requireAdmin } from "../middleware/auth.js";
import { Passkey, User } from "../models/index.js";
import {
  clearChallenge,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  getChallenge,
  origin,
  rpID,
  rpName,
  storeChallenge,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "../utils/webauthn.js";
import {
  passkeyLoginOptionsSchema,
  passkeyLoginVerifySchema,
  passkeyRegisterVerifySchema,
} from "../validation/contracts.js";

const router = express.Router();

/**
 * @openapi
 * /passkeys/register-options:
 *   post:
 *     summary: Start passkey registration for the current admin
 *     description: >
 *       Returns WebAuthn registration options (`PublicKeyCredentialCreationOptionsJSON`).
 *       The challenge is stored server-side keyed to the admin and expires after
 *       a short TTL — call register-verify right after the browser ceremony.
 *     tags: [Passkeys]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: WebAuthn registration options (pass to navigator.credentials.create)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/register-options", authenticateRequest, requireAdmin, async (req, res) => {
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
        userVerification: "required",
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

/**
 * @openapi
 * /passkeys/register-verify:
 *   post:
 *     summary: Verify and store a passkey registration
 *     description: Send the credential produced by the browser ceremony started via register-options.
 *     tags: [Passkeys]
 *     security:
 *       - authToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credential:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Registration credential from navigator.credentials.create
 *               deviceName:
 *                 type: string
 *                 maxLength: 100
 *                 description: Defaults to "Unnamed Device"
 *             required: [credential]
 *     responses:
 *       200:
 *         description: Registration verified and passkey stored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified: { type: boolean, enum: [true] }
 *                 message: { type: string }
 *       400:
 *         description: Invalid payload, expired/missing challenge, or verification failed
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/register-verify", authenticateRequest, requireAdmin, async (req, res) => {
  try {
    const user = req.user;
    const parsedBody = passkeyRegisterVerifySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid passkey registration payload" });
    }

    const { credential, deviceName } = parsedBody.data;

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

/**
 * @openapi
 * /passkeys/login-options:
 *   post:
 *     summary: Start passkey login
 *     description: >
 *       Returns WebAuthn authentication options. When `username` is given, only
 *       that user's passkeys are allowed; otherwise any passkey registered with
 *       this server works. Username enumeration is avoided by returning empty
 *       allowCredentials for unknown users.
 *     tags: [Passkeys]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *     responses:
 *       200:
 *         description: WebAuthn authentication options (pass to navigator.credentials.get)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Invalid payload
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/login-options", async (req, res) => {
  try {
    const parsedBody = passkeyLoginOptionsSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid passkey login options payload" });
    }

    const { username } = parsedBody.data;

    // To prevent user enumeration, we always return a challenge with empty allowCredentials
    // The authenticator will present all available credentials for this RP
    let allowCredentials = [];

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
    console.error("Generate authentication options error:", error);
    res.status(500).json({ error: "Failed to generate authentication options" });
  }
});

/**
 * @openapi
 * /passkeys/login-verify:
 *   post:
 *     summary: Verify a passkey login
 *     description: >
 *       Verifies the assertion from the browser ceremony and, on success, sets
 *       the `authToken` cookie — same session as a password login.
 *     tags: [Passkeys]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credential:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Assertion credential from navigator.credentials.get
 *             required: [credential]
 *     responses:
 *       200:
 *         description: Login successful — sets the authToken cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 user: { $ref: "#/components/schemas/AuthUser" }
 *       400:
 *         description: Invalid payload or expired/missing challenge
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       401:
 *         description: Unknown passkey, inactive user, or verification failed
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.post("/login-verify", async (req, res) => {
  try {
    const parsedBody = passkeyLoginVerifySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid passkey authentication payload" });
    }

    const { credential } = parsedBody.data;

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

    let actualChallenge;
    try {
      const clientDataJSON = Buffer.from(
        credential.response.clientDataJSON,
        "base64url",
      ).toString("utf8");
      const parsedClientData = JSON.parse(clientDataJSON);

      if (typeof parsedClientData.challenge !== "string" || parsedClientData.challenge.length === 0) {
        return res.status(400).json({ error: "Invalid credential payload" });
      }

      actualChallenge = parsedClientData.challenge;
    }
    catch {
      return res.status(400).json({ error: "Invalid credential payload" });
    }

    const storedChallenge = getChallenge(`auth-${actualChallenge}`);

    if (!storedChallenge) {
      return res.status(400).json({ error: "Challenge expired or not found" });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
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
      secure: env.NODE_ENV === "production",
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

/**
 * @openapi
 * /passkeys:
 *   get:
 *     summary: List the current admin's passkeys
 *     description: Newest first; credential material is never returned.
 *     tags: [Passkeys]
 *     security:
 *       - authToken: []
 *     responses:
 *       200:
 *         description: The admin's registered passkeys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 passkeys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       deviceName: { type: string }
 *                       transports:
 *                         type: array
 *                         items: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       lastUsedAt: { type: string, format: date-time, nullable: true }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.get("/", authenticateRequest, requireAdmin, async (req, res) => {
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

/**
 * @openapi
 * /passkeys/{id}:
 *   delete:
 *     summary: Delete one of the current admin's passkeys
 *     description: Only passkeys owned by the calling admin can be deleted.
 *     tags: [Passkeys]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Passkey deleted
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Message" }
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Passkey not found (or not owned by this admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.delete("/:id", authenticateRequest, requireAdmin, async (req, res) => {
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

/**
 * @openapi
 * /passkeys/{id}:
 *   put:
 *     summary: Rename one of the current admin's passkeys
 *     description: Only passkeys owned by the calling admin can be renamed.
 *     tags: [Passkeys]
 *     security:
 *       - authToken: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceName: { type: string, maxLength: 100 }
 *             required: [deviceName]
 *     responses:
 *       200:
 *         description: Passkey updated (full stored record returned)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 passkey:
 *                   type: object
 *                   allOf:
 *                     - $ref: "#/components/schemas/Passkey"
 *                     - type: object
 *                       properties:
 *                         publicKey:
 *                           type: string
 *                           description: Stored credential public key (base64url)
 *       401:
 *         description: Missing or invalid authToken cookie
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       404:
 *         description: Passkey not found (or not owned by this admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/Error" }
 *       500:
 *         $ref: "#/components/responses/InternalError"
 */
router.put("/:id", authenticateRequest, requireAdmin, async (req, res) => {
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
