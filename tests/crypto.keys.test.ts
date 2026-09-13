import { beforeAll, describe, expect, test } from "vitest";
import {
  generateRSAKeyPair,
  keyPairMatches,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "../src/lib/services/crypto/keys";

let privateKey: CryptoKey;
let publicKey: CryptoKey;

beforeAll(async () => {
  ({ privateKey, publicKey } = await generateRSAKeyPair());
}, 30_000);

describe("vault envelope", () => {
  test("round-trips a private key using the versioned random-salt format", async () => {
    const wrapped = await wrapPrivateKey(privateKey, "a strong vault passphrase");
    const envelope = JSON.parse(wrapped);
    expect(envelope).toMatchObject({
      version: 2,
      kdf: "PBKDF2-SHA256",
      cipher: "AES-256-GCM",
    });

    const restored = await unwrapPrivateKey(wrapped, "a strong vault passphrase");
    expect(await keyPairMatches(publicKey, restored)).toBe(true);
  }, 30_000);

  test("uses a fresh salt for every backup", async () => {
    const first = JSON.parse(await wrapPrivateKey(privateKey, "same password"));
    const second = JSON.parse(await wrapPrivateKey(privateKey, "same password"));
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
  }, 30_000);

  test("rejects a wrong password", async () => {
    const wrapped = await wrapPrivateKey(privateKey, "correct password");
    await expect(unwrapPrivateKey(wrapped, "wrong password")).rejects.toBeDefined();
  }, 30_000);
});
