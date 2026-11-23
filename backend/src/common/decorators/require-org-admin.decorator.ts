import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ORG_ADMIN_KEY = 'require_org_admin';
export const RequireOrgAdmin = () => SetMetadata(REQUIRE_ORG_ADMIN_KEY, true);
