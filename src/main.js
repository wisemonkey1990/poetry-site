import "./styles/base.css";
import "./styles/components.css";
import { route, initRouter } from "./router.js";
import { renderHome, setupHome } from "./pages/home.js";
import { renderBrowse, renderCategory, setupBrowse } from "./pages/browse.js";
import { renderDetail, setupDetail } from "./pages/detail.js";
import { renderSearch, setupSearch } from "./pages/search.js";
import { renderFavorites, setupFavorites } from "./pages/favorites.js";

// 注册路由
route("/", renderHome);
route("/browse", renderBrowse);
route("/browse/:category", renderCategory);
route("/poem/:id", renderDetail);
route("/search", renderSearch);
route("/favorites", renderFavorites);

// 启动
initRouter();

// 全局路由后处理钩子
export const afterRender = new Set();
window.addEventListener("hashchange", () => {
  setTimeout(() => afterRender.forEach((fn) => fn()), 0);
});
