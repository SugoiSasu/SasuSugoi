/** Shared signup/reset/change password strength gate - never applied to login,
 * which must keep accepting existing (possibly weaker, pre-this-rule) passwords. */
export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "Hasło musi mieć min. 8 znaków.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Hasło musi zawierać przynajmniej jedną literę i jedną cyfrę.";
  }
  return null;
}
