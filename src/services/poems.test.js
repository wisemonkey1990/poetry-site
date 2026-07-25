import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════════
// Hoisted mock state — mutable references for mock factories
// ═══════════════════════════════════════════════════════════
const { mockConfigured, mockFrom } = vi.hoisted(() => ({
  mockConfigured: { current: true },
  mockFrom: { current: null },
}));

// ── Query builder factory ────────────────────────────────
// Creates a chainable, thenable mock that mimics supabase's
// PostgrestFilterBuilder / PostgrestTransformBuilder.
function qb(data, error = null, count = 0) {
  const res = { data, error, count };
  const promise = Promise.resolve(res);
  const self = {
    // ── chain methods: each returns `self` (same thenable) ─
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    order: vi.fn(() => self),
    range: vi.fn(() => self),
    or: vi.fn(() => self),
    insert: vi.fn(() => self),
    update: vi.fn(() => self),
    delete: vi.fn(() => self),
    // ── terminal methods ──────────────────────────────────
    maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
    single: vi.fn(() => Promise.resolve({ data, error })),
    // ── thenable interface (so the builder can be awaited) ─
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    // ── Symbol.toPrimitive to avoid "object Promise" in diff ─
    [Symbol.toStringTag]: "Promise",
  };
  return self;
}

// ── Mock modules ─────────────────────────────────────────
vi.mock("../lib/supabase.js", () => ({
  get isSupabaseConfigured() {
    return mockConfigured.current;
  },
  supabase: {
    from: vi.fn((name) => {
      if (mockFrom.current) return mockFrom.current(name);
      return qb(null);
    }),
  },
}));

// Local poems fixture — matches the real poems.json shape
const localPoemsFixture = [
  {
    id: 1,
    title: "关雎",
    chapter: "国风",
    section: "周南",
    content: ["关关雎鸠，在河之洲。", "窈窕淑女，君子好逑。"],
    annotation: "关关：象声词",
    translation: "雎鸠鸟关关地鸣叫",
    sort_order: 1,
    is_published: true,
  },
  {
    id: 2,
    title: "葛覃",
    chapter: "国风",
    section: "周南",
    content: ["葛之覃兮，施于中谷。"],
    sort_order: 2,
    is_published: true,
  },
  {
    id: 99,
    title: "草稿",
    chapter: "国风",
    section: "周南",
    content: ["测试内容"],
    sort_order: 99,
    is_published: false,
  },
];

vi.mock("../data/poems.json", () => ({ default: localPoemsFixture }));

