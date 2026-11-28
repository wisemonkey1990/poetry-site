import { html, raw, setHtml, textToHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import { getPoemPinyin, getTitlePinyin, getTraditionalText, preloadReading, renderRubyLines } from "../utils/reading.js";
import { getCurrentUser } from "../services/auth.js";
import { isFavorite, toggleFavorite } from "../services/favorites.js";
import { getPoemIndex, getPoemById } from "../services/poems.js";
import { updateSeo } from "../utils/seo.js";
import { showToast } from "../utils/toast.js";
import { navigate } from "../router.js";
import { bindHorizontalSwipe } from "../utils/swipe.js";
import { readSelectedText } from "../utils/selection.js";
import { songPaintingFor, hangingFor } from "../utils/song-art.js";
import { locateNotes, parseAnnotations } from "../utils/annotations.js";
import { chineseNumber } from "../utils/chinese-number.js";

function readPreference(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* 私密浏览或存储不可用时保持当前页面状态 */ }
}

function writeSessionValue(key, value) {
  try { sessionStorage.setItem(key, value); }
  catch { /* 会话存储不可用时仍跳转至登录页 */ }
}

/** 诗文字号：按全诗汉字数自适应（短诗大、长诗小），再乘用户的字号档位 */
const FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.7];
const DEFAULT_FONT_STEP = 1;

function autoFontSize(lines) {
  const count = lines.reduce((n, line) => n + Array.from(String(line)).filter((ch) => /[\u3400-\u9fff]/.test(ch)).length, 0);
  return Math.min(1.75, Math.max(1.1, 2 - 0.0045 * count));
}

/** 全诗最长一句（以 。！？；结尾）的汉字数，手机上据此缩字号，让每句诗正好排成一行 */
function longestSentence(lines) {
  let max = 1;
  for (const line of lines) {
    for (const sentence of String(line).split(/[。！？；]/)) {
      max = Math.max(max, Array.from(sentence).filter((ch) => /[\u3400-\u9fff]/.test(ch)).length);
    }
  }
  return max;
}

function readFontStep() {
  const step = Number(readPreference("shijing_font_step", DEFAULT_FONT_STEP));
  return Number.isInteger(step) && step >= 0 && step < FONT_SCALES.length ? step : DEFAULT_FONT_STEP;
}

