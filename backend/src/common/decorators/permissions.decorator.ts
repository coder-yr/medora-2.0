import { SetMetadata } from '@nestjs/common';
import { HospitalPermission } from '../constants/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: (HospitalPermission | string)[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
