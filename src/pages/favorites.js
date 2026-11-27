import { getCurrentUser } from "../services/auth.js";
import { navigate } from "../router.js";

export function renderFavorites() {
  if (!getCurrentUser()) navigate("/auth?mode=login");
  else navigate("/profile");
  return () => {};
}

export function setupFavorites() {}
