// Tiny wrapper so call sites don't need to null-check the plugin every
// time. No-ops in a plain browser (dev) or if the plugin failed to load.
const JarvisHaptics = {
  light() {
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (!plugin) return;
    plugin.impact({ style: "LIGHT" }).catch(() => {});
  },
  medium() {
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (!plugin) return;
    plugin.impact({ style: "MEDIUM" }).catch(() => {});
  },
};
