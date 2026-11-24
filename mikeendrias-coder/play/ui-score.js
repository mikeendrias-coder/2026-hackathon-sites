/* Face Value: overview + state scorecard (FV.mods.score). Stub from the contract shell; B2 builds it out.
   API used by ui-core: overview(el, route), head(el, route), render(el, route). No English here: use FV.W / FV.C. */
(function () {
  'use strict';
  window.FV.register('score', {
    init: function (FV) {},
    overview: function (el, r) { el.innerHTML = '<h2 id="ov-title" tabindex="-1">' + window.FV.h.esc(window.FV.W('ov.title')) + '</h2>'; },
    head: function (el, r) { el.innerHTML = '<h2 id="pn-title" tabindex="-1">' + window.FV.h.esc(r.st) + '</h2>'; },
    render: function (el, r) { el.innerHTML = ''; }
  });
})();
