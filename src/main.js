import "./styles/base.css";
import "./styles/components.css";
import { route, initRouter } from "./router.js";
import { initializeAuth, onAuthChange } from "./services/auth.js";
import { updateNav } from "./components/app-shell.js";
import { renderHome } from "./pages/home.js";
import { renderBrowse, renderCategory } from "./pages/browse.js";
import { renderDetail } from "./pages/detail.js";
import { renderSearch } from "./pages/search.js";
import { renderFavorites } from "./pages/favorites.js";
import { renderAuth } from "./pages/auth.js";
import { renderProfile } from "./pages/profile.js";

route("/", renderHome);
route("/browse", renderBrowse);
route("/browse/:category", renderCategory);
route("/poem/:id", renderDetail);
route("/search", renderSearch);
route("/favorites", renderFavorites);
route("/auth", renderAuth);
route("/profile", renderProfile);

await initializeAuth();
onAuthChange(() => updateNav());
initRouter();
