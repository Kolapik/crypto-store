import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const HASH_PREFIX = "scrypt-v1";
const KEY_LENGTH = 64;
const DEFAULT_MAXMEM = 64 * 1024 * 1024;
const SCRYPT_OPTIONS: ScryptOptions = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: DEFAULT_MAXMEM,
};

function deriveKey(password: string, salt: Buffer, length = KEY_LENGTH, options = SCRYPT_OPTIONS) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const salt = randomBytes(16);
  const hash = await deriveKey(password, salt);

  return [
    HASH_PREFIX,
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) return false;

  const [, n, r, p, saltBase64, hashBase64] = parts;
  const parsedN = Number(n);
  const parsedR = Number(r);
  const parsedP = Number(p);

  if (
    !Number.isInteger(parsedN) ||
    !Number.isInteger(parsedR) ||
    !Number.isInteger(parsedP) ||
    parsedN <= 0 ||
    parsedR <= 0 ||
    parsedP <= 0
  ) {
    return false;
  }

  try {
    const parsedOptions: ScryptOptions = {
      N: parsedN,
      r: parsedR,
      p: parsedP,
      maxmem: DEFAULT_MAXMEM,
    };
    const salt = Buffer.from(saltBase64, "base64url");
    const expectedHash = Buffer.from(hashBase64, "base64url");
    const actualHash = await deriveKey(password, salt, expectedHash.length, parsedOptions);

    return (
      expectedHash.length === actualHash.length &&
      timingSafeEqual(expectedHash, actualHash)
    );
  } catch {
    return false;
  }
}
