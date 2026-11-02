import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CashierService } from './cashier.service';
import {
  ApproveShiftDto,
  CashAdjustmentDto,
  CashDrawerDto,
  CashPayoutDto,
  CashierQueryDto,
  DayBookQueryDto,
  OpenShiftDto,
  PatientSettlementDto,
  RejectShiftDto,
  SubmitCloseDto,
} from './dto/cashier.dto';

@ApiTags('Cashier & Treasury')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('cashier')
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  private hasCrossUserPermission(req: any): boolean {
    const user = req.user;
    if (user?.role === 'Admin') return true;
    const permissions: string[] = user?.permissions || [];
    return (
      permissions.includes(HospitalPermission.CASHIER_CLOSE_ALL_USERS) ||
      permissions.includes(HospitalPermission.CASHIER_SHIFT_APPROVE)
    );
  }

  // ===========================================================================
  // 1. SHIFT OPERATIONS
  // ===========================================================================

  @Post('shifts/open')
  @RequirePermissions(HospitalPermission.CASHIER_SHIFT_OPEN)
  @ApiOperation({
    summary: 'Open a new cashier shift',
    description:
      'Opens a cashier shift with optional opening float. Rejects if the cashier already has an active shift.',
  })
  @ApiResponse({ status: 201, description: 'Shift successfully opened.' })
  async openShift(@Body() dto: OpenShiftDto, @Request() req: any) {
    const cashierId = req.user.id;
    return this.cashierService.openShift(cashierId, dto);
  }

  @Get('shifts/active')
  @RequirePermissions(HospitalPermission.CASHIER_VIEW)
  @ApiOperation({
    summary: 'Get currently active shift for the logged-in cashier',
    description:
      'Returns active shift details and live drawer balance, or null if no shift is currently open.',
  })
  @ApiResponse({ status: 200, description: 'Active shift details or null.' })
  async getActiveShift(@Request() req: any) {
    const cashierId = req.user.id;
    return this.cashierService.getActiveShift(cashierId);
  }

  @Get('shifts')
  @RequirePermissions(HospitalPermission.CASHIER_VIEW)
  @ApiOperation({
    summary: 'List cashier shifts',
    description:
      'Lists shifts filtered by status, cashier, branch, and date range. Ordinary cashiers only see their own shifts.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of cashier shifts.' })
  async listShifts(@Query() query: CashierQueryDto, @Request() req: any) {
    const requesterId = req.user.id;
    const hasCrossUser = this.hasCrossUserPermission(req);
    return this.cashierService.listShifts(query, requesterId, hasCrossUser);
  }

  @Get('shifts/:id')
  @RequirePermissions(HospitalPermission.CASHIER_VIEW)
  @ApiOperation({
    summary: 'Get complete shift details and transaction history',
    description: 'Returns shift breakdown, denomination counts, and payment ledger entries.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Detailed shift record.' })
  async getShiftDetails(@Param('id') id: string, @Request() req: any) {
    const requesterId = req.user.id;
    const hasCrossUser = this.hasCrossUserPermission(req);
    return this.cashierService.getShiftDetails(id, requesterId, hasCrossUser);
  }

  @Post('shifts/:id/close')
  @RequirePermissions(HospitalPermission.CASHIER_SHIFT_CLOSE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit physical cash count and initiate shift closure',
    description:
      'Records counted cash, computes variance against ledger, and transitions shift to PENDING_APPROVAL.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Shift submitted for supervisor approval.' })
  async submitClose(
    @Param('id') id: string,
    @Body() dto: SubmitCloseDto,
    @Request() req: any,
  ) {
    const cashierId = req.user.id;
    const hasCrossUser = this.hasCrossUserPermission(req);
    return this.cashierService.submitClose(id, dto, cashierId, hasCrossUser);
  }

  @Post('shifts/:id/approve')
  @RequirePermissions(HospitalPermission.CASHIER_SHIFT_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supervisor dual-control approval of shift closure',
    description:
      'Finalizes shift closure, locks transactions, and creates historical reconciliation entry. Separation of duties enforced.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Shift close approved.' })
  async approveShift(
    @Param('id') id: string,
    @Body() dto: ApproveShiftDto,
    @Request() req: any,
  ) {
    const approverId = req.user.id;
    const hasCrossUser = this.hasCrossUserPermission(req);
    return this.cashierService.approveShift(id, approverId, hasCrossUser, dto);
  }

  @Post('shifts/:id/reject')
  @RequirePermissions(HospitalPermission.CASHIER_SHIFT_REJECT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject shift close request with mandatory explanation',
    description:
      'Returns shift to REJECTED status so the cashier can recount and correct discrepancies.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Shift close rejected.' })
  async rejectShift(
    @Param('id') id: string,
    @Body() dto: RejectShiftDto,
    @Request() req: any,
  ) {
    const approverId = req.user.id;
    return this.cashierService.rejectShift(id, approverId, dto);
  }

  // ===========================================================================
  // 2. CASH PAYOUTS & ADJUSTMENTS
  // ===========================================================================

  @Get('shifts/:id/totals')
  @RequirePermissions(HospitalPermission.CASHIER_VIEW)
  @ApiOperation({
    summary: 'Calculate live expected cash and transaction totals',
    description: 'Aggregates physical cash inflows/outflows and non-cash payment buckets.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Real-time totals calculation.' })
  async getShiftTotals(@Param('id') id: string) {
    return this.cashierService.calculateShiftTotals(id);
  }

  @Post('shifts/:id/payout')
  @RequirePermissions(HospitalPermission.CASHIER_CASH_PAYOUT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record authorized petty cash payout from drawer',
    description: 'Records an audited cash outflow transaction against the active shift.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Payout transaction recorded.' })
  async recordPayout(
    @Param('id') id: string,
    @Body() dto: CashPayoutDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.cashierService.recordPayout(id, dto, userId);
  }

  @Post('shifts/:id/adjust')
  @RequirePermissions(HospitalPermission.CASHIER_CASH_ADJUST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record approved cash float adjustment',
    description: 'Records a manual float top-up or drawer adjustment with required reason.',
  })
  @ApiParam({ name: 'id', description: 'Cashier shift ID' })
  @ApiResponse({ status: 200, description: 'Adjustment transaction recorded.' })
  async recordAdjustment(
    @Param('id') id: string,
    @Body() dto: CashAdjustmentDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.cashierService.recordAdjustment(id, dto, userId);
  }

  // ===========================================================================
  // 3. PATIENT SETTLEMENT & DAY BOOK
  // ===========================================================================

  @Post('settlement/:patientId')
  @RequirePermissions(HospitalPermission.PAYMENT_ADD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Multi-invoice patient final settlement',
    description:
      'Applies collected money across a patient’s open invoices oldest first, with audited write-offs.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Settlement payments applied.' })
  async settlePatient(
    @Param('patientId') patientId: string,
    @Body() dto: PatientSettlementDto,
    @Request() req: any,
  ) {
    const cashierId = req.user?.id;
    return this.cashierService.settlePatientInvoices(patientId, dto, cashierId);
  }

  @Get('day-book')
  @RequirePermissions(HospitalPermission.CASHIER_DAYBOOK_VIEW)
  @ApiOperation({
    summary: 'Financial Day Book report',
    description:
      'Department-wise net billed breakdown by patient group, doctor vs hospital share, and collections by payment mode.',
  })
  @ApiResponse({ status: 200, description: 'Day Book summary or CSV download.' })
  async getDayBook(
    @Query() query: DayBookQueryDto,
    @Response({ passthrough: true }) res: any,
  ) {
    const result = await this.cashierService.getDayBook(query);
    if ('csv' in result) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return result.csv;
    }
    return result;
  }

  // ===========================================================================
  // 4. CASH DRAWERS
  // ===========================================================================

  @Get('drawers')
  @RequirePermissions(HospitalPermission.CASHIER_VIEW)
  @ApiOperation({ summary: 'List physical cash drawers' })
  @ApiResponse({ status: 200, description: 'List of cash drawers.' })
  async listDrawers(@Query('branchId') branchId?: string) {
    return this.cashierService.listDrawers(branchId);
  }

  @Post('drawers')
  @RequirePermissions(HospitalPermission.CASHIER_VIEW)
  @ApiOperation({ summary: 'Create a new cash drawer' })
  @ApiResponse({ status: 201, description: 'Cash drawer created.' })
  async createDrawer(@Body() dto: CashDrawerDto) {
    return this.cashierService.createDrawer(dto);
  }
}
