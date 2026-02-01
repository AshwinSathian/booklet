const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function createId(len = 10): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);

  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
