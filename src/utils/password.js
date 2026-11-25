export const ADMIN_MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt 只使用前 72 字节

// 去掉了容易混淆的字符（0/O、1/l/I）
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 使用 Web Crypto 生成随机密码（拒绝采样，避免取模偏差）。 */
export function generatePassword(length = 12, cryptoImpl = globalThis.crypto) {
  const limit = 256 - (256 % CHARSET.length);
  let result = "";
  while (result.length < length) {
    const bytes = cryptoImpl.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < limit && result.length < length) result += CHARSET[byte % CHARSET.length];
    }
  }
  return result;
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < ADMIN_MIN_PASSWORD_LENGTH) return `密码至少 ${ADMIN_MIN_PASSWORD_LENGTH} 位`;
  if (password.length > MAX_PASSWORD_LENGTH) return `密码不能超过 ${MAX_PASSWORD_LENGTH} 位`;
  return "";
}
