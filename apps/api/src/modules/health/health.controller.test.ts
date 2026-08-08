import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the public health contract', () => {
    const controller = new HealthController();

    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
