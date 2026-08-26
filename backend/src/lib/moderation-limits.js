// Admission and fan-out share this hard ceiling. The post-scoped advisory lock
// makes it an invariant for application writes, while the decision path
// independently checks the bound before any transaction can commit.
export const PENDING_REPORTS_PER_POST_MAX = 250;
