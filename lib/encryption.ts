import CryptoJS from "crypto-js";

const KEY = process.env.ENCRYPTION_KEY || "fallback-key-32-chars-exactly!!";

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
