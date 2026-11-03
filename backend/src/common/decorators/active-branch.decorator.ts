import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ActiveBranch = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): bigint | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.activeBranchId ?? (request.user?.branchId ? BigInt(request.user.branchId) : null);
  },
);
