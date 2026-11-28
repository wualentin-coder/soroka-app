import { validateFullPlannerSnapshot } from './planner-model.mjs';

const key = 'flow-glow-plan-offline-v1';
const maxAge = 60 * 86400000; // Same offline ticket window as the classic planner.
const empty = names => Object.fromEntries(names.split(' ').map(name => [name, []]));

export function createPlannerOfflineCache(storage) {
  function read(owner) {
    if (!owner) return null;
    try {
      const saved = JSON.parse(storage.getItem(key));
      if (saved?.owner !== owner || !Number.isFinite(saved.at) || Date.now() - saved.at > maxAge) return null;
      validateFullPlannerSnapshot(saved.snapshot);
      return saved.snapshot;
    } catch {
      return null;
    }
  }

  return {
    read,
    write(owner, canonical) {
      if (!owner) return;
      const snapshot = {
        timezone: canonical.timezone,
        tasks: canonical.tasks,
        events: canonical.events,
        projects: canonical.projects.map(({ id, name, status }) => ({ id, name, status })),
        notes: [], inbox: [], metrics: [], trash: [], settings: {},
        saved: { ...empty('cards files posts links lists recipes movies products addresses'), tickets: canonical.saved.tickets },
        finance: empty('accounts transactions transfers budgets goals debts payments rules'),
      };
      try { storage.setItem(key, JSON.stringify({ owner, at: Date.now(), snapshot })); } catch {}
    },
    clear(owner) {
      if (read(owner)) {
        try { storage.removeItem(key); } catch {}
      }
    },
  };
}
