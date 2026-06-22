import { hashPassword } from "./_core/passwordHash";

const password = process.env.ADMIN_PASSWORD_PLAINTEXT ?? process.argv[2];

if (!password) {
  console.error(
    "Set ADMIN_PASSWORD_PLAINTEXT in your shell, then run: corepack pnpm auth:hash-password",
  );
  process.exit(1);
}

const hash = await hashPassword(password);
console.log(hash);
