import type { WebSessionCopy } from './th';

export const webSessionJa: WebSessionCopy = {
  signOutAll: 'すべてのデバイスからログアウト',
  signOutAllTitle: 'すべてのデバイスからログアウトしますか？',
  signOutAllBody: 'このデバイスを含め、すべてのスマートフォンとブラウザでこのアカウントからログアウトします。各デバイスで再度ログインが必要です。',
  signOutAllConfirm: 'すべてのデバイスからログアウト',
  signOutAllFailed: 'すべてのデバイスからログアウトできませんでした。接続を確認してもう一度お試しください。',
  idleTitle: 'まだ操作中ですか？',
  idleBody: '8時間近く操作がありません。{time}後にこのデバイスからログアウトします。',
  idleStay: 'ログインを続ける',
  idleSignOut: 'ログアウト',
  noAccessTitle: 'このアカウントではこのサイトを利用できません',
  noAccessBody: '{email} には NESTYK のこのページを利用する権限がありません。',
  noAccessHint: '別のアカウントでログインするか、お心当たりがない場合はサポートにお問い合わせください。',
  noAccessSignOut: '別のアカウントでログイン',
  noAccessSupport: 'サポートに連絡',
  noAccessHome: 'ホームへ戻る',
  otherSite: '別サイト',
  noAccessOpenRole: '{role}へ移動',
  /** Sign-in redesign (Mos 17 Nov 2026): the note under the sign-in button and its label while Turnstile checks. */
  captchaNote: 'Cloudflare Turnstile でボットから保護されています',
  captchaChecking: '確認中…',
  /** The hidden check gave no token (blocked, error or too slow). */
  captchaFailed: 'ボットでないことを確認できませんでした。もう一度お試しください。',
};