const icon = {
  pdf: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg>`,
  pinyin: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
  layout: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 4h14v16H5zM9.5 4v16M14.5 4v16"/><path d="m7.2 7 1.1 1.2L7.2 9.4m5-2.4 1.1 1.2-1.1 1.2m5-2.4 1.1 1.2-1.1 1.2"/></svg>`,
  script: (traditional) => html`<span class="script-icon" aria-hidden="true">${traditional ? "简" : "繁"}</span>`,
  favorite: (filled) => html`<svg width="17" height="17" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  correct: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3Zm9-13 4 4"/></svg>`,
  more: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
  share: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>`
};

/**
 * 预取一首诗：正文、注音数据并行下载，失败不影响当前页面。翻篇前、手指按到链接上时调用。
 * @param {number | string} id
 */
export function prefetchPoem(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return;
  getPoemById(numericId).catch(() => {});
  preloadReading(numericId).catch(() => {});
}

/** 数据还没准备好时，过一会儿才显示「展卷中」，避免翻篇时闪一下；首次打开时保留预渲染的正文 */
const LOADING_DELAY_MS = 300;

export async function renderDetail({ id }) {
  const numericId = Number(id);
  const loadingTimer = setTimeout(() => { setupShell(); renderShell(html`<div class="loading page-loading">展卷中……</div>`); }, LOADING_DELAY_MS);
  try {
    return await renderDetailPage(numericId);
  } finally {
    clearTimeout(loadingTimer);
  }
}

async function renderDetailPage(numericId) {
  // 目录、正文、注音数据三路并行，不再一个等一个
  const [poems, poem] = await Promise.all([getPoemIndex(), getPoemById(numericId), preloadReading(numericId).catch(() => null)]);
  if (!poem) { updateSeo({ title: "未找到诗篇 · 诗三百", description: "该诗篇不存在或尚未发布。", noindex: true }); setupShell(); renderShell(html`<div class="empty-state">未找到此诗</div>`); return () => {}; }
  updateSeo({ title: `《${poem.title}》· 诗经 · 诗三百`, description: `${poem.chapter}·${poem.section}：${poem.content[0] || "阅读诗经原文、注释与今译。"}`.slice(0, 150) });
  const useTraditional = readPreference("shijing_script") === "traditional";
  const showPinyin = readPreference("shijing_show_pinyin") !== "false";
  const readingLayout = readPreference("shijing_reading_layout") === "vertical" ? "vertical" : "horizontal";
  // 收藏状态要查云端，不挡着正文显示：先按未收藏渲染，查到后再更新按钮
  const favorited = false;
  const currentIndex = poems.findIndex((item) => item.id === poem.id);
  const previous = currentIndex > 0 ? poems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? poems[currentIndex + 1] : null;

  let displayContent = [...poem.content];
  let displayTitle = poem.title;
  if (useTraditional) {
    const traditional = await getTraditionalText(poem);
    displayContent = traditional.lines;
    displayTitle = traditional.title;
  }
  const fontStep = readFontStep();
  const autoFs = autoFontSize(poem.content);
  const poemPinyin = await getPoemPinyin(poem);
  const titlePinyin = await getTitlePinyin(poem);
  const [titleRuby] = await renderRubyLines([displayTitle], titlePinyin ? [titlePinyin] : null);
  const rubyLines = await renderRubyLines(displayContent, poemPinyin);
  const markup = html`
    <article class="poem-page" data-layout="${readingLayout}">
      ${artMarkup(poem)}
      <header class="poem-header ${showPinyin ? "" : "hide-pinyin"}" id="poemHeader" data-glyph="${poem.chapter.slice(-1)}">
        <div class="poem-tags"><a class="tag tag-link" href="/browse/${encodeURIComponent(poem.chapter)}" data-nav="/browse/${poem.chapter}" title="查看${poem.chapter}全部篇目">${poem.chapter} · ${poem.section}</a><span class="tag">诗序 ${String(poem.id).padStart(3, "0")}</span></div>
        <div class="poem-title-row"><h1 class="${Array.from(displayTitle).length >= 5 ? "long-title" : ""}" aria-label="${displayTitle}">${raw(titleRuby)}</h1></div>
        <span class="poem-seal" aria-hidden="true">${chineseNumber(poem.id)}</span>
      </header>
      <section class="poem-paper layout-${readingLayout}" id="poemPaper" aria-label="诗篇正文" data-layout="${readingLayout}" data-paper="shan" style="--sent-n: ${longestSentence(poem.content)}; --poem-fs: ${autoFs.toFixed(3)}rem; --poem-scale: ${FONT_SCALES[fontStep]}">
        <div class="poem-scroll" id="poemScroll" tabindex="${readingLayout === "vertical" ? "0" : "-1"}"><div class="poem-body ${showPinyin ? "" : "hide-pinyin"}" id="poemBody">${displayContent.map((line, index) => html`<p class="poem-line" data-text="${line}">${raw(rubyLines[index])}</p>`)}</div></div>
        <p class="note-hint" aria-hidden="true">点有朱点的字，看注释</p>
      </section>
      ${gistMarkup(poem)}
      <div class="poem-notes-grid">
        <section class="poem-translation"><h2 class="note-heading">今译</h2>${poem.translation ? html`<div class="translation-content">${textToHtml(poem.translation)}</div>` : html`<p class="text-muted">此篇译文尚在整理。</p>`}</section>
        <section class="poem-annotations"><h2 class="note-heading">注释</h2>${poem.annotation ? html`<div class="annotation-content">${textToHtml(poem.annotation)}</div>` : html`<p class="text-muted">此篇注释尚在整理。</p>`}</section>
      </div>
      ${poem.sources?.translation ? html`<p class="notes-source">${poem.sources.annotation ? "注释、今译" : "今译"}参考：<a href="${poem.sources.translation}" target="_blank" rel="noopener noreferrer">国学梦</a></p>` : ""}
      <nav class="poem-nav" aria-label="诗篇导航">${previous ? html`<a href="/poem/${previous.id}" class="btn btn-outline" data-nav="/poem/${previous.id}"><span>← 上一篇</span><strong>${previous.title}</strong></a>` : html`<span></span>`}${next ? html`<a href="/poem/${next.id}" class="btn btn-outline" data-nav="/poem/${next.id}"><strong>${next.title}</strong><span>下一篇 →</span></a>` : html`<span></span>`}</nav>
      ${previous ? html`<a href="/poem/${previous.id}" class="page-turn page-turn-prev" data-nav="/poem/${previous.id}" aria-label="上一篇：${previous.title}" title="上一篇：${previous.title}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg><span class="page-turn-label" aria-hidden="true">上一篇<b>${previous.title}</b></span></a>` : ""}
      ${next ? html`<a href="/poem/${next.id}" class="page-turn page-turn-next" data-nav="/poem/${next.id}" aria-label="下一篇：${next.title}" title="下一篇：${next.title}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg><span class="page-turn-label" aria-hidden="true">下一篇<b>${next.title}</b></span></a>` : ""}
      <div class="reading-dock" id="readingDock" role="toolbar" aria-label="阅读工具">
        <div class="dock-main">
          <button type="button" class="dock-btn pinyin-toggle ${showPinyin ? "active" : ""}" id="pinyinToggle" aria-pressed="${showPinyin}" title="显示或隐藏拼音">${icon.pinyin}<span>注音</span></button>
          <button type="button" class="dock-btn layout-toggle ${readingLayout === "vertical" ? "active" : ""}" id="layoutToggle" aria-pressed="${readingLayout === "vertical"}" title="古籍竖排">${icon.layout}<span>竖排</span></button>
          <button type="button" class="dock-btn script-toggle ${useTraditional ? "active" : ""}" id="scriptToggle" aria-pressed="${useTraditional}" title="${useTraditional ? "切换为简体" : "切换为繁体"}">${icon.script(useTraditional)}<span class="tool-label">${useTraditional ? "简体" : "繁体"}</span></button>
          <i class="dock-sep" aria-hidden="true"></i>
          <button type="button" class="dock-btn fav-btn ${favorited ? "favorited" : ""}" id="favBtn" title="${favorited ? "取消收藏" : "收藏"}" aria-pressed="${favorited}">${icon.favorite(favorited)}<span>${favorited ? "已藏" : "收藏"}</span></button>
          <button type="button" class="dock-btn" id="shareBtn" title="生成分享诗卡">${icon.share}<span>诗卡</span></button>
          <button type="button" class="dock-btn dock-more" id="dockMore" aria-expanded="false" aria-controls="dockExtra" title="更多">${icon.more}<span>更多</span></button>
        </div>
        <div class="dock-extra" id="dockExtra">
          <div class="font-size-ctl" role="group" aria-label="诗文字号">
            <button type="button" class="dock-btn" id="fontSmaller" data-step="-1" aria-label="缩小字号" title="缩小字号"${fontStep === 0 ? " disabled" : ""}>A</button>
            <span class="font-size-label">字号</span>
            <button type="button" class="dock-btn" id="fontLarger" data-step="1" aria-label="放大字号" title="放大字号"${fontStep === FONT_SCALES.length - 1 ? " disabled" : ""}>A</button>
          </div>
          <button type="button" class="dock-btn" id="pdfBtn" aria-haspopup="dialog" title="下载排版精美的 PDF，可选是否注音">${icon.pdf}<span>PDF</span></button>
          <button type="button" class="dock-btn correction-btn" id="correctionBtn" aria-haspopup="dialog" title="发现错字或注音有误？点此纠错">${icon.correct}<span>纠错</span></button>
        </div>
      </div>
      <div class="note-pop" id="notePop" role="status" aria-live="polite" hidden></div>
    </article>`;
  setupShell(); renderShell(markup); bindActions(poem);
  const notes = parseAnnotations(poem.annotation, poem.content.join(""));
  markNotes(poem, notes);
  const unbindNotes = bindNotePopover(notes);
  bindDock();
  bindArtViewer(poem);
  const favButton = document.getElementById("favBtn");
  if (getCurrentUser() && favButton) {
    favButton.disabled = true;
    isFavorite(poem.id).then((added) => setFavoriteButton(favButton, added)).catch(() => {}).finally(() => { favButton.disabled = false; });
  }
  // 空闲时预取上一篇、下一篇，翻篇时直接命中缓存
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
  idle(() => { if (next) prefetchPoem(next.id); if (previous) prefetchPoem(previous.id); });
  if (readingLayout === "vertical") requestAnimationFrame(() => { const scroll = document.getElementById("poemScroll"); if (scroll) scroll.scrollLeft = scroll.scrollWidth; });
  // 手机端左右滑动切换诗篇：左滑下一篇，右滑上一篇，复用页脚上一篇/下一篇的目标
  const page = document.querySelector(".poem-page");
  const unbindSwipe = page ? bindHorizontalSwipe(page, {
    onSwipeLeft: () => { if (next) navigate(`/poem/${next.id}`); else showToast("已是最后一篇"); },
    onSwipeRight: () => { if (previous) navigate(`/poem/${previous.id}`); else showToast("已是第一篇"); }
  }) : null;
  // 电脑键盘：← 上一篇，→ 下一篇（输入框、对话框、竖排滚动区内不触发）
  const onKey = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest?.("#poemScroll, [role=dialog]"))) return;
    if (document.querySelector("[role=dialog]:not([hidden])")) return;
    const target = event.key === "ArrowLeft" ? previous : next;
    if (!target) return;
    event.preventDefault();
    navigate(`/poem/${target.id}`);
  };
  document.addEventListener("keydown", onKey);
  return () => { unbindSwipe?.(); unbindNotes(); document.removeEventListener("keydown", onKey); };
}

function setFavoriteButton(button, added) {
  button.classList.toggle("favorited", added);
  button.setAttribute("aria-pressed", String(added));
  button.title = added ? "取消收藏" : "收藏";
  setHtml(button, html`${icon.favorite(added)}<span>${added ? "已藏" : "收藏"}</span>`);
}

function bindActions(poem) {
  const pinyinToggles = [document.getElementById("pinyinToggle")].filter(Boolean);
  pinyinToggles.forEach((button) => button.addEventListener("click", () => {
    const body = document.getElementById("poemBody");
    const hidden = body.classList.toggle("hide-pinyin");
    document.getElementById("poemHeader")?.classList.toggle("hide-pinyin", hidden);
    writePreference("shijing_show_pinyin", String(!hidden));
    pinyinToggles.forEach((item) => { item.classList.toggle("active", !hidden); item.setAttribute("aria-pressed", String(!hidden)); });
  }));

  const scriptToggles = [document.getElementById("scriptToggle")].filter(Boolean);
  scriptToggles.forEach((button) => button.addEventListener("click", async () => {
    const nextTraditional = readPreference("shijing_script") !== "traditional";
    for (const btn of scriptToggles) { btn.disabled = true; btn.classList.add("script-pending"); }
    try {
      const converted = nextTraditional ? await getTraditionalText(poem) : { lines: [...poem.content], title: poem.title };
      const rubyLines = await renderRubyLines(converted.lines, await getPoemPinyin(poem));
      const body = document.getElementById("poemBody");
      const lines = body.querySelectorAll(".poem-line");
      for (let i = 0; i < lines.length; i++) {
        const text = converted.lines[i];
        if (text != null) { setHtml(lines[i], raw(rubyLines[i])); lines[i].dataset.text = text; }
      }
      markNotes(poem, parseAnnotations(poem.annotation, poem.content.join("")));
      const titleEl = document.querySelector(".poem-title-row h1");
      const convertedTitle = converted.title;
      if (titleEl && convertedTitle) {
        const titlePinyin = await getTitlePinyin(poem);
        const [titleRuby] = await renderRubyLines([convertedTitle], titlePinyin ? [titlePinyin] : null);
        setHtml(titleEl, raw(titleRuby));
        titleEl.setAttribute("aria-label", convertedTitle);
        titleEl.classList.toggle("long-title", Array.from(convertedTitle).length >= 5);
      }
      writePreference("shijing_script", nextTraditional ? "traditional" : "simplified");
      for (const btn of scriptToggles) {
        btn.classList.toggle("active", nextTraditional);
        btn.setAttribute("aria-pressed", String(nextTraditional));
        btn.title = nextTraditional ? "切换为简体" : "切换为繁体";
        btn.setAttribute("aria-label", nextTraditional ? "切换为简体中文" : "切换为繁体中文");
        const scriptIcon = btn.querySelector(".script-icon");
        if (scriptIcon) scriptIcon.textContent = nextTraditional ? "简" : "繁";
        const label = btn.querySelector(".tool-label");
        if (label) label.textContent = nextTraditional ? "简体" : "繁体";
      }
      showToast(nextTraditional ? "已切换为繁体中文" : "已切换为简体中文");
    } catch (err) { console.error("繁简转换失败", err); showToast("繁简转换暂不可用"); }
    finally { for (const btn of scriptToggles) { btn.disabled = false; btn.classList.remove("script-pending"); } }
  }));
  const layoutToggles = [document.getElementById("layoutToggle")].filter(Boolean);
  layoutToggles.forEach((button) => button.addEventListener("click", () => {
    const paper = document.getElementById("poemPaper");
    const scroll = document.getElementById("poemScroll");
    const vertical = !paper.classList.contains("layout-vertical");
    paper.classList.toggle("layout-vertical", vertical);
    paper.classList.toggle("layout-horizontal", !vertical);
    paper.dataset.layout = vertical ? "vertical" : "horizontal";
    paper.closest(".poem-page")?.setAttribute("data-layout", paper.dataset.layout);
    hideNotePop();
    scroll?.setAttribute("tabindex", vertical ? "0" : "-1");
    writePreference("shijing_reading_layout", vertical ? "vertical" : "horizontal");
    layoutToggles.forEach((item) => {
      item.classList.toggle("active", vertical);
      item.setAttribute("aria-pressed", String(vertical));
      item.title = vertical ? "切换为横排" : "古籍竖排";
    });
    requestAnimationFrame(() => { if (vertical && scroll) scroll.scrollLeft = scroll.scrollWidth; });
    showToast(vertical ? "已切换为古籍竖排" : "已切换为横排阅读");
  }));
  document.getElementById("favBtn")?.addEventListener("click", async () => {
    if (!getCurrentUser()) {
      writeSessionValue("shijing_auth_redirect", `${window.location.pathname}${window.location.search}`);
      navigate("/auth?mode=login");
      return;
    }
    const button = document.getElementById("favBtn");
    const currentlyFavorite = button.classList.contains("favorited");
    button.disabled = true;
    try {
      const added = await toggleFavorite(poem.id, currentlyFavorite);
      setFavoriteButton(button, added);
      showToast(added ? "已收入藏诗" : "已移出藏诗");
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
  const fontButtons = [document.getElementById("fontSmaller"), document.getElementById("fontLarger")];
  fontButtons.forEach((button) => button?.addEventListener("click", () => {
    const next = Math.min(FONT_SCALES.length - 1, Math.max(0, readFontStep() + Number(button.dataset.step)));
    document.getElementById("poemPaper")?.style.setProperty("--poem-scale", String(FONT_SCALES[next]));
    writePreference("shijing_font_step", String(next));
    fontButtons[0].disabled = next === 0;
    fontButtons[1].disabled = next === FONT_SCALES.length - 1;
    const vertical = document.getElementById("poemPaper")?.classList.contains("layout-vertical");
    const scroll = document.getElementById("poemScroll");
    if (vertical && scroll) requestAnimationFrame(() => { scroll.scrollLeft = scroll.scrollWidth; });
  }));
  const correctionBtn = document.getElementById("correctionBtn");
  if (correctionBtn) {
    // 指针按下时先记录划选内容，避免点击按钮后选区被清除
    let pendingQuote = "";
    correctionBtn.addEventListener("pointerdown", () => { pendingQuote = readSelectedText(); });
    correctionBtn.addEventListener("click", () => {
      import("../components/correction-dialog.js").then((m) => m.openCorrectionDialog({ poem, trigger: correctionBtn, initialQuote: pendingQuote || readSelectedText() }));
      pendingQuote = "";
    });
  }
  const pdfBtn = document.getElementById("pdfBtn");
  pdfBtn?.addEventListener("click", async () => {
    // PDF 跟随当前简/繁选择；默认选项跟随「显示拼音」开关
    const traditional = readPreference("shijing_script") === "traditional";
    let display = { title: poem.title, content: poem.content, chapter: poem.chapter, section: poem.section };
    if (traditional) {
      try {
        const [text, { convertLines }] = await Promise.all([getTraditionalText(poem), import("../utils/text-convert.js")]);
        const meta = await convertLines([poem.chapter, poem.section], "s2t");
        display = { title: text.title, content: text.lines, chapter: meta.lines[0], section: meta.lines[1] };
      } catch { /* 繁体转换失败则按简体 */ }
    }
    import("../components/pdf-dialog.js").then((m) => m.openPdfDialog({ poem, display, defaultPinyin: readPreference("shijing_show_pinyin") !== "false", trigger: pdfBtn }));
  });
  const shareBtn = document.getElementById("shareBtn");
  shareBtn?.addEventListener("click", async () => {
    // 诗卡跟随当前简/繁选择
    const traditional = readPreference("shijing_script") === "traditional" ? await getTraditionalText(poem) : null;
    const display = traditional ? { title: traditional.title, content: traditional.lines } : { title: poem.title, content: poem.content };
    import("../components/share-card-dialog.js").then((m) => m.openShareCardDialog({ poem, display, trigger: shareBtn }));
  });
}

/** 有注释的字：标上朱点，记下注释序号（繁简切换重排后要再标一次） */
function markNotes(poem, notes) {
  if (!notes.length) return;
  const marks = locateNotes(poem.content, notes);
  document.querySelectorAll("#poemBody .poem-line").forEach((line, index) => {
    const lineMarks = marks[index];
    if (!lineMarks?.size) return;
    line.querySelectorAll(".ruby-unit").forEach((unit, hanIndex) => {
      const note = lineMarks.get(hanIndex);
      if (note == null || !(unit instanceof HTMLElement)) return;
      unit.dataset.note = String(note);
      // 词的第一个字带朱点
      if (lineMarks.get(hanIndex - 1) !== note) unit.classList.add("note-head");
    });
  });
  document.getElementById("poemPaper")?.classList.add("has-notes");
}

function hideNotePop() {
  const pop = document.getElementById("notePop");
  if (pop && !pop.hidden) { pop.hidden = true; document.querySelectorAll(".ruby-unit.note-on").forEach((unit) => unit.classList.remove("note-on")); }
}

/** 点字看注：在字旁浮出一张小笺，Esc、点别处或滚动时收起 */
function bindNotePopover(notes) {
  const body = document.getElementById("poemBody");
  const pop = document.getElementById("notePop");
  if (!body || !pop || !notes.length) return () => {};
  const show = (unit) => {
    const index = Number(unit.dataset.note);
    const note = notes[index];
    if (!note) return;
    const units = [...body.querySelectorAll(`.ruby-unit[data-note="${index}"]`)];
    // 同一个词可能在几章里出现：只取被点的那一处
    const line = unit.closest(".poem-line");
    const group = units.filter((item) => item.closest(".poem-line") === line);
    const start = group.indexOf(unit);
    let from = start; while (from > 0 && group[from - 1].nextElementSibling === group[from]) from -= 1;
    let to = start; while (to < group.length - 1 && group[to].nextElementSibling === group[to + 1]) to += 1;
    const word = group.slice(from, to + 1);
    const chars = word.map((item) => item.querySelector("ruby")?.firstChild?.textContent ?? "").join("");
    const sounds = word.map((item) => item.querySelector("rt")?.textContent ?? "").filter(Boolean).join(" ");
    document.querySelectorAll(".ruby-unit.note-on").forEach((item) => item.classList.remove("note-on"));
    word.forEach((item) => item.classList.add("note-on"));
    setHtml(pop, html`<p class="note-pop-term"><b>${chars || note.term}</b>${sounds ? html`<em>${sounds}</em>` : ""}</p><p class="note-pop-gloss">${note.gloss}</p>`);
    pop.hidden = false;
    const rect = word[0].getBoundingClientRect();
    const last = word[word.length - 1].getBoundingClientRect();
    const box = pop.getBoundingClientRect();
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (narrow) { pop.style.left = ""; pop.style.top = ""; return; }
    const left = Math.min(window.innerWidth - box.width - 16, Math.max(16, (rect.left + last.right) / 2 - box.width / 2));
    const below = Math.max(rect.bottom, last.bottom) + 12;
    const top = below + box.height > window.innerHeight - 90 ? Math.min(rect.top, last.top) - box.height - 12 : below;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(Math.max(76, top))}px`;
  };
  const onClick = (event) => {
    const unit = event.target instanceof Element ? event.target.closest(".ruby-unit[data-note]") : null;
    if (unit instanceof HTMLElement && !readSelectedText()) { event.stopPropagation(); show(unit); }
  };
  const onDocClick = (event) => { if (!(event.target instanceof Element) || !event.target.closest("#notePop")) hideNotePop(); };
  const onKey = (event) => { if (event.key === "Escape") hideNotePop(); };
  body.addEventListener("click", onClick);
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", hideNotePop, { passive: true });
  document.getElementById("poemScroll")?.addEventListener("scroll", hideNotePop, { passive: true });
  return () => {
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", hideNotePop);
  };
}

