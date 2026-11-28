/**
 * 站长纸质《诗经》（PR #15 校对）确定的读音。优先级高于国学梦注音：生成预计算注音时最后套用。
 *  - 施于 → yì（施于中谷 等）
 *  - 害澣害否 / 害浣害否 → 两个「害」读 hé
 *  - 葛藟累之 / 甘瓠累之 → 累 léi
 *  - 语助词「只」→ zhǐ（全部「只」）
 * words: 词内按下标指定读音；chars: 该字所有出现处。
 */
/** @type {Record<string, Array<[number, string]>>} */
export const BOOK_WORDS = {
  亦施于宇: [[1, "yì"]],
  施于中谷: [[0, "yì"]],
  施于孙子: [[0, "yì"]],
  施于条枚: [[0, "yì"]],
  施于松上: [[0, "yì"]],
  施于松柏: [[0, "yì"]],
  害浣害否: [[0, "hé"], [2, "hé"]],
  害澣害否: [[0, "hé"], [2, "hé"]],
  葛藟累之: [[2, "léi"]],
  甘瓠累之: [[2, "léi"]]
};
export const BOOK_CHARS = { 只: "zhǐ" };

/**
 * 古文之家《诗经拼音版》（大字注音本，2024.8）校审后采用的读音（PR 校审注音）。
 * 只收「该本读音与国学梦原注释括号里的读音一致、而与正文注音不同」的字：两处独立来源互证才改。
 * 优先级低于下面的站长纸质书校正（BOOK_*）：纸质书与此处冲突时以纸质书为准。
 * 不/一 变调一律取本调；其余分歧见 docs/pinyin-edition-review.md。
 */
/** @type {Record<string, Array<[number, string]>>} */
export const EDITION_WORDS = {
  子孙振振兮: [[2, "zhēn"]],
  孙振振兮: [[2, "zhēn"]],
  丝五总委蛇: [[2, "zōng"]],
  兮无感我帨: [[2, "hàn"]],
  五豝于嗟乎: [[2, "xū"]],
  五豵于嗟乎: [[2, "xū"]],
  桑中要我乎: [[2, "yāo"]],
  缝裳要之襋: [[2, "yāo"]],
  无已大康职: [[2, "tài"]],
  无以大康职: [[2, "tài"]],
  之曷饮食之: [[2, "yìn"]],
  人之为言苟: [[2, "wěi"]],
  人之为言胡: [[2, "wěi"]],
  栖迟泌之洋: [[2, "bì"]],
  佼人懰兮舒: [[2, "liǔ"]],
  劳心惨兮: [[2, "cǎo"]],
  傩其华夭之: [[2, "huā"]],
  人兮何戈与: [[2, "hè"]],
  零露湑兮既: [[2, "xǔ"]],
  其夜乡晨庭: [[2, "xiàng"]],
  祈父予王: [[1, "fǔ"]],
  靡所厎止: [[2, "zhǐ"]],
  祈父亶不: [[1, "fǔ"]],
  白驹贲然来: [[2, "bì"]],
  如跂斯翼: [[1, "qǐ"]],
  下莞上簟: [[1, "guān"]],
  其浆鞙鞙佩: [[2, "juān"]],
  浆鞙鞙佩璲: [[2, "juān"]],
  式既齐既稷: [[2, "zhāi"]],
  我心苑结: [[2, "yùn"]],
  维枞贲鼓维: [[2, "fén"]],
  实覃实訏: [[1, "tán"]],
  之攸塈: [[2, "jì"]],
  夜匪解以事: [[2, "xiè"]],
  替职兄斯引: [[2, "kuàng"]],
  矣职兄斯弘: [[2, "kuàng"]],
  无封靡于尔: [[2, "mí"]],
  夷之行子孙: [[2, "háng"]],
  介维莫之春: [[2, "mù"]],
  遏刘耆定尔: [[2, "zhǐ"]],
  皇以间之: [[2, "jiàn"]],
  翕河敷天之: [[2, "pǔ"]],
  或遑振振君: [[2, "zhēn"]],
  遑振振君子: [[2, "zhēn"]],
  遑息振振君: [[2, "zhēn"]],
  息振振君子: [[2, "zhēn"]],
  遑处振振君: [[2, "zhēn"]],
  处振振君子: [[2, "zhēn"]],
  余来塈: [[2, "jì"]],
  来思何蓑何: [[2, "hè"]],
  何蓑何笠或: [[2, "hè"]],
  家父作诵: [[1, "fǔ"]],
  师尚父时维: [[2, "fǔ"]],
  知而莫成昊: [[2, "mù"]],
  甥蹶父之子: [[2, "fǔ"]],
  师皇父整我: [[2, "fǔ"]],
  伯休父左右: [[2, "fǔ"]],
  明明振振鹭: [[2, "zhēn"]],
  明振振鹭鹭: [[2, "zhēn"]],
  饮酒振振鹭: [[2, "zhēn"]],
  酒振振鹭鹭: [[2, "zhēn"]],
  秋匪解享祀: [[2, "xiè"]],
  禄是何: [[2, "hè"]]
};

/**
 * @param {string[]} chars 一行里的汉字（已去掉标点）
 * @returns {Map<number, string>} 汉字下标 -> 书上读音
 */
export function bookReadings(chars) {
  const result = new Map();
  const text = chars.join("");
  chars.forEach((ch, i) => { if (BOOK_CHARS[ch]) result.set(i, BOOK_CHARS[ch]); });
  // 大字注音本校审的读音先套用，纸质书校正随后覆盖
  for (const table of [EDITION_WORDS, BOOK_WORDS]) applyWords(table, text, result);
  return result;
}

/** @param {Record<string, Array<[number, string]>>} table */
function applyWords(table, text, result) {
  for (const [word, tones] of Object.entries(table)) {
    for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
      for (const [k, tone] of tones) result.set(at + k, tone);
    }
  }
}

/**
 * 篇名注音校正：篇名按「标题 -> 逐字读音」整体指定，优先于拼音库。
 * 来源是通行诗经注本的读法（未经站长纸质书核对），有出入时以纸质书为准，再来这里改。
 * 篇名字数简繁一致，繁体标题共用这份注音。
 */
export const TITLE_READINGS = {
  氓: "méng",
  还: "xuán",
  摽有梅: "biào yǒu méi",
  卢令: "lú líng",
  蓼萧: "lù xiāo",
  蓼莪: "lù é",
  行苇: "xíng wěi",
  卷阿: "juǎn ē",
  瞻卬: "zhān áng",
  渐渐之石: "jiān jiān zhī shí",
  假乐: "jiā lè",
  皇皇者华: "huáng huáng zhě huā",
  裳裳者华: "cháng cháng zhě huā",
  白华: "bái huā",
  苕之华: "tiáo zhī huā"
};
