// Save format with versioning. Old, broken or out-of-range saves are ignored safely.
(function (root) {
  var KEY = 'blastmaze_save', VERSION = 2;
  function fresh() { return { v: VERSION, story: null, best: 0, settings: { muted: false, difficulty: 'medium' } }; }
  function read(st) {
    var d = fresh(); try { var raw = st.getItem(KEY); if (!raw) return d; var o = JSON.parse(raw); if (!o || o.v !== VERSION) return d;
      if (o.settings) { d.settings.muted = !!o.settings.muted; if (['easy', 'medium', 'hard'].indexOf(o.settings.difficulty) >= 0) d.settings.difficulty = o.settings.difficulty; }
      d.best = +o.best || 0;
      if (o.story && o.story.level >= 0 && o.story.level < 12 && o.story.carry) d.story = o.story;
    } catch (e) { } return d;
  }
  function write(st, d) { try { var o = { v: VERSION, story: d.story || null, best: d.best || 0, settings: d.settings || fresh().settings }; st.setItem(KEY, JSON.stringify(o)); } catch (e) { } }
  var api = { KEY: KEY, VERSION: VERSION, read: read, write: write, fresh: fresh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.BM = root.BM || {}; root.BM.Save = api; }
})(this);
