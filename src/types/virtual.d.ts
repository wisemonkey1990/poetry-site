// 构建时由 scripts/poem-data-plugin.mjs 提供的虚拟模块
declare module "virtual:poem-index" {
  const index: Array<{ id: number; title: string; chapter: string; section: string; content: string[]; sort_order?: number; is_published?: boolean }>;
  export default index;
}
declare module "virtual:poem-loaders" {
  const loaders: Record<string, () => Promise<{ default: unknown }>>;
  export default loaders;
}
