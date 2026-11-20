// ---- render principal ----
function render() {
  renderStatus();
  renderTable();
  renderActions(); renderLive(); renderFb(); renderLog();
}
function renderTable() { $('table').innerHTML = tableHTML(liveView(), 'lg') + strengthHTML(); }
const fmtN = x => String(x).replace('.', DEC).replace('-', '−');
