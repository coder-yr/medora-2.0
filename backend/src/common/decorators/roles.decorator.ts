import { SetMetadata } from '@nestjs/common';
import { HospitalRole } from '../types/auth-user.interface';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: HospitalRole[]) => SetMetadata(ROLES_KEY, roles);