/** 工具栏「更多」：手机上收起字号、PDF、纠错 */
function bindDock() {
  const more = document.getElementById("dockMore");
  const dock = document.getElementById("readingDock");
  more?.addEventListener("click", () => {
    const open = dock?.classList.toggle("open") ?? false;
    more.setAttribute("aria-expanded", String(open));
  });
}

export function setupDetail() {}

/** 诗旨：这首诗说什么、古人怎么读（《毛诗序》）、后世的流传与影响 */
function gistMarkup(poem) {
  const c = poem.commentary;
  if (!c?.gist) return "";
  return html`
    <section class="poem-gist" aria-labelledby="gistHeading">
      <h2 class="note-heading" id="gistHeading">诗旨</h2>
      <div class="gist-body">
        <div class="gist-block gist-main"><h3>这首诗说什么</h3><p>${c.gist}</p></div>
        ${c.mao ? html`<div class="gist-block gist-mao"><h3>古人怎么读</h3><blockquote><p>${c.mao}</p><cite>《毛诗序》</cite></blockquote><p class="gist-aside">《毛诗序》是汉代毛诗一派为每首诗写的题解，多从政治教化立论，后人常有不同读法。原文据《毛诗正义》。</p></div>` : ""}
        ${c.legacy?.length ? html`<div class="gist-block gist-legacy"><h3>流传与影响</h3><ul>${c.legacy.map((item) => html`<li>${item}</li>`)}</ul></div>` : ""}
      </div>
    </section>`;
}

