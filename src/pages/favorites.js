import { getCurrentUser } from "../services/auth.js";

export function renderFavorites() {
  if (!getCurrentUser()) window.location.hash = "#/auth?mode=login";
  else window.location.hash = "#/profile";
  return () => {};
}

export function setupFavorites() {}
