import { describe, it, expect } from 'vitest';
import { satisfiesVersion } from '../../../src/utils/semver.js';

describe('satisfiesVersion', () => {
  it('matches exact versions', () => {
    expect(satisfiesVersion('1.0.0', '1.0.0')).toBe(true);
    expect(satisfiesVersion('2.3.4', '2.3.4')).toBe(true);
  });

  it('rejects different exact versions', () => {
    expect(satisfiesVersion('1.0.0', '1.0.1')).toBe(false);
    expect(satisfiesVersion('1.0.0', '2.0.0')).toBe(false);
  });

  it('handles >= comparisons', () => {
    expect(satisfiesVersion('1.0.0', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('1.0.1', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('2.0.0', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('0.9.9', '>=1.0.0')).toBe(false);
  });

  it('handles >= with spaces', () => {
    expect(satisfiesVersion('1.0.0', '>= 1.0.0')).toBe(true);
  });

  it('handles v prefix in current version', () => {
    expect(satisfiesVersion('v1.0.0', '1.0.0')).toBe(true);
    expect(satisfiesVersion('v2.0.0', '>=1.0.0')).toBe(true);
  });

  it('returns false for invalid versions', () => {
    expect(satisfiesVersion('not-a-version', '1.0.0')).toBe(false);
    expect(satisfiesVersion('1.0.0', 'not-valid')).toBe(false);
  });

  it('compares major versions correctly', () => {
    expect(satisfiesVersion('2.0.0', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('1.0.0', '>=2.0.0')).toBe(false);
  });

  it('compares minor versions correctly', () => {
    expect(satisfiesVersion('1.1.0', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('1.0.0', '>=1.1.0')).toBe(false);
  });

  it('compares patch versions correctly', () => {
    expect(satisfiesVersion('1.0.1', '>=1.0.0')).toBe(true);
    expect(satisfiesVersion('1.0.0', '>=1.0.1')).toBe(false);
  });
});