/** 左栏真迹：有马和之画的配原画与高宗手书，其余配一幅意象相近的立轴 */
function artMarkup(poem) {
  const song = songPaintingFor(poem.id);
  if (song) {
    return html`
      <aside class="poem-scene poem-art is-song" aria-label="宋画">
        <figure class="art-frame art-painting">
          <button type="button" class="art-open" data-art="0" aria-label="细看马和之所画《${poem.title}》">
            <img src="${song.art}" srcset="${song.artSmall} 760w, ${song.art} 1600w" sizes="(min-width: 1100px) 34vw, 100vw" width="${song.w}" height="${song.h}" alt="南宋马和之所画《${poem.title}》诗意图" decoding="async" fetchpriority="high">
          </button>
          <figcaption><b>${song.caption}</b><span>${song.source.museum}藏</span></figcaption>
        </figure>
        ${song.text ? html`
        <figure class="art-frame art-hand">
          <button type="button" class="art-open" data-art="1" aria-label="细看宋高宗手书《${poem.title}》">
            <img src="${song.text}" width="${song.tw}" height="${song.th}" alt="宋高宗赵构手书《${poem.title}》" loading="lazy" decoding="async">
          </button>
          <figcaption><b>传宋高宗赵构 书</b><span>与画同卷</span></figcaption>
        </figure>` : ""}
        <p class="art-note">八百多年前，南宋画家马和之为这首诗画了这幅画${song.text ? "，相传由宋高宗亲笔写下诗句" : ""}。点画可以放大细看。</p>
      </aside>`;
  }
  const hanging = hangingFor(poem);
  return html`
    <aside class="poem-scene poem-art is-hanging" aria-label="配画">
      <figure class="art-frame art-scroll">
        <button type="button" class="art-open" data-art="0" aria-label="细看配画：${hanging.caption}">
          <img src="${hanging.src}" srcset="${hanging.small} 760w, ${hanging.src} 1500w" sizes="(min-width: 1100px) 30vw, 100vw" width="${hanging.w}" height="${hanging.h}" alt="配画：${hanging.caption}" decoding="async">
        </button>
        <figcaption><b>${hanging.caption}</b><span>${hanging.museum}</span></figcaption>
      </figure>
    </aside>`;
}

function bindArtViewer(poem) {
  const aside = document.querySelector(".poem-art");
  if (!aside) return;
  aside.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest(".art-open") : null;
    if (!(button instanceof HTMLElement)) return;
    const song = songPaintingFor(poem.id);
    const hanging = song ? null : hangingFor(poem);
    const items = song
      ? [{ src: song.artLarge, alt: `南宋马和之所画《${poem.title}》`, label: "画" }, ...(song.text ? [{ src: song.text, alt: `宋高宗赵构手书《${poem.title}》`, label: "高宗书" }] : [])]
      : [{ src: hanging.src, alt: hanging.caption, label: "画" }];
    import("../components/art-viewer.js").then((m) => m.openArtViewer({
      items, index: Number(button.dataset.art) || 0, trigger: button,
      caption: song ? `${song.caption} · ${poem.title}` : hanging.caption,
      note: song ? `${song.source.museum}藏` : hanging.museum,
    }));
  });
}
