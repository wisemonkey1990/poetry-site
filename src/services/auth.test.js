import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------- hoisted mock state ----------
const { mockSupabase, mockFeatures, mockSupabaseState } = vi.hoisted(() => {
  const _auth = {
    getSession: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  };
  const _supabase = { auth: _auth, from: vi.fn(), rpc: vi.fn() };
  return {
    mockSupabase: _supabase,
    mockFeatures: { REGISTRATION_ENABLED: true },
    mockSupabaseState: { isSupabaseConfigured: true },
  };
});

// ---------- module mocks ----------
vi.mock("../lib/supabase.js", () => ({
  get isSupabaseConfigured() {
    return mockSupabaseState.isSupabaseConfigured;
  },
  supabase: mockSupabase,
}));

vi.mock("../config/features.js", () => ({
  get REGISTRATION_ENABLED() {
    return mockFeatures.REGISTRATION_ENABLED;
  },
}));

// ---------- helpers ----------
function mockFromChain(returnValue) {
  mockSupabase.from.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(returnValue),
      })),
    })),
  }));
}

function setupDefaultMocks() {
  // auth methods
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "user-1", email: "test@test.com" } } },
    error: null,
  });
  mockSupabase.auth.signUp.mockResolvedValue({
    data: { user: { id: "user-2" } },
    error: null,
  });
  mockSupabase.auth.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: "user-1" } } },
    error: null,
  });
  mockSupabase.auth.signOut.mockResolvedValue({ error: null });
  mockSupabase.auth.onAuthStateChange.mockImplementation(() => {});

  // from().select().eq().single() chain
  mockFromChain({
    data: { id: "user-1", nickname: "test", avatar_url: null, bio: null },
    error: null,
  });

  // rpc
  mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null });
}

// ---------- setup / teardown ----------
beforeEach(() => {
  // Stub window for tests that need location (signUp uses window.location.origin)
  vi.stubGlobal("window", {
    location: { origin: "http://localhost", pathname: "/" },
  });

  // Reset feature / config flags
  // Reset feature / config flags
  mockFeatures.REGISTRATION_ENABLED = true;
  mockSupabaseState.isSupabaseConfigured = true;

  // Reset all mock function calls & implementations
  vi.clearAllMocks();

  // Apply default mocked return values
  setupDefaultMocks();
});

// ==================================================================
//  Test suite
// ==================================================================
describe("auth 服务单元测试", () => {
  // ----------------------------------------------------------------
  // 1. initializeAuth - Supabase 已配置
  // ----------------------------------------------------------------
  it("initializeAuth：Supabase 已配置时，调用 getSession 并设置 currentUser", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    const result = await auth.initializeAuth();

    expect(mockSupabase.auth.getSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: "user-1", email: "test@test.com" });
    expect(auth.getCurrentUser()).toEqual({ id: "user-1", email: "test@test.com" });
    expect(auth.isAuthReady()).toBe(true);
  });

  // ----------------------------------------------------------------
  // 2. initializeAuth - Supabase 未配置
  // ----------------------------------------------------------------
  it("initializeAuth：Supabase 未配置时，返回 null", async () => {
    mockSupabaseState.isSupabaseConfigured = false;
    vi.resetModules();
    const auth = await import("../services/auth.js");

    const result = await auth.initializeAuth();

    expect(result).toBeNull();
    expect(auth.getCurrentUser()).toBeNull();
    expect(auth.isAuthReady()).toBe(true);
    expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // 3. signUp - 注册成功
  // ----------------------------------------------------------------
  it("signUp：注册成功后返回 data", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    const result = await auth.signUp({
      email: "test@test.com",
      password: "secret123",
      nickname: "tester",
    });

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: "test@test.com",
      password: "secret123",
      options: {
        data: { nickname: "tester" },
        emailRedirectTo: expect.stringContaining("/#/profile"),
      },
    });
    expect(result).toEqual({ user: { id: "user-2" } });
  });

  // ----------------------------------------------------------------
  // 4. signUp - 注册关闭
  // ----------------------------------------------------------------
  it("signUp：REGISTRATION_ENABLED=false 时抛出错误", async () => {
    mockFeatures.REGISTRATION_ENABLED = false;
    vi.resetModules();
    const auth = await import("../services/auth.js");

    await expect(
      auth.signUp({ email: "test@test.com", password: "secret123", nickname: "tester" }),
    ).rejects.toThrow("用户注册正在灰度测试中，暂未开放");

    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // 5. signIn - 登录成功
  // ----------------------------------------------------------------
  it("signIn：登录成功后返回 data", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    const result = await auth.signIn({ email: "test@test.com", password: "secret123" });

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@test.com",
      password: "secret123",
    });
    expect(result).toEqual({ session: { user: { id: "user-1" } } });
  });

  // ----------------------------------------------------------------
  // 6. signIn - Supabase 未配置
  // ----------------------------------------------------------------
  it("signIn：Supabase 未配置时抛出错误", async () => {
    mockSupabaseState.isSupabaseConfigured = false;
    vi.resetModules();
    const auth = await import("../services/auth.js");

    await expect(
      auth.signIn({ email: "test@test.com", password: "secret123" }),
    ).rejects.toThrow("Supabase 尚未配置");

    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // 7. signOut
  // ----------------------------------------------------------------
  it("signOut：调用 supabase.auth.signOut", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    await auth.signOut();

    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // 8. getProfile
  // ----------------------------------------------------------------
  it("getProfile：返回用户 profile", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    // initializeAuth 设置 currentUser
    await auth.initializeAuth();

    const profile = await auth.getProfile();

    expect(mockSupabase.from).toHaveBeenCalledWith("user_profiles");
    expect(profile).toEqual({
      id: "user-1",
      nickname: "test",
      avatar_url: null,
      bio: null,
    });
  });

  // ----------------------------------------------------------------
  // 9. updateProfile
  // ----------------------------------------------------------------
  it("updateProfile：调用 rpc 更新", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    // initializeAuth 设置 currentUser
    await auth.initializeAuth();

    const updates = {
      nickname: "新昵称",
      avatar_url: "https://example.com/avatar.png",
      bio: "个人简介",
    };
    const result = await auth.updateProfile(updates);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("update_own_profile", {
      p_nickname: "新昵称",
      p_avatar_url: "https://example.com/avatar.png",
      p_bio: "个人简介",
    });
    // updateProfile destructures { data } 并返回 data
    expect(result).toEqual({ success: true });
  });

  // ----------------------------------------------------------------
  // 10. onAuthChange
  // ----------------------------------------------------------------
  it("onAuthChange：注册和取消监听器", async () => {
    vi.resetModules();
    const auth = await import("../services/auth.js");

    const listener = vi.fn();
    const unsubscribe = auth.onAuthChange(listener);

    // initializeAuth 会调用 onAuthStateChange 注册内部回调
    await auth.initializeAuth();

    // 获取被传入 onAuthStateChange 的回调
    const stateChangeCallback =
      mockSupabase.auth.onAuthStateChange.mock.calls[0][0];

    // 模拟登录事件 —— 内部回调遍历 listeners 并调用每个 listener
    stateChangeCallback("SIGNED_IN", { user: { id: "new-user" } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: "new-user" });

    // 取消订阅
    unsubscribe();
    listener.mockClear();

    // 再次触发 —— listener 不应再被调用
    stateChangeCallback("SIGNED_OUT", { user: null });
    expect(listener).not.toHaveBeenCalled();
  });
});
