/* Compatibility bridge: keeps the original google.script.run frontend API. */
(() => {
  class Runner {
    constructor(success, failure) { this.success = success; this.failure = failure; }
    withSuccessHandler(fn) { return new Runner(fn, this.failure); }
    withFailureHandler(fn) { return new Runner(this.success, fn); }
  }

  const handler = {
    get(target, prop) {
      if (prop === 'withSuccessHandler') return fn => new Proxy(new Runner(fn, target.failure), handler);
      if (prop === 'withFailureHandler') return fn => new Proxy(new Runner(target.success, fn), handler);
      return (...args) => {
        fetch('/api/call', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({fn: prop, args})
        })
        .then(async r => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok || data.ok === false) throw new Error(data.error || `HTTP ${r.status}`);
          return data.result;
        })
        .then(result => { if (typeof target.success === 'function') target.success(result); })
        .catch(err => {
          if (typeof target.failure === 'function') target.failure({message: err.message});
          else console.error(err);
        });
      };
    }
  };
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = new Proxy(new Runner(), handler);
})();
