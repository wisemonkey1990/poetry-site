/* 汉字数目：诗序、篇数、印文 */
/** 1 → 一，129 → 一百二十九 */
const DIGITS = "〇一二三四五六七八九";
export function chineseNumber(n) {
  const value = Math.trunc(Number(n));
  if (!Number.isFinite(value) || value <= 0) return String(n);
  const hundreds = Math.floor(value / 100); const tens = Math.floor((value % 100) / 10); const ones = value % 10;
  let out = "";
  if (hundreds) out += `${DIGITS[hundreds]}百`;
  if (tens) out += `${hundreds || tens > 1 ? DIGITS[tens] : ""}十`;
  else if (hundreds && ones) out += "零";
  if (ones) out += DIGITS[ones];
  return out;
}
