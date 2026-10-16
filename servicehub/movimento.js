/* MINC · Peritagem — v5.7.0 · movimento.js
   Dois detalhes de toque, só visuais: o ponto de luz que segue o cursor nos botões e cartões,
   e a onda que sai do ponto tocado. Não lê nem altera dados; se falhar, o app funciona igual.
   Respeita "reduzir movimento". */
(function () {
  'use strict';
  var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function alvo(e, sel) {
    var t = e.target;
    return t && t.closest ? t.closest(sel) : null;
  }

  // reconhece os ícones que têm gesto próprio (+ gira, seta avança, voltar recua, lixeira inclina)
  var FORMAS = {
    'M12 5v14M5 12h14': 'plus',
    'M5 12h14M12 5l7 7-7 7': 'next',
    'M19 12H5M12 19l-7-7 7-7': 'back',
    'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6': 'trash'
  };
  document.addEventListener('pointerover', function (e) {
    var b = alvo(e, '.btn');
    if (!b || b.hasAttribute('data-ic-ok')) return;
    b.setAttribute('data-ic-ok', '');
    var ics = b.querySelectorAll(':scope > svg.ic');
    for (var i = 0; i < ics.length; i++) {
      var p = ics[i].querySelector('path');
      var nome = p && FORMAS[p.getAttribute('d')];
      if (nome) ics[i].setAttribute('data-ic', nome);
    }
  }, { passive: true });

  // ponto de luz: posição do cursor dentro do botão/cartão
  var raf = 0, ult = null;
  document.addEventListener('pointermove', function (e) {
    if (rm.matches || e.pointerType === 'touch') return;
    var el = alvo(e, '.btn,.rcard');
    if (!el) return;
    ult = { el: el, x: e.clientX, y: e.clientY };
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var r = ult.el.getBoundingClientRect();
      ult.el.style.setProperty('--mx', (ult.x - r.left) + 'px');
      ult.el.style.setProperty('--my', (ult.y - r.top) + 'px');
    });
  }, { passive: true });

  // onda no toque (botões cheios; o ghost e os desabilitados ficam quietos)
  document.addEventListener('pointerdown', function (e) {
    if (rm.matches || (e.button && e.button > 0)) return;
    var b = alvo(e, '.btn');
    if (!b || b.disabled || b.classList.contains('ghost') || b.getAttribute('aria-busy') === 'true') return;
    var r = b.getBoundingClientRect();
    var d = Math.max(r.width, r.height) * 2.2;
    var s = document.createElement('span');
    s.className = 'rp';
    s.setAttribute('aria-hidden', 'true');
    s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left - d / 2) + 'px';
    s.style.top = (e.clientY - r.top - d / 2) + 'px';
    s.addEventListener('animationend', function () { if (s.parentNode) s.parentNode.removeChild(s); });
    b.appendChild(s);
  }, { passive: true });
})();
