/** Client-side form validators (backend re-validates everything). */
import { getDictionary } from './i18n/dictionaries';
import { defaultLocale, type Locale } from './i18n/locales';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function passwordIssues(password: string, locale: Locale = defaultLocale): string[] {
  const t = getDictionary(locale).auth.validation;
  const issues: string[] = [];
  if (password.length < 10) issues.push(t.passwordTooShort);
  if (password.length > 128) issues.push(t.passwordTooLong);
  return issues;
}

export type RegisterErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

export function validateRegister(
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  },
  locale: Locale = defaultLocale
): RegisterErrors {
  const t = getDictionary(locale).auth.validation;
  const errors: RegisterErrors = {};
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();
  if (!firstName) errors.firstName = t.firstNameRequired;
  else if (firstName.length > 100) errors.firstName = t.firstNameTooLong;
  if (!lastName) errors.lastName = t.lastNameRequired;
  else if (lastName.length > 100) errors.lastName = t.lastNameTooLong;
  if (!isValidEmail(email)) errors.email = t.validEmail;
  else if (email.length > 255) errors.email = t.emailTooLong;
  const pw = passwordIssues(input.password, locale);
  if (pw.length > 0) errors.password = pw[0];
  return errors;
}
