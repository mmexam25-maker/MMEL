(() => {
  function makeRunner(success, failure) {
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') return fn => makeRunner(fn, failure);
        if (prop === 'withFailureHandler') return fn => makeRunner(success, fn);
        if (prop === 'then') return undefined;
        return (...args) => {
          fetch('/api/outsource/call', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({fn: String(prop), args})
          })
          .then(async r => {
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
            return j.result;
          })
          .then(v => { if (success) success(v); })
          .catch(err => {
            if (failure) failure({message: err.message || String(err)});
            else console.error(err);
          });
        };
      }
    });
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    get() { return makeRunner(null, null); }
  });
})();
