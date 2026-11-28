/* 真迹配画：
   - 南宋马和之为《诗经》所作的图卷（宋高宗赵构书诗），有图的篇目直接配原画与高宗手书；
   - 其余篇目按诗里的意象，配一幅宋元明清的立轴真迹。
   图都来自博物馆开放获取（CC0）或公有领域，见 scripts/song/paintings.json。 */
import songData from "../data/song-paintings.json";
import { sceneFor } from "./ink-scene.js";

/** @typedef {{ title: string, artist: string, calligrapher?: string, museum: string, license?: string, page?: string }} SongSource */

/**
 * 这首诗有没有马和之的画
 * @param {number|string} id
 */
export function songPaintingFor(id) {
  const item = songData.poems[String(id)];
  if (!item) return null;
  /** @type {SongSource} */
  const source = songData.sources[item.src];
  const base = `/images/song/${id}`;
  return {
    id: Number(id),
    art: `${base}.webp`,
    artSmall: `${base}-s.webp`,
    artLarge: item.large ? `${base}-l.webp` : `${base}.webp`,
    text: item.tw ? `${base}-text.webp` : "",
    w: item.w, h: item.h, tw: item.tw ?? 0, th: item.th ?? 0,
    source,
    caption: `南宋 · ${source.artist}《${source.title}》`,
  };
}

/** 有马和之画的篇目，按诗篇顺序 */
export function songPaintedIds() {
  return Object.keys(songData.poems).map(Number).sort((a, b) => a - b);
}

/** 意象 → 立轴；顺序即优先级 */
const HANGING_ORDER = ["reeds", "bamboo", "blossom", "willow", "pine", "grass", "moon", "water", "birds", "peaks", "hills", "distant"];
const PLANT_TO_HANGING = { reeds: "reeds", bamboo: "bamboo", blossom: "blossom", willow: "willow", pine: "hills", grass: "distant" };

/**
 * 其余诗篇的立轴配画
 * @param {{ id: number, title: string, content: string[] }} poem
 */
export function hangingFor(poem) {
  const scene = sceneFor(poem);
  const wants = [];
  if (scene.moon) wants.push("moon");
  for (const plant of scene.plants) wants.push(PLANT_TO_HANGING[plant]);
  if (scene.boat || scene.water) wants.push("water");
  if (scene.birds) wants.push("birds");
  wants.push(scene.mountain);
  const hangings = songData.hangings ?? {};
  let key = HANGING_ORDER.find((name) => wants.includes(name) && hangings[name]) ?? "distant";
  // 写水的诗最多，隔篇换一幅
  if (key === "water" && poem.id % 2 && hangings.mist) key = "mist";
  const item = hangings[key];
  return {
    key,
    src: `/images/hanging/${key}.webp`,
    small: `/images/hanging/${key}-s.webp`,
    w: item.w, h: item.h,
    caption: `${item.dynasty} · ${item.artist}\u3000${item.title}`,
    museum: "美国大都会艺术博物馆藏",
    page: `https://www.metmuseum.org/art/collection/search/${item.met}`,
  };
}
