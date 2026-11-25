import { getUserProfile, saveUserProfile, deleteUserProfile, resetUserPassword } from "../../services/users.js";
import { ADMIN_MIN_PASSWORD_LENGTH, generatePassword, validatePassword } from "../../utils/password.js";
import { escapeHtml, prepareAdminPage } from "./layout.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function renderAdminUserEditor(params) {
  const main = await prepareAdminPage("users");
  if (!main) return () => {};
  const isNew = params.id === "new";
  let profile = null;
  if (!isNew) {
    try { profile = await getUserProfile(params.id); }
    catch (error) { main.innerHTML = errorState(error.message); return () => {}; }
  }
  main.innerHTML = `<div class="admin-page">
    <div class="admin-page-heading"><div><p class="page-eyebrow">MEMBER PROFILE</p><h2>${isNew ? "新增用户资料" : "编辑用户资料"}</h2><p class="page-desc">${isNew ? "绑定一个已经存在的 Supabase Auth 用户" : `账号：${escapeHtml(profile.email || "—")}`}</p></div><a class="btn-secondary" href="#/admin/users">返回列表</a></div>
    <form class="editor-form user-editor-form" id="adminUserForm">
      <div class="form-group"><label for="userId">User UID <span class="required">*</span></label><input id="userId" name="id" value="${escapeHtml(profile?.id || "")}" ${isNew ? "" : "readonly"} required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"><p class="form-hint">来自 Supabase Authentication → Users；此页面不会创建登录账号。</p></div>
      ${profile?.email ? `<div class="form-group"><label>登录邮箱</label><input value="${escapeHtml(profile.email)}" readonly></div>` : ""}
      <div class="form-row"><div class="form-group"><label for="nickname">昵称 <span class="required">*</span></label><input id="nickname" name="nickname" value="${escapeHtml(profile?.nickname || "")}" maxlength="40" required></div><div class="form-group"><label for="status">资料状态</label><select id="status" name="status"><option value="1" ${profile?.status !== 0 ? "selected" : ""}>正常</option><option value="0" ${profile?.status === 0 ? "selected" : ""}>停用</option></select></div></div>
      <div class="form-group"><label for="avatarUrl">头像地址</label><input id="avatarUrl" name="avatarUrl" type="url" value="${escapeHtml(profile?.avatar_url || "")}" placeholder="https://..."></div>
      <div class="form-group"><label for="bio">个人简介</label><textarea id="bio" name="bio" maxlength="200" placeholder="最多 200 字">${escapeHtml(profile?.bio || "")}</textarea></div>
      ${profile ? `<div class="profile-metadata"><span>收藏 ${Number(profile.favorite_count || 0)} 篇</span><span>创建于 ${formatDate(profile.created_at)}</span><span>更新于 ${formatDate(profile.updated_at)}</span></div>` : ""}
      <p class="form-message" id="adminUserMessage" role="status"></p>
      <div class="btn-group"><button class="btn-primary" type="submit">保存资料</button><a class="btn-secondary" href="#/admin/users">取消</a>${!isNew ? `<button class="btn-danger" type="button" id="deleteUserProfile">删除资料</button>` : ""}</div>
    </form>
    ${profile ? `<form class="editor-form user-editor-form" id="adminResetPasswordForm" autocomplete="off">
      <h3>重置登录密码</h3>
      <p class="form-hint">为“${escapeHtml(profile.nickname)}”设置新的登录密码，并使其已登录的设备全部下线。请通过安全渠道把新密码告知用户，并提醒其登录后在个人中心自行修改。</p>
      <div class="form-group"><label for="newPassword">新密码 <span class="required">*</span></label><div class="btn-group"><input id="newPassword" name="newPassword" type="text" minlength="${ADMIN_MIN_PASSWORD_LENGTH}" maxlength="72" autocomplete="off" required placeholder="至少 ${ADMIN_MIN_PASSWORD_LENGTH} 位"><button class="btn-secondary" type="button" id="generatePassword">随机生成</button><button class="btn-secondary" type="button" id="copyPassword">复制</button></div></div>
      <p class="form-message" id="adminResetPasswordMessage" role="status"></p>
      <div class="btn-group"><button class="btn-danger" type="submit">重置密码</button></div>
    </form>` : ""}
  </div>`;
  bindEditor(isNew, profile);
  if (profile) bindResetPassword(profile);
  return () => {};
}

