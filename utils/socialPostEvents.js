// Tiny in-memory event channel shared by social hooks. It keeps independently
// mounted feed, reply, and composer hooks in sync without moving the new data
// flow back into the legacy GlobalContext.

const listeners = new Set();

export function publishSocialPostEvent(event) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeSocialPostEvents(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