// ═══════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════
describe("poems service", () => {
  let poems;

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Re-import the module so it evaluates with the current mock state.
   * Call this after setting mockConfigured.current / mockFrom.current.
   */
  async function reimport() {
    vi.resetModules();
    poems = await import("./poems.js");
    return poems;
  }

  // ──────────────── getPoems ──────────────────────────────

  describe("getPoems", () => {
    it("（云端）Supabase 配置正确时从云端加载", async () => {
      mockConfigured.current = true;
      const cloudData = [
        { id: 1, title: "关雎", content: '["关关雎鸠","在河之洲。"]', is_published: true, sort_order: 1 },
      ];
      mockFrom.current = () => qb(cloudData);
      await reimport();

      const result = await poems.getPoems();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].title).toBe("关雎");
      // content parsed from JSON string → array
      expect(result[0].content).toEqual(["关关雎鸠", "在河之洲。"]);
      expect(result[0].is_published).toBe(true);
      // data state
      expect(poems.getPoemDataState()).toEqual({
        source: "cloud",
        stale: false,
        message: "",
      });
    });

    it("（本地）Supabase 未配置时加载本地 poems.json", async () => {
      mockConfigured.current = false;
      await reimport();

      const result = await poems.getPoems();

      // All 3 local poems (published ones are returned; unpublished also included
      // because localPublished doesn't filter is_published — it returns all)
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe("关雎");
      expect(poems.getPoemDataState().source).toBe("local");
    });

    it("（缓存）重复调用返回缓存", async () => {
      mockConfigured.current = true;
      const cloudData = [{ id: 1, title: "关雎", content: '["关关雎鸠"]', is_published: true, sort_order: 1 }];
      const fromSpy = vi.fn(() => qb(cloudData));
      mockFrom.current = fromSpy;
      await reimport();

      const first = await poems.getPoems();
      const second = await poems.getPoems();

      // Same cached reference
      expect(second).toBe(first);
      // supabase.from should have been called exactly once
      expect(fromSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────── getPoemById ───────────────────────────

  describe("getPoemById", () => {
    it("（云端）从云端按 ID 查找", async () => {
      mockConfigured.current = true;
      const cloudPoem = {
        id: 1,
        title: "关雎",
        content: '["关关雎鸠"]',
        chapter: "国风",
        section: "周南",
        sort_order: 1,
        is_published: true,
      };
      mockFrom.current = () => qb(cloudPoem);
      await reimport();

      const result = await poems.getPoemById(1);

      expect(result).not.toBeNull();
      expect(result.id).toBe(1);
      expect(result.title).toBe("关雎");
      expect(result.content).toEqual(["关关雎鸠"]);
      expect(poems.getPoemDataState().source).toBe("cloud");
    });

    it("（本地回退）云端失败时回退本地", async () => {
      mockConfigured.current = true;
      // Cloud returns an error
      mockFrom.current = () => qb(null, new Error("Network error"));
      await reimport();

      const result = await poems.getPoemById(1);

      // Falls back to local data
      expect(result).not.toBeNull();
      expect(result.id).toBe(1);
      expect(result.title).toBe("关雎");
      expect(result.content).toEqual(["关关雎鸠，在河之洲。", "窈窕淑女，君子好逑。"]);
      expect(poems.getPoemDataState().source).toBe("local");
      expect(poems.getPoemDataState().stale).toBe(true);
    });
  });

  // ──────────────── adminListPoems ────────────────────────

  describe("adminListPoems", () => {
    beforeEach(() => {
      mockConfigured.current = true;
    });

    it("分页查询", async () => {
      const allData = [
        { id: 1, title: "关雎", content: '["关关雎鸠"]', is_published: true, sort_order: 1 },
        { id: 2, title: "葛覃", content: '["葛之覃兮"]', is_published: true, sort_order: 2 },
        { id: 3, title: "卷耳", content: '["采采卷耳"]', is_published: true, sort_order: 3 },
      ];
      mockFrom.current = () => qb(allData, null, 3);
      await reimport();

      const result = await poems.adminListPoems({ page: 1, pageSize: 2 });

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it("搜索过滤", async () => {
      const allData = [
        { id: 1, title: "关雎", content: '["关关雎鸠"]', chapter: "国风", section: "周南", is_published: true, sort_order: 1 },
        { id: 2, title: "葛覃", content: '["葛之覃兮"]', chapter: "国风", section: "周南", is_published: true, sort_order: 2 },
      ];
      // Capture the query builder so we can inspect calls
      let capturedBuilder;
      mockFrom.current = () => {
        capturedBuilder = qb(allData, null, 2);
        return capturedBuilder;
      };
      await reimport();

      await poems.adminListPoems({ search: "关雎" });

      // The query builder's .or() should have been called with the search term
      expect(capturedBuilder.or).toHaveBeenCalledWith(
        expect.stringContaining("关雎"),
      );
    });

    it("按发布状态过滤", async () => {
      const allData = [
        { id: 1, title: "关雎", content: '["关关雎鸠"]', is_published: true, sort_order: 1 },
      ];
      let capturedBuilder;
      mockFrom.current = () => {
        capturedBuilder = qb(allData, null, 1);
        return capturedBuilder;
      };
      await reimport();

      await poems.adminListPoems({ isPublished: true });

      expect(capturedBuilder.eq).toHaveBeenCalledWith("is_published", true);
    });
  });

  // ──────────────── savePoem ──────────────────────────────

  describe("savePoem", () => {
    beforeEach(() => {
      mockConfigured.current = true;
    });

    it("（新建）insert 新诗篇", async () => {
      const inserted = {
        id: 100,
        title: "新诗",
        content: '["新诗内容"]',
        chapter: "国风",
        section: "周南",
        sort_order: 10,
        is_published: true,
        slug: "poem-100",
        annotation: null,
        translation: null,
      };
      mockFrom.current = () => qb(inserted);
      await reimport();

      const result = await poems.savePoem({
        title: "新诗",
        content: ["新诗内容"],
        chapter: "国风",
        section: "周南",
        sort_order: 10,
        is_published: true,
      });

      expect(result).not.toBeNull();
      expect(result.id).toBe(100);
      expect(result.title).toBe("新诗");
      expect(result.content).toEqual(["新诗内容"]);
    });

    it("（编辑）update 已有诗篇", async () => {
      const updated = {
        id: 1,
        title: "关雎（修订版）",
        content: '["关关雎鸠"]',
        chapter: "国风",
        section: "周南",
        sort_order: 1,
        is_published: true,
        slug: "guan-ju",
      };
      mockFrom.current = () => qb(updated);
      await reimport();

      const result = await poems.savePoem({
        id: 1,
        title: "关雎（修订版）",
        content: ["关关雎鸠"],
        chapter: "国风",
        section: "周南",
        sort_order: 1,
        is_published: true,
      });

      expect(result.title).toBe("关雎（修订版）");
    });
  });

  // ──────────────── deletePoem ────────────────────────────

  describe("deletePoem", () => {
    beforeEach(() => {
      mockConfigured.current = true;
    });

    it("删除未发布诗篇", async () => {
      // getAdminPoemById will hit maybeSingle → returns draft poem
      const draft = {
        id: 99,
        title: "草稿",
        content: '["测试内容"]',
        chapter: "国风",
        section: "周南",
        sort_order: 99,
        is_published: false,
      };
      mockFrom.current = () => qb(draft);
      await reimport();

      await expect(poems.deletePoem(99)).resolves.toBeUndefined();
    });

    it("已发布诗篇不能删除", async () => {
      const published = {
        id: 1,
        title: "关雎",
        content: '["关关雎鸠"]',
        chapter: "国风",
        section: "周南",
        sort_order: 1,
        is_published: true,
      };
      mockFrom.current = () => qb(published);
      await reimport();

      await expect(poems.deletePoem(1)).rejects.toThrow("已发布诗篇不能删除");
    });

    it("不存在的诗篇抛错", async () => {
      mockFrom.current = () => qb(null);
      await reimport();

      await expect(poems.deletePoem(9999)).rejects.toThrow("诗篇不存在");
    });
  });

  // ──────────────── clearPoemCache ────────────────────────

  describe("clearPoemCache", () => {
    it("清除后重新加载", async () => {
      mockConfigured.current = true;
      const cloudData = [{ id: 1, title: "关雎", content: '["关关雎鸠"]', is_published: true, sort_order: 1 }];
      const fromSpy = vi.fn(() => qb(cloudData));
      mockFrom.current = fromSpy;
      await reimport();

      // Load cache
      await poems.getPoems();
      expect(fromSpy).toHaveBeenCalledTimes(1);

      // Second call returns cache
      await poems.getPoems();
      expect(fromSpy).toHaveBeenCalledTimes(1);

      // Clear cache
      poems.clearPoemCache();

      // Third call re-fetches
      await poems.getPoems();
      expect(fromSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────── getPoemDataState ──────────────────────

  describe("getPoemDataState", () => {
    it("初始状态：Supabase 已配置时为 cloud", async () => {
      mockConfigured.current = true;
      await reimport();

      expect(poems.getPoemDataState()).toEqual({
        source: "cloud",
        stale: false,
        message: "",
      });
    });

    it("初始状态：Supabase 未配置时为 local", async () => {
      mockConfigured.current = false;
      await reimport();

      expect(poems.getPoemDataState()).toEqual({
        source: "local",
        stale: false,
        message: "",
      });
    });
  });

  // ──────────────── normalizePoem ─────────────────────────

  describe("normalizePoem", () => {
    it("JSON 字符串 content 被解析为数组", async () => {
      mockConfigured.current = true;
      // Cloud returns content as a JSON string
      const cloudData = [
        {
          id: 1,
          title: "关雎",
          content: '["关关雎鸠","在河之洲。","窈窕淑女","君子好逑。"]',
          is_published: true,
          sort_order: 1,
        },
      ];
      mockFrom.current = () => qb(cloudData);
      await reimport();

      const result = await poems.getPoems();

      expect(result[0].content).toEqual([
        "关关雎鸠",
        "在河之洲。",
        "窈窕淑女",
        "君子好逑。",
      ]);
    });

    it("数组 content 保持原样", async () => {
      mockConfigured.current = true;
      const cloudData = [
        {
          id: 1,
          title: "关雎",
          content: ["关关雎鸠", "在河之洲。"],
          is_published: true,
          sort_order: 1,
        },
      ];
      mockFrom.current = () => qb(cloudData);
      await reimport();

      const result = await poems.getPoems();

      expect(result[0].content).toEqual(["关关雎鸠", "在河之洲。"]);
    });

    it("空 content 返回空数组", async () => {
      mockConfigured.current = true;
      const cloudData = [
        { id: 1, title: "无题", content: "[]", is_published: true, sort_order: 1 },
      ];
      mockFrom.current = () => qb(cloudData);
      await reimport();

      const result = await poems.getPoems();

      expect(result[0].content).toEqual([]);
    });

    it("null poem 返回 null（通过 getPoemById 测试）", async () => {
      mockConfigured.current = true;
      mockFrom.current = () => qb(null);
      await reimport();

      const result = await poems.getPoemById(999);

      expect(result).toBeNull();
    });
  });
});
