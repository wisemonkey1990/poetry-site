import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const SESSION_KEY = "shijing_visitor_session";
let lastTracked = { path: "", at: 0 };

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.random() * 16 | 0;
    return (char === "x" ? value : (value & 3) | 8).toString(16);
  });
}

export function getAnonymousSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) { id = uuid(); localStorage.setItem(SESSION_KEY, id); }
  return id;
}

export function detectDeviceType() {
  const ua = navigator.userAgent ?? "";
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

export function normalizeAnalyticsPayload(path) {
  const cleanPath = String(path || "/").replace(/^#/, "").split("?")[0].slice(0, 200);
  const match = cleanPath.match(/^\/poem\/(\d+)$/);
  let referrerHost = "direct";
  try { if (document.referrer) referrerHost = new URL(document.referrer).hostname.slice(0, 120); } catch { /* ignore */ }
  return {
    p_session_id: getAnonymousSessionId(), p_path: cleanPath,
    p_poem_id: match ? Number(match[1]) : null,
    p_referrer_host: referrerHost, p_device_type: detectDeviceType(),
  };
}

export async function trackPageView(path) {
  if (!isSupabaseConfigured || !supabase) return false;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return false;
  const clean = String(path || "");
  if (clean.startsWith("/admin")) return false;
  const now = Date.now();
  if (lastTracked.path === clean && now - lastTracked.at < 10_000) return false;
  lastTracked = { path: clean, at: now };
  const { error } = await supabase.rpc("track_visitor_event", normalizeAnalyticsPayload(clean));
  if (error) { console.warn("访问统计暂未记录。"); return false; }
  return true;
}