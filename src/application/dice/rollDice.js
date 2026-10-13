import { randomInt } from 'node:crypto';
import { ApplicationError } from '../errors/ApplicationError.js';

export function rollDice(input) {
  const match = /^(\d{1,3})d(\d{1,7})$/.exec(input);
  if (!match) throw new ApplicationError('DICE_FORMAT');
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || count > 100 || sides < 1 || sides > 1_000_000) {
    throw new ApplicationError('DICE_LIMITS');
  }
  const results = Array.from({ length: count }, () => randomInt(1, sides + 1));
  return { count, sides, results, total: results.reduce((sum, value) => sum + value, 0) };
}
