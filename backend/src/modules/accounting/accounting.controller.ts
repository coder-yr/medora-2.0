import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Request,
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
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';
import { AccountingService } from './accounting.service';
import {
  AccountQueryDto,
  CloseAccountingPeriodDto,
  CreateAccountingPeriodDto,
  CreateAccountDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateJournalEntryDto,
  CreateLegacyAccountingDto,
  CreateLegacySectorDto,
  ExpenseQueryDto,
  JournalQueryDto,
  PayExpenseDto,
  PeriodQueryDto,
  RejectExpenseDto,
  ReopenAccountingPeriodDto,
  ReportQueryDto,
  ReverseJournalEntryDto,
  UpdateAccountDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseDto,
} from './dto/accounting.dto';

@ApiTags('Accounting & General Ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    @Optional() private readonly branchAuth?: BranchAuthorizationService,
  ) {}

  // ==========================================
  // DASHBOARD METRICS
  // ==========================================

  @ApiOperation({ summary: 'Get general accounting dashboard overview metrics' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics returned.' })
  @Get('dashboard')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async getDashboard() {
    return this.accountingService.getDashboardMetrics();
  }

  // ==========================================
  // CHART OF ACCOUNTS (COA)
  // ==========================================

  @ApiOperation({ summary: 'List Chart of Accounts with pagination and filters' })
  @Get('accounts')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async listAccounts(@Query() query: AccountQueryDto) {
    return this.accountingService.listAccounts(query);
  }

  @ApiOperation({ summary: 'Get hierarchical tree of active accounts' })
  @Get('accounts/tree')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async getAccountTree() {
    return this.accountingService.getAccountTree();
  }

  @ApiOperation({ summary: 'Get account details by ID' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @Get('accounts/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async getAccountById(@Param('id') id: string) {
    return this.accountingService.getAccountById(BigInt(id));
  }

  @ApiOperation({ summary: 'Create new account in Chart of Accounts' })
  @Post('accounts')
  @RequirePermissions(HospitalPermission.ACCOUNTING_MANAGE_ACCOUNTS)
  async createAccount(@Body() dto: CreateAccountDto, @Request() req: any) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.createAccount(dto, userId);
  }

  @ApiOperation({ summary: 'Update existing account in Chart of Accounts' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @Put('accounts/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_MANAGE_ACCOUNTS)
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountingService.updateAccount(BigInt(id), dto);
  }

  @ApiOperation({ summary: 'Delete or deactivate account' })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @Delete('accounts/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_MANAGE_ACCOUNTS)
  async deleteAccount(@Param('id') id: string) {
    return this.accountingService.deleteAccount(BigInt(id));
  }

  // ==========================================
  // ACCOUNTING PERIODS
  // ==========================================

  @ApiOperation({ summary: 'List accounting periods' })
  @Get('periods')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async listPeriods(@Query() query: PeriodQueryDto) {
    return this.accountingService.listPeriods(query);
  }

  @ApiOperation({ summary: 'Get current open accounting period' })
  @Get('periods/current')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async getCurrentPeriod() {
    return this.accountingService.getCurrentOpenPeriod();
  }

  @ApiOperation({ summary: 'Create a new accounting period' })
  @Post('periods')
  @RequirePermissions(HospitalPermission.ACCOUNTING_PERIOD_MANAGE)
  async createPeriod(@Body() dto: CreateAccountingPeriodDto) {
    return this.accountingService.createPeriod(dto);
  }

  @ApiOperation({ summary: 'Close and lock an accounting period' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @Post('periods/:id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_PERIOD_CLOSE)
  async closePeriod(
    @Param('id') id: string,
    @Body() dto: CloseAccountingPeriodDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.closePeriod(BigInt(id), dto, userId);
  }

  @ApiOperation({ summary: 'Reopen a previously closed accounting period' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @Post('periods/:id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_PERIOD_REOPEN)
  async reopenPeriod(
    @Param('id') id: string,
    @Body() dto: ReopenAccountingPeriodDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.reopenPeriod(BigInt(id), dto, userId);
  }

  // ==========================================
  // JOURNAL ENTRIES
  // ==========================================

  @ApiOperation({ summary: 'List double-entry journal entries' })
  @Get('journals')
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_VIEW)
  async listJournals(@Query() query: JournalQueryDto) {
    return this.accountingService.listJournals(query);
  }

  @ApiOperation({ summary: 'Get journal entry details by ID' })
  @ApiParam({ name: 'id', description: 'Journal Entry ID' })
  @Get('journals/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_VIEW)
  async getJournalById(@Param('id') id: string) {
    return this.accountingService.getJournalById(BigInt(id));
  }

  @ApiOperation({ summary: 'Draft or post a double-entry journal entry' })
  @Post('journals')
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_CREATE)
  async createJournal(
    @Body() dto: CreateJournalEntryDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.createJournal(dto, userId);
  }

  @ApiOperation({ summary: 'Post an existing draft journal entry' })
  @ApiParam({ name: 'id', description: 'Journal Entry ID' })
  @Post('journals/:id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_POST)
  async postJournal(@Param('id') id: string, @Request() req: any) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.postJournal(BigInt(id), userId);
  }

  @ApiOperation({ summary: 'Create signed mirror-image reversal of a posted journal entry' })
  @ApiParam({ name: 'id', description: 'Original Journal Entry ID to reverse' })
  @Post('journals/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_REVERSE)
  async reverseJournal(
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.reverseJournal(BigInt(id), dto, userId);
  }

  @ApiOperation({ summary: 'Delete a draft journal entry (immutable once posted)' })
  @ApiParam({ name: 'id', description: 'Draft Journal Entry ID' })
  @Delete('journals/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_CREATE)
  async deleteDraftJournal(@Param('id') id: string, @Request() req: any) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.deleteDraftJournal(BigInt(id), userId);
  }

  // ==========================================
  // EXPENSE CATEGORIES
  // ==========================================

  @ApiOperation({ summary: 'List active expense categories' })
  @Get('expense-categories')
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_VIEW)
  async listExpenseCategories() {
    return this.accountingService.listExpenseCategories();
  }

  @ApiOperation({ summary: 'Create new expense category' })
  @Post('expense-categories')
  @RequirePermissions(HospitalPermission.ACCOUNTING_MANAGE_ACCOUNTS)
  async createExpenseCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.accountingService.createExpenseCategory(dto);
  }

  @ApiOperation({ summary: 'Update expense category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @Put('expense-categories/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_MANAGE_ACCOUNTS)
  async updateExpenseCategory(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.accountingService.updateExpenseCategory(BigInt(id), dto);
  }

  // ==========================================
  // EXPENSES
  // ==========================================

  @ApiOperation({ summary: 'List expenses with filters and pagination' })
  @Get('expenses')
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_VIEW)
  async listExpenses(@Query() query: ExpenseQueryDto) {
    return this.accountingService.listExpenses(query);
  }

  @ApiOperation({ summary: 'Get expense by ID' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Get('expenses/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_VIEW)
  async getExpenseById(@Param('id') id: string) {
    return this.accountingService.getExpenseById(BigInt(id));
  }

  @ApiOperation({ summary: 'Create new hospital expense' })
  @Post('expenses')
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_CREATE)
  async createExpense(@Body() dto: CreateExpenseDto, @Request() req: any) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.createExpense(dto, userId);
  }

  @ApiOperation({ summary: 'Update expense (DRAFT/REJECTED only)' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Put('expenses/:id')
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_CREATE)
  async updateExpense(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.updateExpense(BigInt(id), dto, userId);
  }

  @ApiOperation({ summary: 'Submit expense for supervisor approval' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Post('expenses/:id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_CREATE)
  async submitExpense(@Param('id') id: string, @Request() req: any) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.submitExpense(BigInt(id), userId);
  }

  @ApiOperation({ summary: 'Approve submitted expense (Separation of Duties enforced)' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Post('expenses/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_APPROVE)
  async approveExpense(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.approveExpense(BigInt(id), body.notes, userId);
  }

  @ApiOperation({ summary: 'Reject submitted expense with mandatory reason' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Post('expenses/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_APPROVE)
  async rejectExpense(
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.rejectExpense(BigInt(id), dto, userId);
  }

  @ApiOperation({ summary: 'Disburse expense payment and post double-entry ledger entry' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Post('expenses/:id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_JOURNAL_POST)
  async payExpense(
    @Param('id') id: string,
    @Body() dto: PayExpenseDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.payExpense(BigInt(id), dto, userId);
  }

  @ApiOperation({ summary: 'Cancel draft or submitted expense' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @Post('expenses/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.ACCOUNTING_EXPENSE_CREATE)
  async cancelExpense(@Param('id') id: string, @Request() req: any) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.cancelExpense(BigInt(id), userId);
  }

  // ==========================================
  // FINANCIAL REPORTS
  // ==========================================

  @ApiOperation({ summary: 'Generate balanced Trial Balance report' })
  @Get('reports/trial-balance')
  @RequirePermissions(HospitalPermission.ACCOUNTING_REPORTS_VIEW)
  async getTrialBalance(@Query() query: ReportQueryDto, @Request() req: any) {
    if (this.branchAuth && req.user && !this.branchAuth.isGlobalAdmin(req.user)) {
      if (query.branchId) {
        await this.branchAuth.assertResourceAccess(req.user, query.branchId, 'accounting report');
      } else {
        query.branchId = req.user.branchId ? Number(req.user.branchId) : undefined;
      }
    }
    return this.accountingService.getTrialBalance(query);
  }

  @ApiOperation({ summary: 'Generate Profit & Loss (Income Statement) report' })
  @Get('reports/profit-loss')
  @RequirePermissions(HospitalPermission.ACCOUNTING_REPORTS_VIEW)
  async getProfitLoss(@Query() query: ReportQueryDto, @Request() req: any) {
    if (this.branchAuth && req.user && !this.branchAuth.isGlobalAdmin(req.user)) {
      if (query.branchId) {
        await this.branchAuth.assertResourceAccess(req.user, query.branchId, 'accounting report');
      } else {
        query.branchId = req.user.branchId ? Number(req.user.branchId) : undefined;
      }
    }
    return this.accountingService.getProfitAndLoss(query);
  }

  @ApiOperation({ summary: 'Generate Balance Sheet financial statement' })
  @Get('reports/balance-sheet')
  @RequirePermissions(HospitalPermission.ACCOUNTING_REPORTS_VIEW)
  async getBalanceSheet(@Query() query: ReportQueryDto, @Request() req: any) {
    if (this.branchAuth && req.user && !this.branchAuth.isGlobalAdmin(req.user)) {
      if (query.branchId) {
        await this.branchAuth.assertResourceAccess(req.user, query.branchId, 'accounting report');
      } else {
        query.branchId = req.user.branchId ? Number(req.user.branchId) : undefined;
      }
    }
    return this.accountingService.getBalanceSheet(query);
  }

  @ApiOperation({ summary: 'Generate General Ledger audit trail for an account' })
  @ApiParam({ name: 'accountId', description: 'Account ID' })
  @Get('reports/general-ledger/:accountId')
  @RequirePermissions(HospitalPermission.ACCOUNTING_REPORTS_VIEW)
  async getGeneralLedger(
    @Param('accountId') accountId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
    @Request() req?: any,
  ) {
    let resolvedBranchId = branchId ? Number(branchId) : undefined;
    if (this.branchAuth && req?.user && !this.branchAuth.isGlobalAdmin(req.user)) {
      if (resolvedBranchId) {
        await this.branchAuth.assertResourceAccess(req.user, resolvedBranchId, 'general ledger');
      } else {
        resolvedBranchId = req.user.branchId ? Number(req.user.branchId) : undefined;
      }
    }
    return this.accountingService.getGeneralLedger(
      BigInt(accountId),
      startDate,
      endDate,
      resolvedBranchId,
    );
  }

  @ApiOperation({ summary: 'Generate category-wise expense breakdown summary' })
  @Get('reports/expense-summary')
  @RequirePermissions(HospitalPermission.ACCOUNTING_REPORTS_VIEW)
  async getExpenseSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getExpenseSummary(startDate, endDate);
  }

  @ApiOperation({ summary: 'Generate cash and bank liquidity summary' })
  @Get('reports/cash-bank-summary')
  @RequirePermissions(HospitalPermission.ACCOUNTING_REPORTS_VIEW)
  async getCashBankSummary() {
    return this.accountingService.getCashAndBankSummary();
  }

  // ==========================================
  // LEGACY COMPATIBILITY
  // ==========================================

  @ApiOperation({ summary: 'List legacy single-entry accounting records' })
  @Get('legacy')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async listLegacyAccounting(
    @Query('category') category?: string,
    @Query('sector') sector?: string,
  ) {
    return this.accountingService.listLegacyAccounting(category, sector);
  }

  @ApiOperation({ summary: 'Record legacy single-entry accounting income or expense' })
  @Post('legacy')
  @RequirePermissions(HospitalPermission.ACCOUNTING_ADD)
  async createLegacyAccounting(
    @Body() dto: CreateLegacyAccountingDto,
    @Request() req: any,
  ) {
    const userId = BigInt(req.user.id || req.user.sub);
    return this.accountingService.createLegacyAccounting(dto, userId);
  }

  @ApiOperation({ summary: 'List legacy accounting sectors' })
  @Get('legacy/sectors')
  @RequirePermissions(HospitalPermission.ACCOUNTING_VIEW)
  async listLegacySectors() {
    return this.accountingService.listLegacySectors();
  }

  @ApiOperation({ summary: 'Create legacy accounting sector' })
  @Post('legacy/sectors')
  @RequirePermissions(HospitalPermission.ACCOUNTING_ADD)
  async createLegacySector(@Body() dto: CreateLegacySectorDto) {
    return this.accountingService.createLegacySector(dto);
  }
}
