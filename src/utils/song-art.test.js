import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import poems from "../data/poems.json";
import { hangingFor, songPaintedIds, songPaintingFor } from "./song-art.js";

const byTitle = (title, section) => poems.find((poem) => poem.title === title && (!section || poem.section === section));
const onDisk = (url) => existsSync(new URL(`../../public${url}`, import.meta.url));

describe("宋画诗经图", () => {
  it("鹿鸣、七月、鸿雁配马和之原画，图都在", () => {
    for (const [title, section] of [["鹿鸣"], ["七月"], ["鸿雁"], ["黄鸟", "鸿雁之什"]]) {
      const art = songPaintingFor(byTitle(title, section).id);
      expect(art, title).not.toBeNull();
      expect(art.source.artist).toBe("马和之");
    }
    for (const id of songPaintedIds()) {
      const art = songPaintingFor(id);
      expect(onDisk(art.art) && onDisk(art.artSmall) && onDisk(art.artLarge), String(id)).toBe(true);
      if (art.text) expect(onDisk(art.text)).toBe(true);
    }
  });

  it("秦风黄鸟没有马和之画，配立轴", () => {
    expect(songPaintingFor(byTitle("黄鸟", "秦风").id)).toBeNull();
  });
});

describe("立轴配画", () => {
  it("蒹葭配芦苇，每首诗都有画且图在", () => {
    expect(hangingFor(byTitle("蒹葭")).key).toBe("reeds");
    expect(hangingFor(byTitle("淇奥")).key).toBe("bamboo");
    for (const poem of poems) {
      const hanging = hangingFor(poem);
      expect(onDisk(hanging.src), poem.title).toBe(true);
      expect(hanging.caption).toMatch(/^[宋元明清]/u);
    }
  });
});
