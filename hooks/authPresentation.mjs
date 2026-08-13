function finiteOrangeBalance(value) {
  if (value === null || value === undefined || value === '') return null;
  const balance = Number(value);
  return Number.isFinite(balance) ? balance : null;
}

export function profilePresentationData(profile, {
  courseProgressOwner,
  localCourses = [],
} = {}) {
  const profileData = profile?.data && typeof profile.data === 'object'
    ? { ...profile.data }
    : {};
  const orangeBalance = finiteOrangeBalance(profile?.orangeBalance);

  if (Array.isArray(localCourses) && localCourses.length > 0) {
    profileData.courses = localCourses;
  }
  if (orangeBalance !== null) {
    // The ledger-backed value from /auth/sync wins over any legacy cached
    // number in profile.data and is available to HeaderActions immediately.
    profileData.numberOranges = orangeBalance;
  }

  return {
    ...profileData,
    courseProgressOwner,
    easygoUserId: profile?.id,
    walletAddress: profile?.walletAddress || null,
  };
}

export function fallbackPresentationData({ courseProgressOwner, localCourses = [] } = {}) {
  return {
    ...(Array.isArray(localCourses) && localCourses.length > 0
      ? { courses: localCourses }
      : {}),
    courseProgressOwner,
  };
}

export function mergeOwnProfilePresentation(current, incoming) {
  if (!incoming || typeof incoming !== 'object') return current;

  const currentProfileData = current?.profile?.data && typeof current.profile.data === 'object'
    ? current.profile.data
    : {};
  const incomingProfileData = incoming?.profile?.data && typeof incoming.profile.data === 'object'
    ? incoming.profile.data
    : {};
  const incomingWalletAddress = typeof incomingProfileData.walletAddress === 'string'
    && incomingProfileData.walletAddress.trim()
    ? incomingProfileData.walletAddress
    : null;
  const currentWalletAddress = typeof currentProfileData.walletAddress === 'string'
    && currentProfileData.walletAddress.trim()
    ? currentProfileData.walletAddress
    : null;
  const currentDid = typeof current?.did === 'string' ? current.did : null;
  const incomingDid = typeof incoming.did === 'string' ? incoming.did : null;
  const nextDid = incomingDid?.startsWith('easygo:') && currentDid
    ? currentDid
    : incomingDid || currentDid;

  return {
    ...current,
    id: incoming.id || current?.id,
    // The public adapter uses easygo:<id> for presentation. Keep the current
    // authenticated Privy DID when refreshing the signed-in user's profile.
    did: nextDid,
    profile: {
      ...current?.profile,
      ...incoming.profile,
      data: {
        ...currentProfileData,
        ...incomingProfileData,
        // Public profile responses intentionally omit the private wallet address.
        // Do not let their adapted null value erase the address hydrated by /auth/sync.
        walletAddress: incomingWalletAddress || currentWalletAddress || null,
      },
    },
  };
}
