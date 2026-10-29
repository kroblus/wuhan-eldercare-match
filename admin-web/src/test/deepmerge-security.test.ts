import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { expect, it } from 'vitest';
import type deepmerge from '../../vendor/deepmerge';

// Resolve from the actual consumer, so a broken override cannot pass these tests.
const mobileRequire = createRequire(resolve('node_modules/antd-mobile/package.json'));
const merge: typeof deepmerge = mobileRequire('deepmerge');

it('Ant Mobile resolves the reviewed local patch after npm ci', () => {
  expect(realpathSync(mobileRequire.resolve('deepmerge'))).toBe(
    realpathSync(resolve('vendor/deepmerge/index.cjs')),
  );
});

it.each(['__proto__', 'constructor', 'prototype'])(
  'blocks %s on both inputs and nested copies',
  (key) => {
    const hostile = JSON.parse(`{"${key}":{"polluted":"yes"},"safe":1}`);
    for (const [target, source] of [
      [hostile, {}],
      [{}, hostile],
      [Object.create(null), hostile],
    ]) {
      const result = merge<Record<string, unknown>>(target, source);
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.hasOwn(result, key)).toBe(false);
      expect(result.polluted).toBeUndefined();
      expect(result.safe).toBe(1);
    }
    const nested = merge({ branch: hostile }, { list: [hostile] });
    expect(Object.hasOwn(nested.branch, key)).toBe(false);
    expect(Object.hasOwn(nested.list[0], key)).toBe(false);
    expect(Object.getPrototypeOf(nested.branch)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(nested.list[0])).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  },
);

it('preserves nested validation messages, array concatenation and immutable copies', () => {
  const base = { required: '必填', types: { number: '数字' }, list: [{ a: 1 }] };
  const custom = { types: { string: '文字' }, list: [{ b: 2 }] };
  const result = merge(base, custom);
  expect(result).toEqual({
    required: '必填',
    types: { number: '数字', string: '文字' },
    list: [{ a: 1 }, { b: 2 }],
  });
  expect(result.list[0]).not.toBe(base.list[0]);
  expect(base.types).toEqual({ number: '数字' });
  expect(custom.list).toEqual([{ b: 2 }]);
});

it('preserves symbols, special objects, custom merging and the all entry point', () => {
  const symbol = Symbol('label');
  const date = new Date('2026-10-29T00:00:00Z');
  const pattern = /label/;
  const element = createElement('span', null, '提示');
  const result = merge({}, { [symbol]: 'label', date, pattern, element });
  expect(result[symbol]).toBe('label');
  expect(result.date).toBe(date);
  expect(result.pattern).toBe(pattern);
  expect(result.element).toBe(element);
  expect(merge({ list: [1] }, { list: [2] }, { arrayMerge: (_a, b) => b })).toEqual({ list: [2] });
  expect(
    merge({ label: { a: 1 } }, { label: { b: 2 } }, { customMerge: () => () => 'custom' }),
  ).toEqual({ label: 'custom' });
  expect(merge.all([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 });
});
