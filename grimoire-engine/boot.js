(function(){
  const source = window.__GRIMOIRE_CODE || '';
  window.__GRIMOIRE_CODE = '';
  (0, eval)(source);
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.GrimoireApp));
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
