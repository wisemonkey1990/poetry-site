// 时辰与节令：首页山水按“晨昼暮夜”变色，四季飘落不同的东西；夜里全站换成墨底泥金的“夜读”。
// 读者手动选过的时辰存在 localStorage，否则跟随本地时间。
const KEY = "shijing-time";
export const TIMES = /** @type {const} */ (["morning", "day", "dusk", "night"]);
export const TIME_LABELS = { morning: "晨", day: "昼", dusk: "暮", night: "夜" };

/** @param {Date} [now] */
export function timeOfDay(now = new Date()) {
  const h = now.getHours();
  if (h >= 5 && h < 8) return "morning";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

/** @param {Date} [now] */
export function seasonOf(now = new Date()) {
  const m = now.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

function savedTime() {
  try {
    const value = localStorage.getItem(KEY);
    return TIMES.includes(/** @type {any} */ (value)) ? value : null;
  } catch { return null; }
}

export function currentTime() {
  return document.documentElement.dataset.time || timeOfDay();
}

export function applyAmbience() {
  const root = document.documentElement;
  const time = savedTime() || timeOfDay();
  root.dataset.time = time;
  root.dataset.season = seasonOf();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", time === "night" ? "#0f1417" : "#3e2c1a");
  window.dispatchEvent(new CustomEvent("shijing:ambience", { detail: { time } }));
  return time;
}

/** @param {string} time */
export function setTime(time) {
  try {
    if (time === timeOfDay()) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, time);
  } catch { /* 隐私模式下不保存，只本次生效 */ }
  return applyAmbience();
}

/** 昼夜切换：夜 ↔ 当前（白天）时辰 */
export function toggleNight() {
  const auto = timeOfDay();
  return setTime(currentTime() === "night" ? (auto === "night" ? "day" : auto) : "night");
}
