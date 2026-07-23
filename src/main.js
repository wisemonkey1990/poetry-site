import "./styles/base.css";
import "./styles/components.css";
import "./styles/admin.css";
import { route, initRouter } from "./router.js";
import { initializeAuth, onAuthChange } from "./services/auth.js";
import { trackPageView } from "./services/analytics.js";
import { initializeBackgroundMusic } from "./services/background-music.js";
import { updateNav } from "./components/app-shell.js";
import { resetSeo } from "./utils/seo.js";
const pages = {
  home: () => import("./pages/home.js"), browse: () => import("./pages/browse.js"),
  detail: () => import("./pages/detail.js"), search: () => import("./pages/search.js"),
  favorites: () => import("./pages/favorites.js"), auth: () => import("./pages/auth.js"),
  profile: () => import("./pages/profile.js"), adminLogin: () => import("./pages/admin/login.js"),
  adminDashboard: () => import("./pages/admin/dashboard.js"), adminPoems: () => import("./pages/admin/poems.js"),
  adminPoemEditor: () => import("./pages/admin/poem-editor.js"), adminUsers: () => import("./pages/admin/users.js"),
  adminUserEditor: () => import("./pages/admin/user-editor.js"),
};
const lazy = (loader, exportName) => async (...args) => (await loader())[exportName](...args);

route("/", lazy(pages.home, "renderHome"));
route("/browse", lazy(pages.browse, "renderBrowse"));
route("/browse/:category", lazy(pages.browse, "renderCategory"));
route("/poem/:id", lazy(pages.detail, "renderDetail"));
route("/search", lazy(pages.search, "renderSearch"));
route("/favorites", lazy(pages.favorites, "renderFavorites"));
route("/auth", lazy(pages.auth, "renderAuth"));
route("/profile", lazy(pages.profile, "renderProfile"));
route("/admin", () => { window.location.hash = "#/admin/dashboard"; });
route("/admin/login", lazy(pages.adminLogin, "renderAdminLogin"));
route("/admin/dashboard", lazy(pages.adminDashboard, "renderAdminDashboard"));
route("/admin/poems", lazy(pages.adminPoems, "renderAdminPoems"));
route("/admin/poems/:id", lazy(pages.adminPoemEditor, "renderAdminPoemEditor"));
route("/admin/users", lazy(pages.adminUsers, "renderAdminUsers"));
route("/admin/users/:id", lazy(pages.adminUserEditor, "renderAdminUserEditor"));

await initializeAuth();
initializeBackgroundMusic();
onAuthChange(() => updateNav());
window.addEventListener("hashchange", () => {
  resetSeo();
  const path = window.location.hash.slice(1) || "/";
  setTimeout(() => trackPageView(path), 0);
});
initRouter();
setTimeout(() => trackPageView(window.location.hash.slice(1) || "/"), 0);