import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from "vitest";

// ========== 共享 mock 状态 ==========
const { mockResult, mockGetCurrentUser, mockLocalStorage, mockFrom, mockBuilder } = vi.hoisted(() => {
  const mockResult = { data: null, error: null };

  const mockGetCurrentUser = vi.fn();

  const store = {};
  const mockLocalStorage = {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };

  // 可链式调用的 query builder mock
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve({ error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(mockResult)),
    delete: vi.fn(() => {
      // delete().eq().eq() 链，最终 await 返回 { error: null }
      const delBuilder = {
        eq: vi.fn(() => delBuilder),
        then: (resolve) => resolve({ error: null }),
      };
      return delBuilder;
    }),
    // 使 builder 本身支持 await（用于 select().eq() / select().eq().order() 链）
    then: (resolve) => resolve(mockResult),
  };

  const mockFrom = vi.fn(() => builder);

  return { mockResult, mockGetCurrentUser, mockLocalStorage, mockFrom, mockBuilder: builder, store };
});

// ========== Module mocks ==========
vi.mock("./poems.js", () => ({
  getPoems: vi.fn(async () => [
    { id: 1, title: "关雎", is_published: true },
    { id: 3, title: "蒹葭", is_published: true },
  ]),
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("./auth.js", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

// ========== 测试套件 ==========
describe("favorites service", () => {
  let favorites;

  beforeAll(async () => {
    vi.stubGlobal("localStorage", mockLocalStorage);
    favorites = await import("./favorites.js");
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    // 每次测试前重置 mock 状态
    vi.clearAllMocks();
    mockResult.data = null;
    mockResult.error = null;
    mockLocalStorage.clear();
  });

  const mockUser = { id: "user-123", email: "test@example.com" };

  // ----------------------------------------------------------------
  // getFavoriteIds
  // ----------------------------------------------------------------
  describe("getFavoriteIds", () => {
    it("返回收藏诗篇 ID 列表", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockResult.data = [{ poem_id: 1 }, { poem_id: 3 }, { poem_id: 5 }];

      const ids = await favorites.getFavoriteIds();

      expect(ids).toEqual([1, 3, 5]);
      expect(mockFrom).toHaveBeenCalledWith("favorites");
      expect(mockBuilder.select).toHaveBeenCalledWith("poem_id");
      expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
    });

    it("未登录时抛出错误", async () => {
      mockGetCurrentUser.mockReturnValue(null);

      await expect(favorites.getFavoriteIds()).rejects.toThrow("请先登录后再收藏诗篇");
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // getFavoritePoems
  // ----------------------------------------------------------------
  describe("getFavoritePoems", () => {
    it("从本地诗文解析收藏，跳过本地已不存在的诗篇，保持返回结构", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockResult.data = [
        { id: 1, poem_id: 3, created_at: "2024-01-03" },
        { id: 2, poem_id: 999, created_at: "2024-01-02" },
        { id: 3, poem_id: 1, created_at: "2024-01-01" },
      ];

      const poems = await favorites.getFavoritePoems();

      expect(poems).toEqual([
        { poem: { id: 3, title: "蒹葭", is_published: true }, created_at: "2024-01-03" },
        { poem: { id: 1, title: "关雎", is_published: true }, created_at: "2024-01-01" },
      ]);
      expect(mockFrom).toHaveBeenCalledWith("favorites");
      expect(mockFrom).not.toHaveBeenCalledWith("poems");
      expect(mockBuilder.select).toHaveBeenCalledWith("id, poem_id, created_at");
      expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(mockBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });
  });

  // ----------------------------------------------------------------
  // isFavorite
  // ----------------------------------------------------------------
  describe("isFavorite", () => {
    it("未收藏返回 false", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);
      // maybeSingle 会使用 mockResult 当前值
      mockResult.data = null;

      const result = await favorites.isFavorite(1);

      expect(result).toBe(false);
      expect(mockBuilder.maybeSingle).toHaveBeenCalled();
    });

    it("已收藏返回 true", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockResult.data = { id: 1 };

      const result = await favorites.isFavorite(1);

      expect(result).toBe(true);
      expect(mockBuilder.maybeSingle).toHaveBeenCalled();
    });

    it("未登录返回 false（不抛错）", async () => {
      mockGetCurrentUser.mockReturnValue(null);

      const result = await favorites.isFavorite(1);

      expect(result).toBe(false);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // addFavorite
  // ----------------------------------------------------------------
  describe("addFavorite", () => {
    it("成功添加收藏", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);

      await favorites.addFavorite(42);

      expect(mockBuilder.upsert).toHaveBeenCalledWith(
        { user_id: mockUser.id, poem_id: 42 },
        { onConflict: "user_id,poem_id", ignoreDuplicates: true },
      );
    });
  });

  // ----------------------------------------------------------------
  // removeFavorite
  // ----------------------------------------------------------------
  describe("removeFavorite", () => {
    it("成功移除收藏", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);

      await favorites.removeFavorite(42);

      // delete() 返回的 delBuilder 的 eq 链
      const delBuilder = mockBuilder.delete.mock.results[0].value;
      expect(delBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      // 第二次 .eq() 调用在 delBuilder.eq 返回的对象上
      const eqResult = delBuilder.eq.mock.results[0].value;
      expect(eqResult.eq).toHaveBeenCalledWith("poem_id", 42);
    });
  });

  // ----------------------------------------------------------------
  // toggleFavorite
  // ----------------------------------------------------------------
  describe("toggleFavorite", () => {
    it("收藏状态 → 取消收藏", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);

      const result = await favorites.toggleFavorite(7, true);

      expect(result).toBe(false);
      // 应调用 removeFavorite → delete().eq("user_id",...).eq("poem_id", 7)
      expect(mockBuilder.delete).toHaveBeenCalled();
      const delBuilder = mockBuilder.delete.mock.results[0].value;
      expect(delBuilder.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      const eqResult = delBuilder.eq.mock.results[0].value;
      expect(eqResult.eq).toHaveBeenCalledWith("poem_id", 7);
    });

    it("取消收藏状态 → 添加收藏", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);

      const result = await favorites.toggleFavorite(7, false);

      expect(result).toBe(true);
      // 应调用 addFavorite → upsert(...)
      expect(mockBuilder.upsert).toHaveBeenCalledWith(
        { user_id: mockUser.id, poem_id: 7 },
        { onConflict: "user_id,poem_id", ignoreDuplicates: true },
      );
    });
  });

  // ----------------------------------------------------------------
  // migrateLegacyFavorites
  // ----------------------------------------------------------------
  describe("migrateLegacyFavorites", () => {
    const LEGACY_KEY = "shijing_favorites";
    const MIGRATED_PREFIX = "shijing_favorites_migrated";

    it("迁移 localStorage 数据", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === LEGACY_KEY) return '[2, 5, 8, 5, 2]';
        if (key === `${MIGRATED_PREFIX}:${mockUser.id}`) return null;
        return null;
      });

      const count = await favorites.migrateLegacyFavorites();

      // 函数返回 ids.length（原始数组长度 5），而非去重后的数量
      expect(count).toBe(5);

      // upsert 应被调用，包含去重后的 3 条数据
      expect(mockBuilder.upsert).toHaveBeenCalledWith(
        [
          { user_id: mockUser.id, poem_id: 2 },
          { user_id: mockUser.id, poem_id: 5 },
          { user_id: mockUser.id, poem_id: 8 },
        ],
        { onConflict: "user_id,poem_id", ignoreDuplicates: true },
      );

      // 迁移标记应已写入
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `${MIGRATED_PREFIX}:${mockUser.id}`,
        "true",
      );

      // 旧数据应被删除
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(LEGACY_KEY);
    });

    it("已迁移过不再重复迁移", async () => {
      mockGetCurrentUser.mockReturnValue(mockUser);
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === `${MIGRATED_PREFIX}:${mockUser.id}`) return "true";
        return null;
      });

      const count = await favorites.migrateLegacyFavorites();

      expect(count).toBe(0);
      expect(mockBuilder.upsert).not.toHaveBeenCalled();
    });
  });
});
