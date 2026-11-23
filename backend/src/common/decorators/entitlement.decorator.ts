import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ENTITLEMENT_KEY = 'require_entitlement';
export const RequireEntitlement = (moduleKey: string) =>
  SetMetadata(REQUIRE_ENTITLEMENT_KEY, moduleKey);
