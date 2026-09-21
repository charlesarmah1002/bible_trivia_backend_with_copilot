import { describe, expect, it } from 'vitest';
import { ScoringService } from '../src/modules/games/scoring.js';

const scoring = new ScoringService();

describe('server-authoritative scoring', () => {
  it.each([
    [0, 50],
    [5000, 50],
    [5001, 30],
    [10000, 30],
    [10001, 15],
    [20000, 15],
    [20001, 0],
  ])('applies the speed bracket at %ims', (responseTimeMs, speedBonus) => {
    const result = scoring.calculateAnswerScore('EASY', responseTimeMs, 0, true);
    expect(result).toMatchObject({ basePoints: 100, speedBonus, streakBonus: 0, difficultyMultiplier: 1, totalPoints: 100 + speedBonus });
  });

  it('gives incorrect answers zero points and resets the streak', () => {
    expect(scoring.calculateAnswerScore('HARD', 0, 9, false)).toEqual({
      basePoints: 0,
      speedBonus: 0,
      streakBonus: 0,
      difficultyMultiplier: 2,
      totalPoints: 0,
      nextStreak: 0,
    });
  });

  it.each([
    [2, 50],
    [4, 100],
    [9, 250],
    [10, 0],
  ])('applies a streak bonus when the next streak reaches %i', (currentStreak, streakBonus) => {
    const result = scoring.calculateAnswerScore('EASY', 20001, currentStreak, true);
    expect(result).toMatchObject({ streakBonus, nextStreak: currentStreak + 1, totalPoints: 100 + streakBonus });
  });

  it('applies easy, medium, and hard multipliers to the same subtotal', () => {
    expect(scoring.calculateAnswerScore('EASY', 6000, 0, true).totalPoints).toBe(130);
    expect(scoring.calculateAnswerScore('MEDIUM', 6000, 0, true).totalPoints).toBe(195);
    expect(scoring.calculateAnswerScore('HARD', 11000, 0, true).totalPoints).toBe(230);
  });

  it('rounds the final multiplied total consistently', () => {
    const result = scoring.calculateAnswerScore('MEDIUM', 20001, 2, true);
    expect(result).toMatchObject({ basePoints: 100, speedBonus: 0, streakBonus: 50, difficultyMultiplier: 1.5, totalPoints: 225 });
  });

  it('keeps cumulative scoring independent of client-provided values', () => {
    const answers = [
      scoring.calculateAnswerScore('EASY', 0, 0, true),
      scoring.calculateAnswerScore('MEDIUM', 6000, 1, true),
      scoring.calculateAnswerScore('HARD', 21000, 2, true),
      scoring.calculateAnswerScore('HARD', 0, 3, false),
    ];

    expect(answers.reduce((total, answer) => total + answer.totalPoints, 0)).toBe(150 + 195 + 300);
    expect(answers[3].nextStreak).toBe(0);
  });
});
