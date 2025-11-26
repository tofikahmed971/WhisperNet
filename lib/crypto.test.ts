import { describe, expect, test } from "bun:test";
import {
    generateKeyPair,
    exportKey,
    importKey,
    encryptMessage,
    decryptMessage,
    generateSymKey,
    encryptSymMessage,
    decryptSymMessage,
    exportSymKey,
    importSymKey
} from "./crypto";

describe("Crypto Logic", () => {
    test("should generate key pair", async () => {
        const keyPair = await generateKeyPair();
        expect(keyPair.publicKey).toBeDefined();
        expect(keyPair.privateKey).toBeDefined();
    });

    test("should export and import keys", async () => {
        const keyPair = await generateKeyPair();
        const exportedPublic = await exportKey(keyPair.publicKey);
        const importedPublic = await importKey(exportedPublic, ["encrypt"]);
        expect(importedPublic).toBeDefined();
    });

    test("should encrypt and decrypt message", async () => {
        const keyPair = await generateKeyPair();
        const message = "Hello, World!";
        const encrypted = await encryptMessage(keyPair.publicKey, message);
        const decrypted = await decryptMessage(keyPair.privateKey, encrypted);
        expect(decrypted).toBe(message);
    });

    test("should encrypt and decrypt symmetric message", async () => {
        const key = await generateSymKey();
        const message = "Secret Message";
        const encrypted = await encryptSymMessage(key, message);
        const decrypted = await decryptSymMessage(key, encrypted);
        expect(decrypted).toBe(message);
    });

    test("should export and import symmetric keys", async () => {
        const key = await generateSymKey();
        const exported = await exportSymKey(key);
        const imported = await importSymKey(exported);
        expect(imported).toBeDefined();

        // Verify imported key works
        const message = "Test Key Import";
        const encrypted = await encryptSymMessage(imported, message);
        const decrypted = await decryptSymMessage(key, encrypted); // Decrypt with original key
        expect(decrypted).toBe(message);
    });
});
