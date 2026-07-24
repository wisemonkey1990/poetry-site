import { escapeHtml, escapeAttribute } from "../utils/html.js";
import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { getCurrentUser, getProfile, initializeAuth, signOut, updateProfile } from "../services/auth.js";
import { getFavoritePoems, migrateLegacyFavorites, removeFavorite } from "../services/favorites.js";

export async function renderProfile() {
  await initializeAuth();
  const user = getCurrentUser();
  if (!user) { window.location.hash = "#/auth?mode=login"; return () => {}; }
  setupShell(); renderShell(`<div class="profile-loading loading">正在展卷……</div>`);
  try {
    const migrated = await migrateLegacyFavorites();
    const [profile, favorites] = await Promise.all([getProfile(), getFavoritePoems()]);
    renderContent(user, profile, favorites, migrated);
  } catch (error) {
    renderShell(`<div class="empty-state"><div class="empty-icon">叹</div><p>${escapeHtml(error.message)}</p></div>`);
  }
  return () => {};
}

function renderContent(user, profile, favorites, migrated) {
  const html = `<section class="profile-page"><header class="profile-hero card"><div class="profile-seal">${(profile.nickname || user.email)[0]}</div><div><p class="page-eyebrow">PERSONAL COLLECTION</p><h1>${escapeHtml(profile.nickname)}</h1><p>${escapeHtml(user.email)}</p></div><button class="btn btn-outline" id="logoutBtn">退出登录</button></header>
    ${migrated ? `<div class="migration-note">已将本机原有的 ${migrated} 条收藏同步到账号。</div>` : ""}
    <div class="profile-grid"><section class="profile-panel card"><h2 class="note-heading">个人资料</h2><form id="profileForm" class="profile-form"><label><span>雅号</span><input name="nickname" value="${escapeHtml(profile.nickname || "")}" maxlength="40" required /></label><label><span>自述</span><textarea name="bio" maxlength="200" placeholder="写下一句自述……">${escapeHtml(profile.bio || "")}</textarea></label><p class="form-message" id="profileMessage"></p><button class="btn btn-primary" type="submit">保存资料</button></form></section>
      <section class="collection-panel"><div class="section-heading"><div class="section-title-wrap"><span class="section-mark">藏</span><div><h2 class="section-title">我的藏诗</h2><p class="section-note">共 ${favorites.length} 篇</p></div></div></div>
	        ${favorites.length ? `<div class="profile-favorites">${favorites.map(({ poem, created_at }) => `<article class="card profile-fav-item" data-id="${poem.id}"><a href="#/poem/${poem.id}" data-nav="/poem/${poem.id}"><h3>${escapeHtml(poem.title)}</h3><p>${escapeHtml(poem.content?.[0] ?? "")}</p><span>${escapeHtml(poem.chapter)} · ${escapeHtml(poem.section)} 收藏于 ${formatDate(created_at)}</span></a><button class="btn btn-ghost profile-remove" data-id="${poem.id}" aria-label="取消收藏${escapeAttribute(poem.title)}">取消收藏</button></article>`).join("")}</div>` : `<div class="empty-state"><div class="empty-icon">藏</div><p>尚未收藏诗篇。</p><a href="#/browse" class="btn btn-primary" data-nav="/browse">前往篇章</a></div>`}
      </section></div></section>`;
  renderShell(html); bindProfileActions();
}

function bindProfileActions() {
  document.getElementById("logoutBtn")?.addEventListener("click", async () => { await signOut(); updateNav(); window.location.hash = "#/"; });
  document.getElementById("profileForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const message = document.getElementById("profileMessage"); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await updateProfile({ nickname: data.nickname.trim(), bio: data.bio.trim() || null }); message.textContent = "资料已保存"; } catch (error) { message.textContent = error.message; } });
  document.querySelectorAll(".profile-remove").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { await removeFavorite(Number(button.dataset.id)); button.closest(".profile-fav-item")?.remove(); updateNav(); } catch (error) { button.disabled = false; alert(error.message); } }));
}


function formatDate(value) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)); }
