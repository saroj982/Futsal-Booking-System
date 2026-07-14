import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshteinDistance, calculateSimilarity, isFuzzyMatch } from './fuzzySearch.js';

test('levenshtein distance calculates edit distance correctly', () => {
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
  assert.equal(levenshteinDistance('futsal', 'futsal'), 0);
  assert.equal(levenshteinDistance('futsl', 'futsal'), 1);
});

test('similarity score handles approximate matches', () => {
  assert.ok(calculateSimilarity('futsal', 'futsal') >= 1);
  assert.ok(calculateSimilarity('futsl', 'futsal') >= 0.75);
  assert.ok(calculateSimilarity('futsl', 'futsal') >= 0.7);
});

test('fuzzy matching accepts close spelling variants', () => {
  assert.equal(isFuzzyMatch('futsl', 'Futsal'), true);
  assert.equal(isFuzzyMatch('futsal', 'Blue Futsal Arena'), true);
  assert.equal(isFuzzyMatch('mangal', 'Mangal Futsal'), true);
  assert.equal(isFuzzyMatch('xyz', 'Futsal Arena'), false);
});
