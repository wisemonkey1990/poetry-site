/**
 * localStorage 收藏管理
 */

const STORAGE_KEY = "shijing_favorites";

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function isFavorite(poemId) {
  return getFavorites().includes(poemId);
}

export function toggleFavorite(poemId) {
  const favs = getFavorites();
  const idx = favs.indexOf(poemId);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(poemId);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  return !(idx >= 0); // true = added, false = removed
}

export function removeFavorite(poemId) {
  const favs = getFavorites().filter((id) => id !== poemId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}
