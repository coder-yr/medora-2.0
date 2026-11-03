import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_BRANCH_KEY = 'optionalBranch';

/**
 * Indicates that operational branch context is optional for this route (e.g. global master catalog read)
 */
export const OptionalBranch = () => SetMetadata(OPTIONAL_BRANCH_KEY, true);
