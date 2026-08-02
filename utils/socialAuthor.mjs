export function normalizeSocialAuthor(author) {
  return author && typeof author === 'object' && !Array.isArray(author) ? author : {};
}

export default normalizeSocialAuthor;
