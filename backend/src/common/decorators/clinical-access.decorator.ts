import { SetMetadata } from '@nestjs/common';

export const PROTECT_CLINICAL_ACCESS_KEY = 'protect_clinical_access';
export const ProtectClinicalAccess = () => SetMetadata(PROTECT_CLINICAL_ACCESS_KEY, true);
