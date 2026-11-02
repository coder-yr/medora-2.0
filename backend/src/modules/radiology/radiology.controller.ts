import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RadiologyService } from './radiology.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import {
  CreateRadiologyCategoryDto,
  UpdateRadiologyCategoryDto,
  CreateRadiologyExamDto,
  UpdateRadiologyExamDto,
} from './dto/catalogue.dto';
import {
  CreateRadiologyOrderDto,
  ScheduleRadiologyOrderDto,
  CancelRadiologyOrderDto,
} from './dto/order.dto';
import {
  RecordArrivalDto,
  StartExaminationDto,
  CompleteExaminationDto,
  SaveReportDraftDto,
  SubmitReportDto,
  VerifyReportDto,
  ApproveReportDto,
  CreateRadiologyAmendmentDto,
} from './dto/workflow.dto';
import { QueryRadiologyOrderDto, QueryRadiologyExamDto } from './dto/query.dto';

@ApiTags('Radiology & Diagnostic Imaging (RIS)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('radiology')
export class RadiologyController {
  constructor(private readonly radiologyService: RadiologyService) {}

  // =========================================================================
  // 1. DASHBOARD & KPIS
  // =========================================================================

  @Get('dashboard')
  @RequirePermissions(HospitalPermission.RADIOLOGY_VIEW)
  @ApiOperation({ summary: 'Get departmental radiology KPI metrics and recent studies' })
  @ApiResponse({ status: 200, description: 'Department metrics successfully retrieved' })
  async getDashboard(@CurrentUser() user?: AuthUser) {
    const branchId = user?.branchId ? Number(user.branchId) : undefined;
    return this.radiologyService.getDashboardMetrics(branchId);
  }

  // =========================================================================
  // 2. CATALOGUE & MODALITIES MANAGEMENT
  // =========================================================================

  @Get('catalogue/categories')
  @RequirePermissions(HospitalPermission.RADIOLOGY_VIEW)
  @ApiOperation({ summary: 'List all radiology categories with exam counts' })
  async getCategories() {
    return this.radiologyService.getCategories();
  }

  @Post('catalogue/categories')
  @RequirePermissions(HospitalPermission.RADIOLOGY_CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Create a new radiology category' })
  async createCategory(@Body() dto: CreateRadiologyCategoryDto) {
    return this.radiologyService.createCategory(dto);
  }

  @Put('catalogue/categories/:id')
  @RequirePermissions(HospitalPermission.RADIOLOGY_CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Update an existing radiology category' })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRadiologyCategoryDto,
  ) {
    return this.radiologyService.updateCategory(id, dto);
  }

  @Get('catalogue/exams')
  @RequirePermissions(HospitalPermission.RADIOLOGY_VIEW)
  @ApiOperation({ summary: 'Search and filter active radiology exams' })
  async getExams(@Query() query: QueryRadiologyExamDto) {
    return this.radiologyService.getExams(query);
  }

  @Post('catalogue/exams')
  @RequirePermissions(HospitalPermission.RADIOLOGY_CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Create a new diagnostic imaging exam' })
  async createExam(@Body() dto: CreateRadiologyExamDto) {
    return this.radiologyService.createExam(dto);
  }

  @Get('catalogue/exams/:id')
  @RequirePermissions(HospitalPermission.RADIOLOGY_VIEW)
  @ApiOperation({ summary: 'Get exam details by ID' })
  async getExamById(@Param('id', ParseIntPipe) id: number) {
    return this.radiologyService.getExamById(id);
  }

  @Put('catalogue/exams/:id')
  @RequirePermissions(HospitalPermission.RADIOLOGY_CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Update radiology exam details' })
  async updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRadiologyExamDto,
  ) {
    return this.radiologyService.updateExam(id, dto);
  }

  @Delete('catalogue/exams/:id')
  @RequirePermissions(HospitalPermission.RADIOLOGY_CATALOGUE_MANAGE)
  @ApiOperation({ summary: 'Delete or deactivate radiology exam' })
  async deleteExam(@Param('id', ParseIntPipe) id: number) {
    return this.radiologyService.deleteExam(id);
  }

  // =========================================================================
  // 3. ORDERS WORKLIST & REQUISITIONS
  // =========================================================================

  @Post('orders')
  @RequirePermissions(HospitalPermission.RADIOLOGY_ORDER)
  @ApiOperation({ summary: 'Create radiology imaging order(s) for a patient' })
  async createOrders(
    @Body() dto: CreateRadiologyOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.createOrders(dto, userId);
  }

  @Get('orders')
  @RequirePermissions(HospitalPermission.RADIOLOGY_VIEW)
  @ApiOperation({ summary: 'Query radiology orders worklist' })
  async getOrders(@Query() query: QueryRadiologyOrderDto) {
    return this.radiologyService.getOrders(query);
  }

  @Get('orders/:id')
  @RequirePermissions(HospitalPermission.RADIOLOGY_VIEW)
  @ApiOperation({ summary: 'Get radiology order details and patient imaging history' })
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.radiologyService.getOrderById(id);
  }

  // =========================================================================
  // 4. SCHEDULING & CONFLICT DETECTION
  // =========================================================================

  @Post('orders/:id/schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_SCHEDULE)
  @ApiOperation({ summary: 'Schedule an imaging appointment with collision checking' })
  async scheduleOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ScheduleRadiologyOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.scheduleOrder(id, dto, userId);
  }

  // =========================================================================
  // 5. EXAMINATION WORKFLOW (ARRIVAL, START, COMPLETE)
  // =========================================================================

  @Post('orders/:id/arrived')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_PROCESS)
  @ApiOperation({ summary: 'Record patient arrival in imaging reception' })
  async markArrival(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: RecordArrivalDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.recordArrival(id, dto || {}, userId);
  }

  @Post('orders/:id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_PROCESS)
  @ApiOperation({ summary: 'Mark scan acquisition in-progress' })
  async startExamination(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: StartExaminationDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.startExamination(id, dto || {}, userId);
  }

  @Post('orders/:id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_PROCESS)
  @ApiOperation({ summary: 'Complete scan acquisition (done, awaiting report)' })
  async completeExamination(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: CompleteExaminationDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.completeExamination(id, dto || {}, userId);
  }

  // =========================================================================
  // 6. REPORTING WORKBENCH, VERIFICATION & AMENDMENTS
  // =========================================================================

  @Post('orders/:id/draft')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_RESULT_ENTER)
  @ApiOperation({ summary: 'Save draft findings without finalizing report' })
  async saveReportDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveReportDraftDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.saveReportDraft(id, dto, userId);
  }

  @Post('orders/:id/report')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_RESULT_ENTER)
  @ApiOperation({ summary: 'Submit formal radiology report (requires impression)' })
  async submitReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitReportDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.submitReport(id, dto, userId);
  }

  @Post('orders/:id/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_VERIFY)
  @ApiOperation({ summary: 'Quality control verification by senior radiologist' })
  async verifyReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyReportDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.verifyReport(id, dto, userId);
  }

  @Post('orders/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_APPROVE)
  @ApiOperation({ summary: 'Final authorization & clinical release of report' })
  async approveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReportDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.approveReport(id, dto, userId);
  }

  @Post('orders/:id/amend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_AMEND)
  @ApiOperation({ summary: 'Issue audited amendment for an authorized report' })
  async createAmendment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRadiologyAmendmentDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : 1;
    return this.radiologyService.createAmendment(id, dto, userId);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_ORDER)
  @ApiOperation({ summary: 'Cancel order with mandatory reason' })
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelRadiologyOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.cancelOrder(id, dto, userId);
  }

  // =========================================================================
  // 7. BILLING & INVOICING
  // =========================================================================

  @Post('orders/:id/bill')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.RADIOLOGY_ORDER)
  @ApiOperation({ summary: 'Raise billing invoice for unbilled radiology order' })
  async billOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: AuthUser,
  ) {
    const userId = user?.id ? parseInt(user.id, 10) : undefined;
    return this.radiologyService.billOrder(id, userId);
  }

  // =========================================================================
  // 8. ANALYTICAL REPORTS
  // =========================================================================

  @Get('reports/tat')
  @RequirePermissions(HospitalPermission.RADIOLOGY_REPORTS)
  @ApiOperation({ summary: 'Turnaround time analytics per modality' })
  async getTatReport() {
    return this.radiologyService.getTatReport();
  }
}
