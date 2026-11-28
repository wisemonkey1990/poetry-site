import "@fontsource/noto-serif-sc/400.css";
import "@fontsource/noto-serif-sc/600.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/redesign.css";
import "./styles/ink.css";
import { applyAmbience } from "./utils/ambience.js";
import { route, initRouter, onRouteChange, navigate, setNotFound } from "./router.js";
import { initializeAuth, onAuthChange } from "./services/auth.js";
import { trackPageView } from "./services/analytics.js";
import { initializeBackgroundMusic } from "./services/background-music.js";
import { updateNav } from "./components/app-shell.js";
import { resetSeo } from "./utils/seo.js";
import { initErrorReporting, reportError } from "./services/error-reporting.js";

applyAmbience();
initErrorReporting();
window.addEventListener("shijing:route-error", (event) => reportError(event.detail, "route"));
const pages = {
  home: () => import("./pages/home.js"), browse: () => import("./pages/browse.js"),
  detail: () => import("./pages/detail.js"), search: () => import("./pages/search.js"),
  favorites: () => import("./pages/favorites.js"), auth: () => import("./pages/auth.js"),
  profile: () => import("./pages/profile.js"), adminLogin: () => import("./pages/admin/login.js"),
  adminDashboard: () => import("./pages/admin/dashboard.js"),
  adminUsers: () => import("./pages/admin/users.js"),
  adminUserEditor: () => import("./pages/admin/user-editor.js"),
  notFound: () => import("./pages/not-found.js"),
};
const lazy = (loader, exportName) => async (...args) => (await loader())[exportName](...args);

// 手指按到（或鼠标移到）诗篇链接上就开始下载那一首，松手时数据多半已经到了
const prefetched = new Set();
const prefetchFromEvent = (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[href^="/poem/"]') : null;
  const id = link?.getAttribute("href")?.match(/^\/poem\/(\d+)$/)?.[1];
  if (!id || prefetched.has(id)) return;
  prefetched.add(id);
  pages.detail().then((m) => m.prefetchPoem(id)).catch(() => prefetched.delete(id));
};
document.addEventListener("pointerdown", prefetchFromEvent, { passive: true });
document.addEventListener("mouseover", prefetchFromEvent, { passive: true });

route("/", lazy(pages.home, "renderHome"));
route("/browse", lazy(pages.browse, "renderBrowse"));
route("/browse/:category", lazy(pages.browse, "renderCategory"));
route("/poem/:id", lazy(pages.detail, "renderDetail"));
route("/search", lazy(pages.search, "renderSearch"));
route("/favorites", lazy(pages.favorites, "renderFavorites"));
route("/auth", lazy(pages.auth, "renderAuth"));
route("/profile", lazy(pages.profile, "renderProfile"));
route("/admin", () => { navigate("/admin/dashboard", { replace: true }); });
route("/admin/login", lazy(pages.adminLogin, "renderAdminLogin"));
route("/admin/dashboard", lazy(pages.adminDashboard, "renderAdminDashboard"));
route("/admin/users", lazy(pages.adminUsers, "renderAdminUsers"));
route("/admin/users/:id", lazy(pages.adminUserEditor, "renderAdminUserEditor"));
setNotFound(lazy(pages.notFound, "renderNotFound"));

// 发布新版本后，旧页面按需加载的分块已不存在：自动刷新一次拿到新版本
window.addEventListener("vite:preloadError", (event) => {
  try {
    if (sessionStorage.getItem("shijing_reloaded_for_update")) return;
    sessionStorage.setItem("shijing_reloaded_for_update", "1");
  } catch { return; }
  event.preventDefault();
  window.location.reload();
});
window.addEventListener("load", () => { setTimeout(() => { try { sessionStorage.removeItem("shijing_reloaded_for_update"); } catch { /* 忽略 */ } }, 10_000); });

// 离线阅读：生产环境注册 Service Worker（public/sw.js）
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

// 非阻塞初始化认证：路由先启动，auth 在后台就绪后通过 onAuthChange 更新导航
initializeAuth();
initializeBackgroundMusic();
onAuthChange(() => updateNav());
onRouteChange((path) => {
  resetSeo();
  setTimeout(() => trackPageView(path), 0);
});
initRouter();