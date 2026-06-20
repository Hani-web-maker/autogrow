import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 16) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is required and must be at least 16 characters long"
  );
}
const KEY: string = ENCRYPTION_KEY;

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, KEY).toString();
}

export function decrypt(cipherText: string): string {
  const bytes = CryptoJS.AES.decrypt(cipherText, KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function encryptJSON(obj: Record<string, unknown>): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptJSON<T>(cipherText: string): T {
  return JSON.parse(decrypt(cipherText)) as T;
}
