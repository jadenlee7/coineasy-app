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
