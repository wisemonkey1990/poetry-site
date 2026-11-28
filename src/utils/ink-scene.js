/* 阅读页配画：按诗里的意象（山、水、芦苇、桃花、杨柳、竹、松、月、鸟……）挑选预先画好的水墨画材，拼成一幅小景。
   画材是 public/images/ink/ 下的透明图（scripts/build-ink-art.mjs 生成），在 CSS 里当遮罩用，墨色随晨昼暮夜变化。 */
import { html, raw } from "./html.js";

/** 意象 → 诗里的字；顺序即前景植物的优先级
 * @type {[string, RegExp][]} */
const MOTIFS = [
  ["willow", /[杨柳]/u],
  ["blossom", /[桃梅棠李华葩荣]/u],
  ["bamboo", /竹/u],
  ["reeds", /[蒹葭苇芦荇萍蘋藻蒲荷莞]/u],
  ["pine", /[松柏桧樛]|乔木/u],
  ["grass", /[薇黍稷禾麦苗蕨葛菽艾萧蒿莪芣苢卷耳]/u],
];
const WATER = /[河江汉洲淇泉川渚沚涘浦池波舟泛湄澳洧溱汶淮]|水/u;
const BOAT = /[舟楫]|泛/u;
const MOUNTAIN = /[山冈岵屺陵嵩岳嵬巘砠阿]|丘|南山/u;
const MOON = /[月宵星昏夜]/u;
const BIRDS = /[鸟鸠雁雀燕鸿鹊鸡鹭鹤鸮凫隼鹑鸱雉]|仓庚|于飞/u;

/** 同一首诗永远同一种构图 */
function seeded(id) { let s = (Number(id) * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/**
 * @param {{ id: number, title: string, content: string[] }} poem
 */
export function sceneFor(poem) {
  const text = `${poem.title}${(poem.content || []).join("")}`;
  const r = seeded(poem.id);
  const plants = MOTIFS.filter(([, re]) => re.test(text)).map(([name]) => name).slice(0, 2);
  let water = WATER.test(text);
  // 诗里没有明写景物的（多为雅颂），配一幅寻常的山水：远山、江流，或一株老松
  if (!plants.length && !water) {
    const pick = r();
    if (pick < 0.4) water = true;
    else if (pick < 0.7) plants.push("pine");
  }
  const mountain = MOUNTAIN.test(text) ? "peaks" : (r() < 0.5 ? "hills" : "distant");
  return {
    mountain,
    flip: r() < 0.5,
    water,
    boat: water && (BOAT.test(text) || r() < 0.3),
    plants,
    moon: MOON.test(text),
    birds: BIRDS.test(text) || r() < 0.35,
    orbX: Math.round(22 + r() * 46),
  };
}

const birdsSvg = raw('<svg class="ink-birds" viewBox="0 0 80 30" aria-hidden="true"><path d="M2 14q5-6 10 0q5-6 10 0M30 6q4-5 8 0q4-5 8 0M52 20q3-4 7 0q3-4 7 0"/></svg>');

/** 配画标记：全部 aria-hidden，纯装饰 */
export function sceneMarkup(poem, { inscription = "" } = {}) {
  const s = sceneFor(poem);
  return html`
    <div class="ink-scene" data-mountain="${s.mountain}" data-flip="${String(s.flip)}" data-moon="${String(s.moon)}" style="--orb-left:${s.orbX}%">
      <i class="ink-orb"></i>
      ${s.birds ? birdsSvg : ""}
      <i class="ink-layer ink-mountain"></i>
      <i class="ink-mist"></i>
      ${s.water ? html`<i class="ink-layer ink-water"></i>` : ""}
      ${s.boat ? html`<i class="ink-layer ink-boat"></i>` : ""}
      ${s.plants.map((name, index) => html`<i class="ink-layer ink-plant ink-${name}" data-slot="${index ? "b" : "a"}"></i>`)}
      ${inscription ? html`<p class="ink-inscription">${inscription}</p>` : ""}
    </div>`;
}
