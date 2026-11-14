// Translate approved uploads into the player-workshop catalog used by the lobby.
const OK = (data) => ({ code: "00000", data, msg: "", local: true });

function card(item, scene) {
  if (!item || !/^[a-f0-9]{16}$/i.test(item.shareCode || "")) return null;
  let facts = item.facts;
  if (!facts) {
    if (!scene) return null;
    let doc;
    try { doc = typeof scene.doc === "string" ? JSON.parse(scene.doc) : scene.doc; } catch { return null; }
    if (!doc || !doc.rules || !doc.playerSpawn) return null;
    const rules = doc.rules;
    facts = { balls: 0, bots: (doc.actors || []).length, deathEndsRound: rules.playerDeath === "endRound",
      duration: rules.duration || 60, movable: rules.playerMovable !== false,
      scoring: rules.scoring || "clicking", shoots: true,
      spawnX: doc.playerSpawn.position?.x || 0, spawnZ: doc.playerSpawn.position?.z || 0,
      weapon: rules.weapon || "vandal" };
  }
  const mapId = item.mapId || null;
  const timestamp = Date.parse(item.createTime) || Date.now();
  return {
    authorCode: scene?.authorUid || "", authorName: item.authorNickname || scene?.authorNickname || "Creator", authorWorks: 1,
    category: mapId ? "map" : "ball", code: item.shareCode,
    // A moderator-set picture: the page loads /pw/covers/<coverCode>.jpg (main.js serves it).
    coverCode: Number.isSafeInteger(item.coverVersion)
      ? item.shareCode + "-" + item.coverVersion
      : (mapId ? null : "default-arena"),
    description: item.description || null, difficulty: "medium",
    facts,
    favorites: item.likeCount || 0, featured: !!item.featured, fresh: Date.now() - timestamp < 3 * 86400000,
    mapId, official: false, officialEdit: false, playersWeek: item.weekLikeCount || 0, plays: item.playCount || 0,
    publishedAgoSeconds: Math.max(0, Math.floor((Date.now() - timestamp) / 1000)),
    publishedTime: new Date(timestamp).toISOString().replace("T", " ").slice(0, 19),
    rating: null, ratingCount: 0, title: item.name || scene?.name || "Untitled creation",
    updatedTime: null, version: 1,
  };
}

function catalog(entries) {
  return entries.map(({ item, scene }) => card(item, scene)).filter(Boolean);
}

function home(cards) {
  // Shelves: hot = liked this week, quality = most liked overall. Empty until liked.
  const hot = cards.filter((item) => item.playersWeek > 0).sort(SORTS.WEEK_HOT).slice(0, 12);
  const quality = cards.filter((item) => item.favorites > 0).sort(SORTS.FAVORITES).slice(0, 12);
  // Pinned (featured) drills lead the front shelf; tagged "featured", the lobby titles
  // the shelf "Picks of the week" and badges those cards.
  const lead = cards.slice().sort((a, b) => b.featured - a.featured);
  return OK({ stage: lead.slice(0, 9).map((item) => ({ item, source: item.featured ? "featured" : "new" })),
    fresh: cards, freshTotal: cards.length, hot, quality, local: true,
    capturedAt: new Date().toISOString() });
}

// The sort menu's choices, by the ids the page sends. Likes stand in for ratings
// and plays until those are tracked; Recommended keeps featured drills first.
const newest = (a, b) => b.publishedTime.localeCompare(a.publishedTime);
const SORTS = {
  RECOMMEND: (a, b) => (b.featured - a.featured) || (b.favorites - a.favorites) || newest(a, b),
  LATEST: newest,
  WEEK_HOT: (a, b) => (b.playersWeek - a.playersWeek) || (b.favorites - a.favorites) || newest(a, b),
  RATING: (a, b) => (b.favorites - a.favorites) || newest(a, b),
  FAVORITES: (a, b) => (b.favorites - a.favorites) || newest(a, b),
  HOT: (a, b) => (b.plays - a.plays) || (b.favorites - a.favorites) || newest(a, b),
};

function page(cards, params) {
  const category = params.get("category"), map = params.get("map"), difficulty = params.get("difficulty");
  const query = (params.get("q") || "").trim().toLowerCase();
  const code = query.replace(/^no.?/, "").replace(/[^0-9a-f]/g, "").toUpperCase();
  const filtered = cards.filter((item) => (!category || item.category === category) &&
    (!map || item.mapId === map) && (!difficulty || item.difficulty === difficulty) &&
    (!query || (item.title + " " + (item.description || "") + " " + item.authorName).toLowerCase().includes(query) ||
      // A share code ("5BDF31", "NO.5BDF31") finds its drill.
      (code.length >= 4 && item.code.toUpperCase().startsWith(code))));
  filtered.sort(SORTS[params.get("sort")] || SORTS.RECOMMEND);
  const number = Math.max(1, Number(params.get("pageNum")) || 1);
  const size = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 24));
  const byMap = {};
  for (const item of cards) if (item.mapId) byMap[item.mapId] = (byMap[item.mapId] || 0) + 1;
  return OK({ list: filtered.slice((number - 1) * size, number * size), total: filtered.length,
    countAll: cards.length, countMap: cards.filter((item) => item.category === "map").length,
    countBall: cards.filter((item) => item.category === "ball").length, countByMap: byMap,
    localCoverage: { sourceTotal: cards.length, captured: cards.length, complete: true } });
}

module.exports = { card, catalog, home, page, OK };
