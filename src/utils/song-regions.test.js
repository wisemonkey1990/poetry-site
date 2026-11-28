import { describe, expect, it } from "vitest";
import poems from "../data/poems.json";
import regions from "../data/song-regions.json";
import { songPaintingFor } from "./song-art.js";
import { locateVerse, regionsFor } from "./song-regions.js";

const poem = (id) => poems.find((p) => p.id === id);

describe("画中寻诗", () => {
  it("每一处都落在有马和之画的诗上，诗句在正文里找得到，坐标在画内", () => {
    for (const [id, list] of Object.entries(regions)) {
      expect(songPaintingFor(id), id).toBeTruthy();
      for (const region of list) {
        expect(locateVerse(poem(Number(id)).content, region.q).length, `${id} ${region.q}`).toBeGreaterThan(0);
        const [x0, y0, x1, y1] = region.box;
        expect(0 <= x0 && x0 < x1 && x1 <= 1 && 0 <= y0 && y0 < y1 && y1 <= 1, `${id} ${region.q}`).toBe(true);
      }
    }
  });

  it("取整个分句，按汉字计下标；同一句在几章里出现都找出来", () => {
    const luming = poem(161).content;
    const hits = locateVerse(luming, "呦呦鹿鸣");
    expect(hits).toEqual([{ line: 0, from: 0, to: 4 }, { line: 1, from: 0, to: 4 }, { line: 2, from: 0, to: 4 }]);
    // 「鼓瑟吹笙」是第二个分句：前面「呦呦鹿鸣，食野之苹。我有嘉宾，」共 12 字
    expect(locateVerse(luming, "鼓瑟吹笙")[0]).toEqual({ line: 0, from: 12, to: 16 });
    expect(locateVerse(["九罭之鱼，鳟鲂；"], "九罭")[0]).toEqual({ line: 0, from: 0, to: 4 });
  });

  it("没标的诗返回空", () => {
    expect(regionsFor(1)).toEqual([]);
  });
});
