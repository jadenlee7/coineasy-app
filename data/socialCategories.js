export const SOCIAL_CATEGORIES = [
  { id: 'easygo', tag: '#EASYGO', title: 'EASYGO', accent: '#FF6B17' },
  { id: 'easydao', tag: '#EASYDAO', title: 'EASYDAO', accent: '#0F172A' },
  { id: 'insight', tag: '#INSIGHT', title: 'INSIGHT', accent: '#334155' },
  { id: 'daily', tag: '#DAILY', title: 'DAILY', accent: '#F97316' },
  { id: 'food', tag: '#FOOD', title: 'FOOD', accent: '#EA580C' },
  { id: 'travel', tag: '#TRAVEL', title: 'TRAVEL', accent: '#1E293B' },
  { id: 'news', tag: '#NEWS', title: 'NEWS', accent: '#111827' },
  { id: 'learn', tag: '#LEARN', title: 'LEARN', accent: '#FB923C' },
  { id: 'builder', tag: '#BUILDER', title: 'BUILDER', accent: '#475569' },
].map((category) => ({
  ...category,
  stream_id: category.id,
  content: {
    displayName: category.tag,
    imageUrl: null,
  },
}));

export function getSocialCategory(value) {
  if (!value) return null;
  const candidate = value.tag || value.content?.displayName || value.id || value;
  const normalized = String(candidate).replace(/^#/, '').toLowerCase();
  return SOCIAL_CATEGORIES.find((category) =>
    category.id === normalized || category.title.toLowerCase() === normalized
  ) || null;
}

export default SOCIAL_CATEGORIES;
