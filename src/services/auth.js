import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

let currentUser = null;
let initialized = false;
let initializationPromise = null;
const listeners = new Set();

export async function initializeAuth() {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    if (!isSupabaseConfigured) {
      initialized = true;
      return null;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn("读取登录状态失败：", error.message);
    currentUser = data?.session?.user ?? null;
    initialized = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user ?? null;
      listeners.forEach((listener) => listener(currentUser));
    });
    return currentUser;
  })();
  return initializationPromise;
}

export function getCurrentUser() { return currentUser; }
export function isAuthReady() { return initialized; }
export function onAuthChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }

export async function signUp({ email, password, nickname }) {
  if (!isSupabaseConfigured) throw new Error("Supabase 尚未配置");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: `${window.location.origin}${window.location.pathname}#/profile` },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  if (!isSupabaseConfigured) throw new Error("Supabase 尚未配置");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile() {
  if (!currentUser || !supabase) return null;
  const { data, error } = await supabase.from("user_profiles").select("*").eq("id", currentUser.id).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(updates) {
  if (!currentUser || !supabase) throw new Error("请先登录");
  const { data, error } = await supabase.from("user_profiles").update(updates).eq("id", currentUser.id).select().single();
  if (error) throw error;
  return data;
}