function bindEditor(isNew, profile) {
  const form = document.getElementById("adminUserForm");
  const message = document.getElementById("adminUserMessage");
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); message.textContent = "";
    const values = Object.fromEntries(new FormData(form));
    if (!UUID_PATTERN.test(values.id.trim())) { message.textContent = "请输入有效的 Supabase User UID"; return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      await saveUserProfile({ id: values.id.trim(), nickname: values.nickname.trim(), avatarUrl: values.avatarUrl.trim(), bio: values.bio.trim(), status: values.status });
      message.className = "form-message form-success"; message.textContent = "资料已保存";
      if (isNew) setTimeout(() => { window.location.hash = `#/admin/users/${values.id.trim()}`; }, 500);
    } catch (error) { message.className = "form-message form-error"; message.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  document.getElementById("deleteUserProfile")?.addEventListener("click", () => confirmDelete(profile));
}

function bindResetPassword(profile) {
  const form = document.getElementById("adminResetPasswordForm");
  const input = document.getElementById("newPassword");
  const message = document.getElementById("adminResetPasswordMessage");
  document.getElementById("generatePassword").addEventListener("click", () => { input.value = generatePassword(); message.textContent = ""; });
  document.getElementById("copyPassword").addEventListener("click", async () => {
    if (!input.value) return;
    try { await navigator.clipboard.writeText(input.value); message.className = "form-message form-success"; message.textContent = "已复制到剪贴板"; }
    catch { input.select(); message.className = "form-message"; message.textContent = "无法自动复制，请手动复制"; }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const problem = validatePassword(input.value);
    if (problem) { message.className = "form-message form-error"; message.textContent = problem; return; }
    confirmReset(profile, input.value, message, form);
  });
}

function confirmReset(profile, password, message, form) {
  const dialog = document.createElement("div"); dialog.className = "confirm-dialog";
  dialog.innerHTML = `<div class="confirm-dialog-box"><h3>重置密码？</h3><p>将重置“${escapeHtml(profile.nickname)}”（${escapeHtml(profile.email || "—")}）的登录密码，并使其所有已登录设备下线。此操作不可撤销。</p><div class="btn-group"><button class="btn-cancel" type="button">取消</button><button class="btn-danger" type="button">确认重置</button></div></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector(".btn-cancel").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".btn-danger").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      await resetUserPassword(profile.id, password);
      message.className = "form-message form-success"; message.textContent = "密码已重置，请把新密码告知用户（离开页面后将无法再查看）";
    } catch (error) { message.className = "form-message form-error"; message.textContent = error.message; }
    finally { dialog.remove(); form.querySelector('[type="submit"]').disabled = false; }
  });
}

function confirmDelete(profile) {
  const dialog = document.createElement("div"); dialog.className = "confirm-dialog";
  dialog.innerHTML = `<div class="confirm-dialog-box"><h3>删除用户资料？</h3><p>只删除“${escapeHtml(profile.nickname)}”的公开资料，不删除登录账号、密码和收藏。</p><div class="btn-group"><button class="btn-cancel" type="button">取消</button><button class="btn-danger" type="button">确认删除</button></div></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector(".btn-cancel").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".btn-danger").addEventListener("click", async (event) => { event.currentTarget.disabled = true; try { await deleteUserProfile(profile.id); window.location.hash = "#/admin/users"; dialog.remove(); } catch (error) { alert(error.message); event.currentTarget.disabled = false; } });
}

function errorState(message) { return `<div class="admin-page"><div class="empty-state"><h2>无法载入用户资料</h2><p>${escapeHtml(message)}</p><a class="btn-secondary" href="#/admin/users">返回用户列表</a></div></div>`; }
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value)) : "—";
