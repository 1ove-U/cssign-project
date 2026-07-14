/* Quick-quote modal tab switching — shared across index, products, about */

/* ── QMODAL TAB SWITCH ── */
function qmodalSwitchTab(tab) {
  var tabs = ['form', 'contact'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('qm-tab-' + t);
    var panel = document.getElementById('qm-panel-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
  });
}
