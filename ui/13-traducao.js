// Tradução da página para o inglês: troca os textos fixos (do HTML e dos modelos) pelo dicionário.
// Os textos com números vêm traduzidos do motor (tx); aqui só os que são iguais a uma chave.
if (E.LANG === 'en') {
  const ATTRS = ['aria-label', 'title', 'placeholder'];
  const trText = node => { const v = node.nodeValue, k = v.trim(); if (!k) return; const r = E.tr(k); if (r !== k) node.nodeValue = v.replace(k, r); };
  const trEl = el => { for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const r = E.tr(v.trim()); if (r !== v.trim()) el.setAttribute(a, r); } } };
  const walk = root => {
    if (root.nodeType === 3) return trText(root);
    if (root.nodeType !== 1) return;
    trEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? trText(n) : trEl(n);
  };
  walk(document.body);
  document.title = E.tr(document.title);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') trEl(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
