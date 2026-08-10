export const OAUTH_LOGIN_CANCELLED_CODE = 'login_with_oauth_was_cancelled_by_user';
export const GENERIC_OAUTH_LOGIN_ERROR_MESSAGE =
  '로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';

export function getOAuthLoginErrorMessage(error) {
  if (error?.code === OAUTH_LOGIN_CANCELLED_CODE) return null;
  return GENERIC_OAUTH_LOGIN_ERROR_MESSAGE;
}
