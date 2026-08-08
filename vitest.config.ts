import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the pure logic is unit-tested. Component rendering would need
    // jest-expo and a native mock layer; nothing here requires it.
    include: ['lib/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
