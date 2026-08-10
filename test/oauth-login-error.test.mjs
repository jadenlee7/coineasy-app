import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERIC_OAUTH_LOGIN_ERROR_MESSAGE,
  getOAuthLoginErrorMessage,
} from '../utils/oauthLoginError.mjs';

test('user-cancelled Privy OAuth exits without a visible error', () => {
  assert.equal(getOAuthLoginErrorMessage({
    code: 'login_with_oauth_was_cancelled_by_user',
  }), null);
});

test('genuine OAuth failures use a PII-free generic message', () => {
  const message = getOAuthLoginErrorMessage({
    code: 'failed_to_complete_login_with_oauth',
    message: 'user@example.com token=secret-value',
  });

  assert.equal(message, GENERIC_OAUTH_LOGIN_ERROR_MESSAGE);
  assert.equal(message.includes('user@example.com'), false);
  assert.equal(message.includes('secret-value'), false);
});

test('unknown OAuth failures also use the generic message', () => {
  assert.equal(
    getOAuthLoginErrorMessage(new Error('provider returned an unknown response')),
    GENERIC_OAUTH_LOGIN_ERROR_MESSAGE,
  );
});
