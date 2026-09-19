// Local storage wrapper. Uses Capacitor Preferences on-device (native
// SharedPreferences under the hood) and falls back to localStorage when
// running in a plain desktop browser during development.
const Prefs = (() => {
  const hasCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences);
  const cache = {};

  // Capacitor Preferences is async; we mirror everything into an
  // in-memory cache on load so the rest of the app can read/write
  // synchronously (Preferences.set() below fires the async persist and
  // doesn't block the UI).
  async function hydrate(keys) {
    if (!hasCapacitor) {
      keys.forEach((k) => (cache[k] = localStorage.getItem(k)));
      return;
    }
    const { Preferences } = window.Capacitor.Plugins;
    for (const k of keys) {
      const { value } = await Preferences.get({ key: k });
      cache[k] = value;
    }
  }

  function get(key) {
    return cache[key] || "";
  }

  function set(key, value) {
    cache[key] = value;
    if (hasCapacitor) {
      window.Capacitor.Plugins.Preferences.set({ key, value: value || "" });
    } else {
      localStorage.setItem(key, value || "");
    }
  }

  return { hydrate, get, set };
})();
