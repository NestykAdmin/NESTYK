/** Signup and password-change rule: at least 8 characters, with a digit, a lowercase letter and an uppercase letter. */
export function passwordIsStrong(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}
