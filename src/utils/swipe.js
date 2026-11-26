/**
 * 移动端左右滑动手势：仅识别明显的水平快速滑动，避免与竖向滚动、划选文字、
 * 横向滚动区域（如竖排正文）及系统边缘返回手势冲突。
 */

export const SWIPE_DEFAULTS = {
  minDistance: 64,     // 水平位移至少 64px
  maxDuration: 700,    // 手指停留超过 700ms 视为拖动或长按，不算滑动
  directionRatio: 1.8, // 水平位移须明显大于竖直位移
  lockSlop: 12,        // 移动超过该距离后判定方向，竖向则放弃本次手势
  edgeGuard: 24        // 屏幕左右边缘留给系统返回手势
};

/**
 * 根据起止坐标与用时判定滑动方向。
 * @returns {"left"|"right"|null}
 */
export function classifySwipe({ dx, dy, duration }, options = {}) {
  const { minDistance, maxDuration, directionRatio } = { ...SWIPE_DEFAULTS, ...options };
  if (duration > maxDuration) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < minDistance || absX < absY * directionRatio) return null;
  return dx < 0 ? "left" : "right";
}

const IGNORED_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true'], dialog, [data-no-swipe]";

/** 起点位于可横向滚动的元素内时交给原生滚动 */
function isInsideHorizontalScroller(target, root) {
  for (let el = target; el && el !== root.parentElement; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

function hasTextSelection() {
  const selection = window.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

/**
 * 在 root 上监听触摸滑动。
 * @param {HTMLElement} root
 * @param {{ onSwipeLeft?: () => void, onSwipeRight?: () => void }} handlers
 * @returns {() => void} 解除监听
 */
export function bindHorizontalSwipe(root, { onSwipeLeft, onSwipeRight }, options = {}) {
  const config = { ...SWIPE_DEFAULTS, ...options };
  let start = null;

  const reset = () => { start = null; };

  const onTouchStart = (event) => {
    if (event.touches.length !== 1) { reset(); return; }
    const touch = event.touches[0];
    const target = event.target instanceof Element ? event.target : null;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    if (!target
      || target.closest(IGNORED_SELECTOR)
      || touch.clientX < config.edgeGuard
      || touch.clientX > viewportWidth - config.edgeGuard
      || hasTextSelection()
      || isInsideHorizontalScroller(target, root)) { reset(); return; }
    start = { x: touch.clientX, y: touch.clientY, time: Date.now(), locked: false };
  };

  const onTouchMove = (event) => {
    if (!start) return;
    if (event.touches.length !== 1) { reset(); return; }
    if (start.locked) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < config.lockSlop) return;
    // 先出现竖向移动即视为滚动页面，本次不再识别为翻页
    if (Math.abs(dy) >= Math.abs(dx)) { reset(); return; }
    start.locked = true;
  };

  const onTouchEnd = (event) => {
    if (!start) return;
    const touch = event.changedTouches[0];
    const begin = start;
    reset();
    if (!touch || hasTextSelection()) return;
    const direction = classifySwipe({ dx: touch.clientX - begin.x, dy: touch.clientY - begin.y, duration: Date.now() - begin.time }, config);
    if (direction === "left") onSwipeLeft?.();
    else if (direction === "right") onSwipeRight?.();
  };

  root.addEventListener("touchstart", onTouchStart, { passive: true });
  root.addEventListener("touchmove", onTouchMove, { passive: true });
  root.addEventListener("touchend", onTouchEnd, { passive: true });
  root.addEventListener("touchcancel", reset, { passive: true });
  return () => {
    root.removeEventListener("touchstart", onTouchStart);
    root.removeEventListener("touchmove", onTouchMove);
    root.removeEventListener("touchend", onTouchEnd);
    root.removeEventListener("touchcancel", reset);
  };
}
