const levenshteinDistance = (a = '', b = '') => {
  const left = a.toLowerCase();
  const right = b.toLowerCase();

  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[left.length][right.length];
};

const calculateSimilarity = (input = '', target = '') => {
  if (!input || !target) return 0;

  const maxLength = Math.max(input.length, target.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(input, target);
  return 1 - distance / maxLength;
};

const isFuzzyMatch = (input = '', target = '', threshold = 0.6) => {
  if (!input) return false;

  const normalizedInput = input.trim().toLowerCase();
  const normalizedTarget = target.trim().toLowerCase();

  if (!normalizedTarget) return false;

  if (normalizedTarget.includes(normalizedInput)) return true;

  const similarity = calculateSimilarity(normalizedInput, normalizedTarget);
  return similarity >= threshold;
};

export { levenshteinDistance, calculateSimilarity, isFuzzyMatch };
