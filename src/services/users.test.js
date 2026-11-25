import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSupabase, state } = vi.hoisted(() => ({
  mockSupabase: { rpc: vi.fn() },
  state: { configured: true },
}));

vi.mock("../lib/supabase.js", () => ({
  get isSupabaseConfigured() { return state.configured; },
  supabase: mockSupabase,
}));

import { resetUserPassword } from "./users.js";

beforeEach(() => {
  vi.clearAllMocks();
  state.configured = true;
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
});

describe("resetUserPassword", () => {
  it("调用 admin_reset_user_password RPC", async () => {
    await resetUserPassword("u-1", "new-password-1");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("admin_reset_user_password", { p_user_id: "u-1", p_new_password: "new-password-1" });
  });

  it("密码不合规时不发起请求", async () => {
    await expect(resetUserPassword("u-1", "short")).rejects.toThrow("至少 8 位");
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("把数据库错误翻译为中文提示", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(resetUserPassword("u-1", "new-password-1")).rejects.toThrow("没有用户管理权限");
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "cannot reset another admin password" } });
    await expect(resetUserPassword("u-1", "new-password-1")).rejects.toThrow("不能重置其他管理员");
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "auth user not found" } });
    await expect(resetUserPassword("u-1", "new-password-1")).rejects.toThrow("未找到对应的登录账号");
  });

  it("函数未部署时提示执行迁移", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "Could not find the function", code: "PGRST202" } });
    await expect(resetUserPassword("u-1", "new-password-1")).rejects.toThrow("007_admin_reset_password.sql");
  });

  it("Supabase 未配置时抛出", async () => {
    state.configured = false;
    await expect(resetUserPassword("u-1", "new-password-1")).rejects.toThrow("尚未配置");
  });
});
