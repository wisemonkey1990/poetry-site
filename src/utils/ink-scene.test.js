import { describe, expect, it } from "vitest";
import poems from "../data/poems.json";
import { sceneFor, sceneMarkup } from "./ink-scene.js";

const byTitle = (title) => poems.find((poem) => poem.title === title);

describe("sceneFor", () => {
  it("蒹葭：水、芦苇", () => {
    const scene = sceneFor(byTitle("蒹葭"));
    expect(scene.water).toBe(true);
    expect(scene.plants).toContain("reeds");
  });

  it("桃夭：桃花；淇奥：竹与水", () => {
    expect(sceneFor(byTitle("桃夭")).plants[0]).toBe("blossom");
    const qiyu = sceneFor(byTitle("淇奥"));
    expect(qiyu.plants).toContain("bamboo");
    expect(qiyu.water).toBe(true);
  });

  it("采薇：杨柳、薇草；节南山：高山", () => {
    expect(sceneFor(byTitle("采薇")).plants[0]).toBe("willow");
    expect(sceneFor(byTitle("节南山")).mountain).toBe("peaks");
  });

  it("同一首诗每次构图相同，最多两种前景植物", () => {
    for (const poem of poems) {
      const scene = sceneFor(poem);
      expect(sceneFor(poem)).toEqual(scene);
      expect(scene.plants.length).toBeLessThanOrEqual(2);
    }
  });

  it("配画标记里没有可读文字（除了题款）", () => {
    const markup = String(sceneMarkup(byTitle("关雎")));
    expect(markup).toContain('class="ink-scene"');
    expect(markup.replace(/<[^>]+>/g, "").trim()).toBe("");
  });
});
