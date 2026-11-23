// ---- render principal ----
function render() {
  renderStatus();
  renderTable();
  renderActions(); renderLive(); renderFb(); renderLog();
}
function renderTable() { const v = liveView(); $('table').classList.toggle('nine', v.seats.length === 9); $('table').innerHTML = tableHTML(v, 'lg') + strengthHTML(); }
const fmtN = x => String(x).replace('.', DEC).replace('-', '−');
