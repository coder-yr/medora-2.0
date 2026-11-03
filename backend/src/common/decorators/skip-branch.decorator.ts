import { SetMetadata } from '@nestjs/common';

export const SKIP_BRANCH_KEY = 'skipBranch';

/**
 * Bypasses branch access guard entirely for non-operational endpoints (e.g. user profile, accessible branches list)
 */
export const SkipBranchCheck = () => SetMetadata(SKIP_BRANCH_KEY, true);
