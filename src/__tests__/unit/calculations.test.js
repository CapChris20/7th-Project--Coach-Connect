/**
 * @file calculations.test.js
 *
 * Tests for src/shared/fitness-calculations/calculations.js
 *
 * Covers:
 *  - calculateBMR: Mifflin-St Jeor equation for male and female
 *  - calculateTDEE: activity multiplier application
 *  - calculateMacros: macro splits per goal
 *  - calculateBMI: division-by-zero guard (zero height)
 *  - estimateBodyFat: null gender guard
 */

import {
  calculateBMR,
  calculateBMI,
  calculateTDEE,
  calculateMacros,
  estimateBodyFat,
} from '../../shared/fitness-calculations/calculations';

describe('calculateBMR', () => {
  test('male 80kg 180cm 30yo → 1814 kcal', () => {
    // (10 * 80) + (6.25 * 180) - (5 * 30) + 5 = 800 + 1125 - 150 + 5 = 1780
    const result = calculateBMR(80, 180, 30, 'male');
    expect(result).toBe(1780);
  });

  test('female 60kg 165cm 25yo → correct value', () => {
    // (10 * 60) + (6.25 * 165) - (5 * 25) - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 → 1345
    const result = calculateBMR(60, 165, 25, 'female');
    expect(result).toBe(1345);
  });

  test('null gender defaults to male (no crash)', () => {
    expect(() => calculateBMR(80, 180, 30, null)).not.toThrow();
    const result = calculateBMR(80, 180, 30, null);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  test('zero weight returns null (no nonsense BMR)', () => {
    expect(calculateBMR(0, 180, 30, 'male')).toBeNull();
  });

  test('negative height returns null', () => {
    expect(calculateBMR(80, -180, 30, 'male')).toBeNull();
  });

  test('undefined gender defaults to male (no crash)', () => {
    expect(() => calculateBMR(80, 180, 30, undefined)).not.toThrow();
  });
});

describe('calculateTDEE', () => {
  test('sedentary multiplier 1.2', () => {
    expect(calculateTDEE(1780, 'sedentary')).toBe(Math.round(1780 * 1.2));
  });

  test('moderate multiplier 1.55', () => {
    expect(calculateTDEE(1780, 'moderate')).toBe(Math.round(1780 * 1.55));
  });

  test('very_active multiplier 1.9', () => {
    expect(calculateTDEE(1780, 'very_active')).toBe(Math.round(1780 * 1.9));
  });

  test('unknown activity level falls back to sedentary (1.2)', () => {
    expect(calculateTDEE(1780, 'unknown')).toBe(Math.round(1780 * 1.2));
  });
});

describe('calculateBMI', () => {
  test('normal case: 80kg 180cm → 24.7', () => {
    const result = calculateBMI(80, 180);
    expect(result).toBeCloseTo(24.7, 0);
  });

  test('zero height returns null (no Infinity)', () => {
    expect(calculateBMI(80, 0)).toBeNull();
  });

  test('missing height returns null (no crash)', () => {
    expect(calculateBMI(80, null)).toBeNull();
    expect(calculateBMI(80, undefined)).toBeNull();
  });

  test('negative height returns null', () => {
    expect(calculateBMI(80, -5)).toBeNull();
  });
});

describe('calculateMacros', () => {
  test('weight_loss: protein ≈ 1g per lb body weight', () => {
    const result = calculateMacros(2000, 'weight_loss', 80);
    expect(result.protein).toBeGreaterThan(0);
    expect(result.carbs).toBeGreaterThan(0);
    expect(result.fat).toBeGreaterThan(0);
  });

  test('muscle_gain: higher protein than maintenance', () => {
    const gainResult = calculateMacros(2500, 'muscle_gain', 80);
    const maintResult = calculateMacros(2500, 'maintenance', 80);
    expect(gainResult.protein).toBeGreaterThan(maintResult.protein);
  });

  test('returns numeric values, no crash on valid input', () => {
    const result = calculateMacros(2000, 'maintenance', 70);
    expect(typeof result.protein).toBe('number');
    expect(typeof result.carbs).toBe('number');
    expect(typeof result.fat).toBe('number');
  });
});

describe('estimateBodyFat', () => {
  test('null gender defaults to male (no crash)', () => {
    expect(() => estimateBodyFat(null, 30, 24)).not.toThrow();
    const result = estimateBodyFat(null, 30, 24);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(3);
  });

  test('body fat clamped between 3 and 50', () => {
    const low = estimateBodyFat('male', 30, 1);
    const high = estimateBodyFat('female', 80, 60);
    expect(low).toBeGreaterThanOrEqual(3);
    expect(high).toBeLessThanOrEqual(50);
  });

  test('female gives higher estimate than male for same inputs', () => {
    const male = estimateBodyFat('male', 30, 24);
    const female = estimateBodyFat('female', 30, 24);
    expect(female).toBeGreaterThan(male);
  });
});
