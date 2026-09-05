import { describe, it, expect } from 'vitest';
import {
  detectChapters,
  validateRanges,
  completion,
  schoolToUTC,
  schoolInput,
  csvCell
} from '../src/domain/chapters.mjs';
const body = 'This is substantive research body text. '.repeat(8);
describe('chapter detection', () => {
  it('finds Arabic and Roman chapter headings and stops before references', () => {
    const result = detectChapters(
      [
        'Title',
        'CHAPTER I',
        'Introduction',
        body,
        'CHAPTER 2 — Related literature',
        body,
        'References',
        'Source'
      ].map((text) => ({ text }))
    );
    expect(result.map((c) => [c.position, c.start_block, c.end_block])).toEqual([
      [1, 1, 3],
      [2, 4, 5]
    ]);
  });
  it('ignores contents entries with dotted leaders', () => {
    const result = detectChapters(
      ['Chapter I ...... 1', 'Chapter II ..... 8', 'CHAPTER I', body, 'CHAPTER II', body].map(
        (text) => ({ text })
      )
    );
    expect(result.map((c) => c.start_block)).toEqual([2, 4]);
  });
  it('has no guessed chapters for scanned or unstructured content', () => {
    expect(detectChapters([{ text: '' }])).toEqual([]);
    expect(detectChapters([{ text: body }])).toEqual([]);
  });
  it('rejects reversed, overlapping, and out-of-range selections', () => {
    expect(() => validateRanges([{ start_block: 2, end_block: 1 }], 5)).toThrow();
    expect(() =>
      validateRanges(
        [
          { start_block: 0, end_block: 2 },
          { start_block: 2, end_block: 4 }
        ],
        5
      )
    ).toThrow();
    expect(() => validateRanges([{ start_block: 0, end_block: 5 }], 5)).toThrow();
  });
});
describe('report semantics', () => {
  it('distinguishes absent configuration from completion', () => {
    expect(completion({ required_count: 0, approved_count: 0 })).toBeNull();
    expect(completion({ required_count: 5, approved_count: 2 })).toBe(40);
  });
  it('converts Philippine school times independently of browser timezone', () => {
    expect(schoolToUTC('2026-09-06T00:00')).toBe('2026-09-05T16:00:00.000Z');
    expect(schoolInput('2026-09-05T16:00:00Z')).toBe('2026-09-06T00:00');
  });
  it('escapes report cells and spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
