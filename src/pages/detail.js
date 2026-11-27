import { html, raw, setHtml, textToHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import { getPoemPinyin, getTitlePinyin, getTraditionalText, renderRubyLines } from "../utils/reading.js";
import { getCurrentUser } from "../services/auth.js";
import { isFavorite, toggleFavorite } from "../services/favorites.js";
import { getPoemIndex, getPoemById } from "../services/poems.js";
import { updateSeo } from "../utils/seo.js";
import { showToast } from "../utils/toast.js";
import { navigate } from "../router.js";
import { bindHorizontalSwipe } from "../utils/swipe.js";
import { readSelectedText } from "../utils/selection.js";

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
  share: html`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>`
};

export async function renderDetail({ id }) {
  setupShell();
  renderShell(html`<div class="loading page-loading">展卷中……</div>`);
  const [poems, poem] = await Promise.all([getPoemIndex(), getPoemById(Number(id))]);
  if (!poem) { updateSeo({ title: "未找到诗篇 · 诗三百", description: "该诗篇不存在或尚未发布。", noindex: true }); setupShell(); renderShell(html`<div class="empty-state">未找到此诗</div>`); return () => {}; }
  updateSeo({ title: `《${poem.title}》· 诗经 · 诗三百`, description: `${poem.chapter}·${poem.section}：${poem.content[0] || "阅读诗经原文、注释与今译。"}`.slice(0, 150) });
  const useTraditional = readPreference("shijing_script") === "traditional";
  const showPinyin = readPreference("shijing_show_pinyin") !== "false";
  const readingLayout = readPreference("shijing_reading_layout") === "vertical" ? "vertical" : "horizontal";
  const favorited = getCurrentUser() ? await isFavorite(poem.id) : false;
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
    <article class="poem-page">
      <header class="poem-header ${showPinyin ? "" : "hide-pinyin"}" id="poemHeader">
        <div class="poem-title-row"><h1 class="${Array.from(displayTitle).length >= 5 ? "long-title" : ""}" aria-label="${displayTitle}">${raw(titleRuby)}</h1></div>
        <div class="poem-tags"><span class="tag">诗序 ${String(poem.id).padStart(3, "0")}</span><a class="tag tag-link" href="/browse/${encodeURIComponent(poem.chapter)}" data-nav="/browse/${poem.chapter}" title="查看${poem.chapter}全部篇目">${poem.chapter} · ${poem.section}</a></div>
        <div class="reading-tools">
        <button class="btn btn-ghost pinyin-toggle ${showPinyin ? "active" : ""}" id="pinyinToggle">${icon.pinyin}<span>${showPinyin ? "隐藏拼音" : "显示拼音"}</span></button>
        <button class="btn btn-ghost layout-toggle ${readingLayout === "vertical" ? "active" : ""}" id="layoutToggle" aria-pressed="${readingLayout === "vertical"}">${icon.layout}<span>${readingLayout === "vertical" ? "切换横排" : "切换竖排"}</span></button>
        <button class="btn btn-ghost script-toggle ${useTraditional ? "active" : ""}" id="scriptToggle" aria-pressed="${useTraditional}">${icon.script(useTraditional)}<span class="tool-label">${useTraditional ? "切换简体" : "切换繁体"}</span></button>
        <button class="btn btn-ghost fav-btn ${favorited ? "favorited" : ""}" id="favBtn" title="${favorited ? "取消收藏" : "收藏"}" aria-pressed="${favorited}">${icon.favorite(favorited)}<span>${favorited ? "已收藏" : "收藏"}</span></button>
        <button class="btn btn-ghost" id="shareBtn" title="分享">${icon.share}<span>分享</span></button>
        <button type="button" class="btn btn-ghost" id="pdfBtn" aria-haspopup="dialog" title="下载排版精美的 PDF，可选是否注音">${icon.pdf}<span>下载PDF</span></button>
        <div class="font-size-ctl" role="group" aria-label="诗文字号">
          <button type="button" class="btn btn-ghost" id="fontSmaller" data-step="-1" aria-label="缩小字号" title="缩小字号"${fontStep === 0 ? " disabled" : ""}>A</button>
          <span class="font-size-label">字号</span>
          <button type="button" class="btn btn-ghost" id="fontLarger" data-step="1" aria-label="放大字号" title="放大字号"${fontStep === FONT_SCALES.length - 1 ? " disabled" : ""}>A</button>
        </div>
        <button type="button" class="btn btn-ghost correction-btn" id="correctionBtn" aria-haspopup="dialog" title="发现错字或注音有误？点此纠错">${icon.correct}<span>纠错</span></button>
      </div>
      </header>
      <section class="poem-paper layout-${readingLayout}" id="poemPaper" aria-label="诗篇正文" data-layout="${readingLayout}" data-paper="shan" style="--sent-n: ${longestSentence(poem.content)}; --poem-fs: ${autoFs.toFixed(3)}rem; --poem-scale: ${FONT_SCALES[fontStep]}">
        <div class="poem-scroll" id="poemScroll" tabindex="${readingLayout === "vertical" ? "0" : "-1"}"><div class="poem-body ${showPinyin ? "" : "hide-pinyin"}" id="poemBody">${displayContent.map((line, index) => html`<p class="poem-line" data-text="${line}">${raw(rubyLines[index])}</p>`)}</div></div>
      </section>
      <div class="poem-notes-grid">
        <section class="poem-annotations"><h2 class="note-heading">注释</h2>${poem.annotation ? html`<div class="annotation-content">${textToHtml(poem.annotation)}</div>` : html`<p class="text-muted">此篇注释尚在整理。</p>`}</section>
        <section class="poem-translation"><h2 class="note-heading">今译</h2>${poem.translation ? html`<div class="translation-content">${textToHtml(poem.translation)}</div>` : html`<p class="text-muted">此篇译文尚在整理。</p>`}</section>
      </div>
      <nav class="poem-nav" aria-label="诗篇导航">${previous ? html`<a href="/poem/${previous.id}" class="btn btn-outline" data-nav="/poem/${previous.id}"><span>← 上一篇</span><strong>${previous.title}</strong></a>` : html`<span></span>`}${next ? html`<a href="/poem/${next.id}" class="btn btn-outline" data-nav="/poem/${next.id}"><strong>${next.title}</strong><span>下一篇 →</span></a>` : html`<span></span>`}</nav>
      ${previous ? html`<a href="/poem/${previous.id}" class="page-turn page-turn-prev" data-nav="/poem/${previous.id}" aria-label="上一篇：${previous.title}" title="上一篇：${previous.title}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg></a>` : ""}
      ${next ? html`<a href="/poem/${next.id}" class="page-turn page-turn-next" data-nav="/poem/${next.id}" aria-label="下一篇：${next.title}" title="下一篇：${next.title}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg></a>` : ""}
    </article>`;
  setupShell(); renderShell(markup); bindActions(poem);
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
  return () => { unbindSwipe?.(); document.removeEventListener("keydown", onKey); };
}

function bindActions(poem) {
  const pinyinToggles = [document.getElementById("pinyinToggle")].filter(Boolean);
  pinyinToggles.forEach((button) => button.addEventListener("click", () => {
    const body = document.getElementById("poemBody");
    const hidden = body.classList.toggle("hide-pinyin");
    document.getElementById("poemHeader")?.classList.toggle("hide-pinyin", hidden);
    writePreference("shijing_show_pinyin", String(!hidden));
    pinyinToggles.forEach((item) => { item.classList.toggle("active", !hidden); item.setAttribute("aria-pressed", String(!hidden)); const label = item.querySelector("span"); if (label) label.textContent = hidden ? "显示拼音" : "隐藏拼音"; });
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
        if (label) label.textContent = nextTraditional ? "切换简体" : "切换繁体";
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
    scroll?.setAttribute("tabindex", vertical ? "0" : "-1");
    writePreference("shijing_reading_layout", vertical ? "vertical" : "horizontal");
    layoutToggles.forEach((item) => {
      item.classList.toggle("active", vertical);
      item.setAttribute("aria-pressed", String(vertical));
      item.title = vertical ? "切换为横排" : "切换为竖排";
      item.setAttribute("aria-label", vertical ? "切换为横排阅读" : "切换为竖排阅读");
      const label = item.querySelector("span");
      if (label) label.textContent = vertical ? "切换横排" : "切换竖排";
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
      button.classList.toggle("favorited", added);
      button.setAttribute("aria-pressed", String(added));
      button.title = added ? "取消收藏" : "收藏";
      setHtml(button, html`${icon.favorite(added)}<span>${added ? "已收藏" : "收藏"}</span>`);
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

export function setupDetail() {}
