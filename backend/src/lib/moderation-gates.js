// Source-level brake for the protected post moderation surface.
//
// Keep this false until a named moderation owner, workforce identity/RBAC,
// retention policy, escalation route, staging migration, and device QA are all
// approved. The deploy preflight also refuses runtime activation while this is
// false, and PHASE masks the route even if an environment flag is set directly.
export const POST_MODERATION_READY = false;
