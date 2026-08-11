export function normalizeSocialAuthor(author) {
  return author && typeof author === 'object' && !Array.isArray(author) ? author : {};
}

export const ACTIVE_SOCIAL_AUTHOR_LABEL = 'EasyGo user';
export const DELETED_SOCIAL_AUTHOR_LABEL = 'Deleted account';

export function socialAuthorDisplayName(author) {
  const safeAuthor = normalizeSocialAuthor(author);
  const displayName = typeof safeAuthor.displayName === 'string'
    ? safeAuthor.displayName.trim()
    : '';
  const username = typeof safeAuthor.username === 'string'
    ? safeAuthor.username.trim()
    : '';

  if (displayName) return displayName;
  if (username) return username;
  return safeAuthor.id ? ACTIVE_SOCIAL_AUTHOR_LABEL : DELETED_SOCIAL_AUTHOR_LABEL;
}

export default normalizeSocialAuthor;
