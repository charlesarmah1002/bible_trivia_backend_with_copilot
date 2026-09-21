export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type ScoreBreakdown = {
  basePoints: number;
  speedBonus: number;
  streakBonus: number;
  difficultyMultiplier: number;
  totalPoints: number;
  nextStreak: number;
};

export class ScoringService {
  calculateAnswerScore(
    difficulty: Difficulty,
    responseTimeMs: number,
    currentStreak: number,
    isCorrect: boolean,
  ): ScoreBreakdown {
    const nextStreak = isCorrect ? currentStreak + 1 : 0;
    const basePoints = isCorrect ? 100 : 0;
    const speedBonus = isCorrect ? this.getSpeedBonus(responseTimeMs) : 0;
    const streakBonus = isCorrect ? this.getStreakBonus(nextStreak) : 0;
    const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
    const totalPoints = Math.round((basePoints + speedBonus + streakBonus) * difficultyMultiplier);

    return {
      basePoints,
      speedBonus,
      streakBonus,
      difficultyMultiplier,
      totalPoints,
      nextStreak,
    };
  }

  private getSpeedBonus(responseTimeMs: number): number {
    if (responseTimeMs <= 5000) return 50;
    if (responseTimeMs <= 10000) return 30;
    if (responseTimeMs <= 20000) return 15;
    return 0;
  }

  private getStreakBonus(streak: number): number {
    if (streak === 10) return 250;
    if (streak === 5) return 100;
    if (streak === 3) return 50;
    return 0;
  }

  private getDifficultyMultiplier(difficulty: Difficulty): number {
    if (difficulty === 'HARD') return 2;
    if (difficulty === 'MEDIUM') return 1.5;
    return 1;
  }
}
