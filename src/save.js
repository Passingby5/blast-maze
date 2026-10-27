// Save format with versioning. Old, broken or out-of-range saves are ignored safely.
(function (root) {
  var KEY = 'blastmaze_save', VERSION = 2;
  function fresh() { return { v: VERSION, story: null, best: 0, settings: { muted: false, difficulty: 'medium' } }; }
  function read(st) {
    var d = fresh(); try { var raw = st.getItem(KEY); if (!raw) return d; var o = JSON.parse(raw); if (!o || o.v !== VERSION) return d;
      if (o.settings) { d.settings.muted = !!o.settings.muted; if (['easy', 'medium', 'hard'].indexOf(o.settings.difficulty) >= 0) d.settings.difficulty = o.settings.difficulty; }
      d.best = +o.best || 0;
      d.story = cleanStory(o.story);
    } catch (e) { } return d;
  }
  var DIFFS = ['easy', 'medium', 'hard'];
  function int(v, lo, hi) { if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) throw 0; return Math.max(lo, Math.min(hi, v)); }
  // Strict check: wrong types or missing fields reject the whole story save; numbers out of range are clamped.
  function cleanStory(s) {
    try {
      if (!s || typeof s !== 'object' || Array.isArray(s)) return null; var c = s.carry;
      if (typeof s.level !== 'number' || Math.floor(s.level) !== s.level || s.level < 0 || s.level > 11) return null;
      if (DIFFS.indexOf(s.difficulty) < 0) return null;
      if (!c || typeof c !== 'object' || typeof c.kick !== 'boolean') return null;
      return { level: s.level, difficulty: s.difficulty, attempt: typeof s.attempt === 'number' && isFinite(s.attempt) ? Math.max(0, Math.floor(s.attempt)) % 1e6 : 0,
        carry: { bombs: int(c.bombs, 1, 8), range: int(c.range, 1, 8), speedUps: int(c.speedUps, 0, 4), kick: c.kick, shield: int(c.shield, 0, 2), lives: int(c.lives, 1, 9), score: int(c.score, 0, 9999999) } };
    } catch (e) { return null; }
  }
  function write(st, d) { try { var o = { v: VERSION, story: d.story || null, best: d.best || 0, settings: d.settings || fresh().settings }; st.setItem(KEY, JSON.stringify(o)); } catch (e) { } }
  var api = { KEY: KEY, VERSION: VERSION, read: read, write: write, cleanStory: cleanStory, fresh: fresh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.BM = root.BM || {}; root.BM.Save = api; }
})(this);
