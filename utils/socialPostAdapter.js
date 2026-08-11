/**
 * Translate the EasyGo REST post projection into the shape still consumed by
 * the legacy Post presentation component. This adapter is intentionally kept
 * at the data boundary so the feed can move to the new backend without a
 * risky, all-at-once rewrite of the card UI.
 */

import {
  normalizeSocialAuthor,
  socialAuthorDisplayName,
} from './socialAuthor.mjs';

function toUnixTimestamp(value) {
  const milliseconds = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
}

export function adaptSocialAuthor(author = {}) {
  const safeAuthor = normalizeSocialAuthor(author);
  const id = safeAuthor.id || 'deleted';
  const displayName = socialAuthorDisplayName(safeAuthor);

  return {
    did: `easygo:${id}`,
    profile: {
      username: displayName,
      pfp: safeAuthor.pfp || '',
      description: null,
      data: {
        easygoUserId: safeAuthor.id || null,
        displayName: safeAuthor.displayName || null,
        handle: safeAuthor.username || null,
      },
    },
  };
}

export function adaptSocialProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  if (profile.profile && profile.did) return profile;

  const details = adaptSocialAuthor(profile);
  return {
    ...details,
    id: profile.id || null,
    profile: {
      ...details.profile,
      username: profile.displayName || profile.username || details.profile.username,
      pfp: profile.pfp || '',
      description: profile.bio || null,
      data: {
        ...details.profile.data,
        easygoUserId: profile.id || null,
        walletAddress: profile.walletAddress || null,
        joinedAt: profile.createdAt || null,
      },
    },
    count_posts: Number(profile.counts?.posts) || 0,
    count_followers: Number(profile.counts?.followers) || 0,
    count_following: Number(profile.counts?.following) || 0,
  };
}

export function getEasyGoUserId(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return value.easygo?.authorId
      || value.profile?.data?.easygoUserId
      || value.id
      || getEasyGoUserId(value.did);
  }
  if (typeof value !== 'string') return null;
  return value.startsWith('easygo:') ? value.slice('easygo:'.length) : null;
}

export function adaptSocialPost(row) {
  if (!row || typeof row !== 'object' || !row.id) return null;

  const media = row.mediaUrl ? [{ url: row.mediaUrl }] : [];
  const countLikes = Number(row.counts?.likes) || 0;
  const countReplies = Number(row.counts?.replies) || 0;

  return {
    stream_id: row.id,
    creator: `easygo:${row.author?.id || 'deleted'}`,
    creator_details: adaptSocialAuthor(row.author),
    timestamp: toUnixTimestamp(row.createdAt),
    content: {
      body: row.body || '',
      media,
      mentions: [],
      reply_to: row.parentPostId || null,
      master: row.parentPostId || null,
    },
    count_likes: countLikes,
    count_replies: countReplies,
    count_repost: 0,
    likedByMe: Boolean(row.likedByMe),
    easygo: {
      postId: row.id,
      authorId: row.author?.id || null,
      parentPostId: row.parentPostId || null,
      deleted: Boolean(row.deleted || row.deletedAt),
    },
  };
}

export function adaptSocialPosts(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(adaptSocialPost).filter(Boolean);
}

export default adaptSocialPost;
