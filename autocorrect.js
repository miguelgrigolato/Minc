/*!
 * MINC — Corretor ortográfico automático (v1.0)
 * Independente do resto do app: basta incluir <script src="autocorrect.js"></script> antes do app.js.
 *
 * O que faz:
 *  - Ao sair de um campo de texto (input/textarea), troca palavras do dicionário pela grafia correta.
 *  - Mostra um aviso "Corrigido: ERRADO → CERTO" com botão DESFAZER (6 s).
 *  - Nunca mexe em códigos: qualquer palavra colada em número ou "_" (NSK1215KC3, CSP_E5_426_..., N1202, M16X65) é ignorada.
 *  - Ignora campos senha/e-mail/número/data e campos com data-keep-case ou data-no-autocorrect.
 *  - Dicionário extensível: MincCorretor.adicionar('ERRADO', 'CERTO') (salvo no aparelho),
 *    ou MincCorretor.definirDicionario([...]) para carregar do Supabase (catálogo editável pelo administrador).
 */
(function (root) {
  'use strict';

  // [erro, correto] — todos em MAIÚSCULAS; frases com espaço são aceitas.
  var BASE = [
    ['FRABRICAR', 'FABRICAR'],
    ['NORMALISAR', 'NORMALIZAR'],
    ['NORMALISA', 'NORMALIZA'],
    ['RECURERAR', 'RECUPERAR'],
    ['JUNTASDEVEDAÇÃO', 'JUNTAS DE VEDAÇÃO'],
    ['CONTONEIRAS', 'CANTONEIRAS'],
    ['FUNDO FUNDO', 'FUNDO'],
    ['PINTURA FUNDO EPÓXI', 'PINTURA DE FUNDO EPÓXI'],
    ['INDENTIFICAÇÃO', 'IDENTIFICAÇÃO'],
    ['DIMENCIONAL', 'DIMENSIONAL'],
    ['ESTANQUIDADE', 'ESTANQUEIDADE'],
    ['ESTA DANIFICADO', 'ESTÁ DANIFICADO'],
    ['REALIZA LIMPEZA', 'REALIZAR LIMPEZA'],
    ['DESCARTA POSSIBILIDADE', 'DESCARTAR POSSIBILIDADE']
  ];

  var STORE_KEY = 'minc_dicionario_v1';
  var extra = [];
  try { extra = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { extra = []; }
  var remoto = null; // dicionário carregado do Supabase (substitui só o "extra")

  var L = '(?<![\\p{L}\\p{N}_])';   // não está colado em letra, número ou "_"
  var R = '(?![\\p{L}\\p{N}_])';
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var rules = [];
  function compilar() {
    var all = BASE.concat(remoto || extra);
    rules = all.map(function (p) {
      var pat = esc(String(p[0]).toUpperCase()).replace(/\s+/g, '\\s+');
      return { re: new RegExp(L + pat + R, 'giu'), to: String(p[1]), from: String(p[0]) };
    });
  }

  function casar(orig, certo) {            // mantém MAIÚSCULA / minúscula / Inicial do original
    if (orig === orig.toUpperCase()) return certo.toUpperCase();
    if (orig === orig.toLowerCase()) return certo.toLowerCase();
    return certo.charAt(0).toUpperCase() + certo.slice(1).toLowerCase();
  }

  // Retorna { texto, mudancas:[{de,para}] }
  function corrigir(texto) {
    var mud = [];
    var t = String(texto == null ? '' : texto);
    rules.forEach(function (r) {
      t = t.replace(r.re, function (m) {
        var novo = casar(m, r.to);
        if (novo !== m) mud.push({ de: m.replace(/\s+/g, ' '), para: novo });
        return novo;
      });
    });
    // pontuação: ". ." e ".." no fim do texto viram "." (reticências "..." ficam intactas)
    var p = t.replace(/(?<!\.)\.\s\.\s*$/u, '.').replace(/(?<!\.)\.\.\s*$/u, '.');
    if (p !== t) { mud.push({ de: '..', para: '.' }); t = p; }
    return { texto: t, mudancas: mud };
  }

  // ---------------- interface (só roda no navegador) ----------------
  var avisoEl = null, avisoTimer = null;
  function aviso(msg, desfazer) {
    if (!root.document) return;
    if (!avisoEl) {
      avisoEl = root.document.createElement('div');
      avisoEl.setAttribute('role', 'status');
      avisoEl.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99999;max-width:90vw;' +
        'background:#111;color:#fff;padding:10px 12px;border-radius:8px;font:600 13px/1.3 Inter,Roboto,Arial,sans-serif;' +
        'box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center';
      root.document.body.appendChild(avisoEl);
    }
    avisoEl.textContent = '';
    var s = root.document.createElement('span'); s.textContent = msg; avisoEl.appendChild(s);
    var b = root.document.createElement('button');
    b.type = 'button'; b.textContent = 'DESFAZER';
    b.style.cssText = 'min-height:44px;min-width:44px;padding:0 12px;border:1px solid #fff;border-radius:6px;' +
      'background:transparent;color:#fff;font:700 12px Inter,Roboto,Arial,sans-serif;cursor:pointer';
    b.onclick = function () { desfazer(); avisoEl.style.display = 'none'; };
    avisoEl.appendChild(b);
    avisoEl.style.display = 'flex';
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { avisoEl.style.display = 'none'; }, 6000);
  }

  function elegivel(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toUpperCase();
    if (tag === 'TEXTAREA') return !el.hasAttribute('data-no-autocorrect') && !el.hasAttribute('data-keep-case');
    if (tag !== 'INPUT') return false;
    var tp = (el.getAttribute('type') || 'text').toLowerCase();
    if (['text', 'search'].indexOf(tp) < 0) return false;
    return !el.hasAttribute('data-no-autocorrect') && !el.hasAttribute('data-keep-case') && !el.readOnly && !el.disabled;
  }

  function disparar(el) {
    ['input', 'change'].forEach(function (n) { el.dispatchEvent(new Event(n, { bubbles: true })); });
  }

  function ao_sair(ev) {
    var el = ev.target;
    if (!elegivel(el)) return;
    var antes = el.value;
    if (!antes) return;
    var r = corrigir(antes);
    if (r.texto === antes) return;
    el.value = r.texto; disparar(el);
    var resumo = r.mudancas.slice(0, 2).map(function (m) { return m.de + ' → ' + m.para; }).join(' · ');
    if (r.mudancas.length > 2) resumo += ' (+' + (r.mudancas.length - 2) + ')';
    aviso('Corrigido: ' + resumo, function () { el.value = antes; disparar(el); });
  }

  // ---------------- API pública ----------------
  var API = {
    corrigir: corrigir,
    dicionario: function () { return BASE.concat(remoto || extra); },
    adicionar: function (erro, certo) {
      extra.push([String(erro).toUpperCase(), String(certo).toUpperCase()]);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(extra)); } catch (e) {}
      compilar();
    },
    definirDicionario: function (pares) { remoto = Array.isArray(pares) ? pares : null; compilar(); }
  };

  compilar();
  if (root.document) {
    root.document.addEventListener('focusout', ao_sair, true);
    root.MincCorretor = API;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
