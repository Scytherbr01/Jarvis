// Small in-memory runtime state — currently just whether call-alerts are
// switched on. Resets to enabled on restart; there's only one user, so a
// database is unwarranted overhead for one boolean.
export const runtimeState = {
  callAlertsEnabled: true,
};
