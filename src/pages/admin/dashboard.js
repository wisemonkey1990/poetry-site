import { getDashboard, getTimeseries } from "../../services/admin.js";
import { adminError, escapeHtml, prepareAdminPage } from "./layout.js";

let period = 7;

export async function renderAdminDashboard() {
  const main = await prepareAdminPage("dashboard"); if (!main) return () => {};
  main.innerHTML = pageTemplate(); bindPeriod(); await loadDashboard(); return () => {};
}

function pageTemplate() {
  return `<div class="admin-page"><div class="admin-page-heading"><div><p class="page-eyebrow">OVERVIEW</p><h2>仪表盘</h2><p class="page-desc">匿名访问趋势与内容热度</p></div><div class="period-toggle"><button data-days="7" class="active">近 7 天</button><button data-days="30">近 30 天</button></div></div>
  <div class="stat-grid"><div class="stat-card"><div class="stat-value" id="todayPv">—</div><div class="stat-label">今日浏览</div></div><div class="stat-card"><div class="stat-value" id="todayUv">—</div><div class="stat-label">今日访客</div></div><div class="stat-card"><div class="stat-value" id="periodPv">—</div><div class="stat-label">周期浏览量</div></div><div class="stat-card"><div class="stat-value" id="periodUv">—</div><div class="stat-label">周期访客数</div></div></div>
  <section class="trend-chart"><h3>每日 PV / UV 趋势</h3><div class="chart-legend"><span>朱红：PV</span><span>浅墨：UV</span></div><div class="trend-bars" id="trendBars"><div class="loading">读取数据中……</div></div></section>
  <div class="dist-grid"><section class="section-card"><h3>热门诗篇</h3><ol class="hot-list" id="hotList"></ol></section><div><section class="section-card"><h3>访问来源</h3><ul class="dist-list" id="sourceList"></ul></section><section class="section-card"><h3>设备分布</h3><ul class="dist-list" id="deviceList"></ul></section></div></div></div>`;
}

function bindPeriod() {
  document.querySelectorAll("[data-days]").forEach((button) => button.addEventListener("click", async () => {
    period = Number(button.dataset.days); document.querySelectorAll("[data-days]").forEach((item) => item.classList.toggle("active", item === button)); await loadDashboard();
  }));
}

async function loadDashboard() {
  try {
    const [dashboard, series] = await Promise.all([getDashboard(period), getTimeseries(period)]);
    document.getElementById("todayPv").textContent = dashboard.todayPv.toLocaleString();
    document.getElementById("todayUv").textContent = dashboard.todayUv.toLocaleString();
    document.getElementById("periodPv").textContent = dashboard.pv.toLocaleString();
    document.getElementById("periodUv").textContent = dashboard.uv.toLocaleString();
    renderTrend(series); renderHot(dashboard.hotPoems); renderDistribution("sourceList", dashboard.sources); renderDistribution("deviceList", dashboard.devices);
  } catch (error) { document.getElementById("adminMain").innerHTML = adminError(error.message); }
}

function renderTrend(rows) {
  const max = Math.max(1, ...rows.map((item) => item.pv));
  document.getElementById("trendBars").innerHTML = rows.map((item) => `<div class="trend-bar-wrap" title="${escapeHtml(item.date)} · PV ${item.pv} · UV ${item.uv}"><div class="trend-pair"><i class="trend-bar pv" style="height:${Math.max(3, item.pv / max * 100)}%"></i><i class="trend-bar uv" style="height:${Math.max(3, item.uv / max * 100)}%"></i></div><span class="trend-bar-label">${String(item.date).slice(5)}</span></div>`).join("");
}
function renderHot(items) { document.getElementById("hotList").innerHTML = items.length ? items.map((item, index) => `<li><span class="rank ${index < 3 ? "top3" : ""}">${index + 1}</span><span class="title">${escapeHtml(item.title)}</span><strong>${Number(item.views ?? item.count ?? 0)} 次</strong></li>`).join("") : `<li class="empty-state">暂无访问数据</li>`; }
function renderDistribution(id, items) { const max = Math.max(1, ...items.map((item) => Number(item.count))); document.getElementById(id).innerHTML = items.length ? items.map((item) => `<li><span class="dist-name">${escapeHtml(item.name || "未知")}</span><div class="dist-bar-bg"><i class="dist-bar-fill" style="width:${Number(item.count) / max * 100}%"></i></div><strong>${Number(item.count)}</strong></li>`).join("") : `<li class="empty-state">暂无数据</li>`; }