import { describe, expect, it, vi } from 'vitest';
import { createCorsOptions } from './cors.js';

describe('createCorsOptions', () => {
  it('allows the configured WEB_URL with credentials', () => {
    const options = createCorsOptions('https://www.crypto-g64.ru');
    const callback = vi.fn();
    options.origin('https://www.crypto-g64.ru', callback);
    expect(options.credentials).toBe(true);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects unknown origins and never uses a wildcard', () => {
    const options = createCorsOptions('https://www.crypto-g64.ru');
    const callback = vi.fn();
    options.origin('https://evil.example', callback);
    const firstCall = callback.mock.calls[0];
    expect(firstCall?.[0]).toBeInstanceOf(Error);
    expect(options.origin).not.toBe('*');
  });
});
