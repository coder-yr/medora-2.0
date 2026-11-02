import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LaboratoryService } from './laboratory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import {
  CreateLabTestCatalogueDto,
  CreateTestParameterDto,
  UpdateLabTestCatalogueDto,
} from './dto/catalogue.dto';
import { CancelLabOrderDto, CreateLabOrderDto } from './dto/lab-order.dto';
import { CollectSampleDto, ReceiveSampleDto, RejectSampleDto } from './dto/sample.dto';
import {
  ApproveReportDto,
  EnterResultsDto,
  VerifyResultsDto,
} from './dto/result.dto';
import { AmendReportDto } from './dto/amendment.dto';
import { QueryLabCatalogueDto, QueryLabOrdersDto } from './dto/query-lab.dto';

@ApiTags('Laboratory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('lab')
export class LaboratoryController {
  constructor(private readonly labService: LaboratoryService) {}

  // ===========================================================================
  // 1. DASHBOARD
  // ===========================================================================

  @Get('dashboard')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'Get laboratory dashboard KPIs and queue counts' })
  @ApiResponse({ status: 200, description: 'Laboratory dashboard data' })
  async getDashboard() {
    return this.labService.getDashboard();
  }

  // ===========================================================================
  // 2. TEST CATALOGUE MANAGEMENT
  // ===========================================================================

  @Get('catalogue')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'List formulary laboratory tests and panels' })
  @ApiResponse({ status: 200, description: 'Catalogue items array' })
  async getCatalogue(@Query() query: QueryLabCatalogueDto) {
    return this.labService.getCatalogue(query);
  }

  @Get('catalogue/:id')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'Get a single laboratory test catalogue definition' })
  @ApiResponse({ status: 200, description: 'Test catalogue definition' })
  async getCatalogueItemById(@Param('id', ParseIntPipe) id: number) {
    return this.labService.getCatalogueItemById(id);
  }

  @Post('catalogue')
  @RequirePermissions(HospitalPermission.LAB_MANAGE_CATALOGUE)
  @ApiOperation({ summary: 'Add a new test or panel to the laboratory catalogue' })
  @ApiResponse({ status: 201, description: 'Test created successfully' })
  async createCatalogueItem(@Body() dto: CreateLabTestCatalogueDto) {
    return this.labService.createCatalogueItem(dto);
  }

  @Put('catalogue/:id')
  @RequirePermissions(HospitalPermission.LAB_MANAGE_CATALOGUE)
  @ApiOperation({ summary: 'Update an existing laboratory test in catalogue' })
  @ApiResponse({ status: 200, description: 'Test updated successfully' })
  async updateCatalogueItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLabTestCatalogueDto,
  ) {
    return this.labService.updateCatalogueItem(id, dto);
  }

  @Delete('catalogue/:id')
  @RequirePermissions(HospitalPermission.LAB_MANAGE_CATALOGUE)
  @ApiOperation({ summary: 'Remove an unrequested test from catalogue' })
  @ApiResponse({ status: 200, description: 'Test removed successfully' })
  async deleteCatalogueItem(@Param('id', ParseIntPipe) id: number) {
    return this.labService.deleteCatalogueItem(id);
  }

  @Post('catalogue/:id/parameters')
  @RequirePermissions(HospitalPermission.LAB_MANAGE_CATALOGUE)
  @ApiOperation({ summary: 'Add a parameter to a laboratory test' })
  @ApiResponse({ status: 201, description: 'Parameter added successfully' })
  async addParameter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTestParameterDto,
  ) {
    return this.labService.addParameter(id, dto);
  }

  @Delete('catalogue/parameters/:paramId')
  @RequirePermissions(HospitalPermission.LAB_MANAGE_CATALOGUE)
  @ApiOperation({ summary: 'Remove a parameter from a test' })
  @ApiResponse({ status: 200, description: 'Parameter removed successfully' })
  async deleteParameter(@Param('paramId', ParseIntPipe) paramId: number) {
    return this.labService.deleteParameter(paramId);
  }

  // ===========================================================================
  // 3. LAB ORDERS WORKFLOW
  // ===========================================================================

  @Post('orders')
  @RequirePermissions(HospitalPermission.LAB_ORDER)
  @ApiOperation({ summary: 'Raise a new laboratory requisition order for a patient' })
  @ApiResponse({ status: 201, description: 'Lab order created successfully' })
  async createOrder(@Body() dto: CreateLabOrderDto, @Req() req: any) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.createOrder(dto, userId);
  }

  @Get('orders')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'List and filter laboratory requisition orders' })
  @ApiResponse({ status: 200, description: 'Paginated laboratory orders' })
  async getOrders(@Query() query: QueryLabOrdersDto) {
    return this.labService.getOrders(query);
  }

  @Get('orders/:id')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'Get complete laboratory order detail with tests and samples' })
  @ApiResponse({ status: 200, description: 'Laboratory order details' })
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.labService.getOrderById(id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_ORDER)
  @ApiOperation({ summary: 'Cancel a pending or in-progress laboratory order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelLabOrderDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.cancelOrder(id, dto, userId);
  }

  @Get('patients/:patientId/history')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'Get longitudinal laboratory test history for a patient' })
  @ApiResponse({ status: 200, description: 'Patient laboratory test history' })
  async getPatientHistory(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.labService.getPatientHistory(patientId);
  }

  // ===========================================================================
  // 4. SAMPLE COLLECTION & ACCESSIONING
  // ===========================================================================

  @Get('samples/queue')
  @RequirePermissions(HospitalPermission.LAB_VIEW)
  @ApiOperation({ summary: 'Get sample collection and accessioning work queue' })
  @ApiResponse({ status: 200, description: 'Sample queue items' })
  async getSampleQueue() {
    return this.labService.getSampleQueue();
  }

  @Post('samples/:sampleId/collect')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_SAMPLE_COLLECT)
  @ApiOperation({ summary: 'Record specimen collection by phlebotomist' })
  @ApiResponse({ status: 200, description: 'Sample marked as collected' })
  async collectSample(
    @Param('sampleId', ParseIntPipe) sampleId: number,
    @Body() dto: CollectSampleDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.collectSample(sampleId, dto, userId);
  }

  @Post('samples/:sampleId/receive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_PROCESS)
  @ApiOperation({ summary: 'Accession specimen upon delivery to analytical laboratory' })
  @ApiResponse({ status: 200, description: 'Sample accessioned and marked received' })
  async receiveSample(
    @Param('sampleId', ParseIntPipe) sampleId: number,
    @Body() dto: ReceiveSampleDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.receiveSample(sampleId, dto, userId);
  }

  @Post('samples/:sampleId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_PROCESS)
  @ApiOperation({ summary: 'Reject an unsuitable specimen with clinical rejection reason' })
  @ApiResponse({ status: 200, description: 'Sample rejected and recollection requested' })
  async rejectSample(
    @Param('sampleId', ParseIntPipe) sampleId: number,
    @Body() dto: RejectSampleDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.rejectSample(sampleId, dto, userId);
  }

  // ===========================================================================
  // 5. RESULT ENTRY, VERIFICATION & APPROVAL
  // ===========================================================================

  @Post('orders/:id/results')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_RESULT_ENTER)
  @ApiOperation({ summary: 'Enter parameter readings and draft test results' })
  @ApiResponse({ status: 200, description: 'Results saved successfully' })
  async enterResults(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnterResultsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.enterResults(id, dto, userId);
  }

  @Post('orders/:id/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_RESULT_VERIFY)
  @ApiOperation({ summary: 'Review and verify entered results by senior laboratorist' })
  @ApiResponse({ status: 200, description: 'Results verified successfully' })
  async verifyResults(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyResultsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.verifyResults(id, dto, userId);
  }

  @Post('orders/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_REPORT_APPROVE)
  @ApiOperation({ summary: 'Authorize, finalize, and release official laboratory report' })
  @ApiResponse({ status: 200, description: 'Report approved and released' })
  async approveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReportDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.approveReport(id, dto, userId);
  }

  @Post('orders/:id/amend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.LAB_REPORT_AMEND)
  @ApiOperation({ summary: 'Submit a controlled clinical amendment to an approved report' })
  @ApiResponse({ status: 200, description: 'Report amended with audit entry' })
  async amendReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AmendReportDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id ? Number(req.user.id) : 1;
    return this.labService.amendReport(id, dto, userId);
  }
}
