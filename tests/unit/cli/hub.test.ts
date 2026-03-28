import { describe, it, expect } from 'vitest';
import { getAvailableActions, HUB_ACTIONS } from '../../../src/cli/hub.js';

describe('Command Center hub', () => {
  describe('HUB_ACTIONS', () => {
    it('covers all CLI commands', () => {
      // 18 CLI commands minus `codi` itself = every command has a hub action
      expect(HUB_ACTIONS.length).toBeGreaterThanOrEqual(17);
    });

    it('every action has required fields', () => {
      for (const action of HUB_ACTIONS) {
        expect(action.value).toBeTruthy();
        expect(action.label).toBeTruthy();
        expect(action.hint).toBeTruthy();
        expect(typeof action.requiresProject).toBe('boolean');
        expect(['setup', 'build', 'monitor']).toContain(action.group);
      }
    });

    it('has unique action values', () => {
      const values = HUB_ACTIONS.map(a => a.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it('init does not require a project', () => {
      const init = HUB_ACTIONS.find(a => a.value === 'init');
      expect(init).toBeDefined();
      expect(init!.requiresProject).toBe(false);
    });

    it('generate requires a project', () => {
      const gen = HUB_ACTIONS.find(a => a.value === 'generate');
      expect(gen).toBeDefined();
      expect(gen!.requiresProject).toBe(true);
    });
  });

  describe('getAvailableActions', () => {
    it('returns all actions when project exists', () => {
      const actions = getAvailableActions(true);
      expect(actions).toEqual(HUB_ACTIONS);
    });

    it('filters project-dependent actions when no project exists', () => {
      const actions = getAvailableActions(false);
      expect(actions.length).toBeLessThan(HUB_ACTIONS.length);
      expect(actions.every(a => !a.requiresProject)).toBe(true);
    });

    it('always includes init when no project exists', () => {
      const actions = getAvailableActions(false);
      expect(actions.find(a => a.value === 'init')).toBeDefined();
    });

    it('does not include generate when no project exists', () => {
      const actions = getAvailableActions(false);
      expect(actions.find(a => a.value === 'generate')).toBeUndefined();
    });

    it('does not include status when no project exists', () => {
      const actions = getAvailableActions(false);
      expect(actions.find(a => a.value === 'status')).toBeUndefined();
    });
  });

  describe('action groups', () => {
    it('has setup actions', () => {
      const setup = HUB_ACTIONS.filter(a => a.group === 'setup');
      expect(setup.length).toBeGreaterThanOrEqual(3);
    });

    it('has build actions', () => {
      const build = HUB_ACTIONS.filter(a => a.group === 'build');
      expect(build.length).toBeGreaterThanOrEqual(2);
    });

    it('has monitor actions', () => {
      const monitor = HUB_ACTIONS.filter(a => a.group === 'monitor');
      expect(monitor.length).toBeGreaterThanOrEqual(3);
    });
  });
});
