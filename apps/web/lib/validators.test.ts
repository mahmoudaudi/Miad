import { describe, expect, it } from 'vitest';
import { isValidEmail, passwordIssues, validateRegister } from '@/lib/validators';

describe('auth validators', () => {
  it('validates emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });

  it('requires 10+ char passwords', () => {
    expect(passwordIssues('short')).toHaveLength(1);
    expect(passwordIssues('long-enough-pw')).toHaveLength(0);
  });

  it('validates the register form', () => {
    expect(
      Object.keys(
        validateRegister({
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.co',
          password: 'long-enough-pw',
        })
      )
    ).toHaveLength(0);
    const errors = validateRegister({ firstName: '', lastName: '', email: 'x', password: 's' });
    expect(errors.firstName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it('rejects whitespace-only and overlong names', () => {
    const whitespace = validateRegister({
      firstName: '   ',
      lastName: '\t',
      email: 'a@b.co',
      password: 'long-enough-pw',
    });
    expect(whitespace.firstName).toBe('First name is required.');
    expect(whitespace.lastName).toBe('Last name is required.');

    const overlong = validateRegister({
      firstName: 'a'.repeat(101),
      lastName: 'B',
      email: 'a@b.co',
      password: 'long-enough-pw',
    });
    expect(overlong.firstName).toContain('at most 100');
  });
});
