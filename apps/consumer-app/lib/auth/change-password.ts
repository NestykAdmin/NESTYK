import { passwordIsStrong } from './password-rules';

export const WRONG_PASSWORD = 'WRONG_PASSWORD';
export const WEAK_PASSWORD = 'WEAK_PASSWORD';

type PasswordClient = {
  auth: {
    signInWithPassword(args: { email: string; password: string; options?: { captchaToken?: string } }): Promise<{ error: { message: string; code?: string } | null }>;
    updateUser(args: { password: string }): Promise<{ error: { message: string } | null }>;
    signOut(args: { scope: 'others' }): Promise<unknown>;
  };
};

/** Checks the current password by signing in again. A wrong password changes nothing. */
export async function confirmCurrentPassword(
  client: PasswordClient,
  email: string,
  currentPassword: string,
  captchaToken?: string,
): Promise<void> {
  const signedIn = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: currentPassword,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  });
  if (signedIn.error) {
    throw Object.assign(new Error(signedIn.error.message), {
      code: signedIn.error.code === 'invalid_credentials' ? WRONG_PASSWORD : signedIn.error.code,
    });
  }
}

/** Confirms the current password, then stores the new one. A wrong current password changes nothing. */
export async function changePassword(
  client: PasswordClient,
  email: string,
  currentPassword: string,
  newPassword: string,
  captchaToken?: string,
): Promise<void> {
  if (!passwordIsStrong(newPassword)) {
    throw Object.assign(new Error('Password is too weak'), { code: WEAK_PASSWORD });
  }
  await confirmCurrentPassword(client, email, currentPassword, captchaToken);
  const updated = await client.auth.updateUser({ password: newPassword });
  if (updated.error) throw new Error(updated.error.message);
  await client.auth.signOut({ scope: 'others' }).catch(() => undefined);
}
