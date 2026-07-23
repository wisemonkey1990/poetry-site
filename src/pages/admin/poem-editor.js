import { deletePoem, getAdminPoemById, savePoem, validatePoem } from "../../services/poems.js";
import { adminError, escapeHtml, prepareAdminPage } from "./layout.js";
import { setNavigationGuard } from "../../router.js";

export async function renderAdminPoemEditor({ id }) {
  const main = await prepareAdminPage("poems"); if (!main) return () => {};
  const isNew = id === "new"; let poem = null;
  try { if (!isNew) poem = await getAdminPoemById(id); if (!isNew && !poem) throw new Error("诗篇不存在"); }
  catch (error) { main.innerHTML = adminError(error.message); return () => {}; }
  main.innerHTML = editorTemplate(poem);
  return bindEditor(poem);
}

function editorTemplate(poem) {
  const value = poem ?? { chapter: "国风", section: "", content: [], sort_order: 0, is_published: false };
  return `<div class="admin-page"><div class="admin-page-heading"><div><p class="page-eyebrow">EDITOR</p><h2>${poem ? "编辑诗篇" : "新增诗篇"}</h2><p class="page-desc">正文每行对应一段或一句</p></div><a class="btn-secondary" href="#/admin/poems">返回列表</a></div>
  <form class="editor-form" id="adminPoemForm"><div class="form-row"><div class="form-group"><label>题目 *</label><input name="title" maxlength="100" required value="${escapeHtml(value.title)}"></div><div class="form-group"><label>排序</label><input name="sort_order" type="number" min="0" value="${value.sort_order}"></div></div>
  <div class="form-row"><div class="form-group"><label>章卷 *</label><select name="chapter" required>${["国风","小雅","大雅","周颂","鲁颂","商颂"].map((item) => `<option ${value.chapter === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="form-group"><label>小节 *</label><input name="section" maxlength="50" required value="${escapeHtml(value.section)}"></div></div>
  <div class="form-group"><label>正文 *</label><textarea class="content-field" name="content" required>${escapeHtml(value.content.join("\n"))}</textarea><p class="form-hint">每行一段；保存后作为结构化数组存入数据库。</p></div>
  <div class="form-row"><div class="form-group"><label>注释</label><textarea name="annotation">${escapeHtml(value.annotation)}</textarea></div><div class="form-group"><label>今译</label><textarea name="translation">${escapeHtml(value.translation)}</textarea></div></div>
  <label class="checkbox-group"><input name="is_published" type="checkbox" ${value.is_published ? "checked" : ""}> 发布后在前台展示</label>
  <p id="editorMessage" class="form-message"></p><div class="btn-group"><button class="btn-primary" type="submit">保存诗篇</button><a class="btn-secondary" href="#/admin/poems">取消</a>${poem && !poem.is_published ? `<button class="btn-danger" type="button" id="deletePoem">删除草稿</button>` : ""}</div></form></div>`;
}

function bindEditor(poem) {
  const form = document.getElementById("adminPoemForm"); let dirty = false;
  form.addEventListener("input", () => { dirty = true; });
  const beforeUnload = (event) => { if (dirty) event.preventDefault(); };
  const removeGuard = setNavigationGuard(() => !dirty || window.confirm("当前修改尚未保存，确定离开吗？"));
  window.addEventListener("beforeunload", beforeUnload);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = form.querySelector("button[type=submit]"); const message = document.getElementById("editorMessage");
    const raw = Object.fromEntries(new FormData(form)); raw.is_published = form.elements.is_published.checked; if (poem) { raw.id = poem.id; raw.slug = poem.slug; }
    try { validatePoem(raw); button.disabled = true; button.textContent = "保存中……"; const saved = await savePoem(raw); dirty = false; message.textContent = "保存成功"; window.location.hash = `#/admin/poems/${saved.id}`; }
    catch (error) { message.textContent = error.message; button.disabled = false; button.textContent = "保存诗篇"; }
  });
  document.getElementById("deletePoem")?.addEventListener("click", async () => {
    if (!window.confirm(`确定删除草稿《${poem.title}》吗？此操作不可恢复。`)) return;
    try { await deletePoem(poem.id); dirty = false; window.location.hash = "#/admin/poems"; } catch (error) { document.getElementById("editorMessage").textContent = error.message; }
  });
  return () => { window.removeEventListener("beforeunload", beforeUnload); removeGuard(); };
}