import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PharmacyService } from './pharmacy.service';
import { CreateBatchDto, UpdateBatchStatusDto } from './dto/batch.dto';
import {
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
} from './dto/purchase.dto';
import { DispensePrescriptionDto } from './dto/dispensation.dto';
import { CreateStockAdjustmentDto } from './dto/adjustment.dto';
import { CreatePharmacyReturnDto } from './dto/return.dto';
import {
  QueryBatchDto,
  QueryDispensationDto,
  QueryStockMovementDto,
} from './dto/query-pharmacy.dto';

@ApiTags('Pharmacy & Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  // ===========================================================================
  // 1. DASHBOARD & KPIS
  // ===========================================================================

  @Get('dashboard')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Pharmacy operations dashboard KPIs and summary' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics retrieved successfully' })
  async getDashboard() {
    return this.pharmacyService.getDashboard();
  }

  // ===========================================================================
  // 2. MEDICINE BATCHES
  // ===========================================================================

  @Get('batches')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'List medicine batches with filtering, pagination, and search' })
  @ApiResponse({ status: 200, description: 'Batches retrieved successfully' })
  async findAllBatches(@Query() query: QueryBatchDto) {
    return this.pharmacyService.getBatches(query);
  }

  @Post('batches')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an opening or direct medicine batch' })
  @ApiResponse({ status: 201, description: 'Batch registered and stock movement logged' })
  async createBatch(@Body() dto: CreateBatchDto, @Req() req: any) {
    return this.pharmacyService.createBatch(
      dto,
      req.user?.id ? Number(req.user.id) : undefined,
    );
  }

  @Get('batches/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Get single batch details including movements' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch details retrieved' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async findOneBatch(@Param('id', ParseIntPipe) id: number) {
    return this.pharmacyService.getBatchById(id);
  }

  @Patch('batches/:id/status')
  @RequirePermissions(HospitalPermission.PHARMACY_ADJUST)
  @ApiOperation({ summary: 'Update batch status (e.g. QUARANTINED, RECALLED, SUSPENDED)' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch status updated' })
  async updateBatchStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBatchStatusDto,
  ) {
    return this.pharmacyService.updateBatchStatus(id, dto);
  }

  // ===========================================================================
  // 3. PURCHASING & GOODS RECEIPT
  // ===========================================================================

  @Get('purchases/orders')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @ApiOperation({ summary: 'List purchase orders' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by PO status' })
  @ApiResponse({ status: 200, description: 'Purchase orders list' })
  async findAllPurchaseOrders(@Query('status') status?: string) {
    return this.pharmacyService.getPurchaseOrders({ status });
  }

  @Post('purchases/orders')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order for supplier' })
  @ApiResponse({ status: 201, description: 'Purchase order created' })
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Req() req: any) {
    return this.pharmacyService.createPurchaseOrder(
      dto,
      req.user?.id ? Number(req.user.id) : undefined,
    );
  }

  @Get('purchases/orders/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @ApiOperation({ summary: 'Get purchase order details' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  async findOnePurchaseOrder(@Param('id', ParseIntPipe) id: number) {
    return this.pharmacyService.getPurchaseOrderById(id);
  }

  @Get('purchases/receipts')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @ApiOperation({ summary: 'List goods receipts (GRNs)' })
  async findAllGoodsReceipts() {
    return this.pharmacyService.getGoodsReceipts({});
  }

  @Post('purchases/receipts')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Receive goods receipt, allocate batches and increment inventory' })
  @ApiResponse({ status: 201, description: 'Goods received and batch inventory created' })
  async receiveGoods(@Body() dto: CreateGoodsReceiptDto, @Req() req: any) {
    return this.pharmacyService.createGoodsReceipt(
      dto,
      req.user?.id ? Number(req.user.id) : undefined,
    );
  }

  @Get('purchases/receipts/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @ApiOperation({ summary: 'Get goods receipt details' })
  @ApiParam({ name: 'id', description: 'Goods receipt ID' })
  async findOneGoodsReceipt(@Param('id', ParseIntPipe) id: number) {
    return this.pharmacyService.getGoodsReceiptById(id);
  }

  // ===========================================================================
  // 4. DISPENSING & PRESCRIPTION CONTEXT
  // ===========================================================================

  @Get('dispensations/context/:prescriptionId')
  @RequirePermissions(HospitalPermission.PHARMACY_DISPENSE)
  @ApiOperation({ summary: 'Load prescription items with FEFO batches for dispensing' })
  @ApiParam({ name: 'prescriptionId', description: 'Prescription ID' })
  async getPrescriptionDispenseContext(
    @Param('prescriptionId', ParseIntPipe) prescriptionId: number,
  ) {
    return this.pharmacyService.getPrescriptionDispenseContext(prescriptionId);
  }

  @Get('dispensations')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'List pharmacy dispensations with search & filters' })
  async findAllDispensations(@Query() query: QueryDispensationDto) {
    return this.pharmacyService.getDispensations(query);
  }

  @Post('dispensations')
  @RequirePermissions(HospitalPermission.PHARMACY_DISPENSE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Dispense medication against prescription transactionally with FEFO checks',
  })
  @ApiResponse({ status: 201, description: 'Medication dispensed and stock deducted' })
  async dispensePrescription(
    @Body() dto: DispensePrescriptionDto,
    @Req() req: any,
  ) {
    return this.pharmacyService.dispense(
      dto,
      req.user?.id ? Number(req.user.id) : undefined,
    );
  }

  @Get('dispensations/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Get dispensation details for print receipt' })
  @ApiParam({ name: 'id', description: 'Dispensation ID' })
  async findOneDispensation(@Param('id', ParseIntPipe) id: number) {
    return this.pharmacyService.getDispensationById(id);
  }

  // ===========================================================================
  // 5. STOCK ADJUSTMENTS
  // ===========================================================================

  @Get('adjustments')
  @RequirePermissions(HospitalPermission.PHARMACY_ADJUST)
  @ApiOperation({ summary: 'List stock adjustments' })
  async findAllAdjustments() {
    return this.pharmacyService.getAdjustments();
  }

  @Post('adjustments')
  @RequirePermissions(HospitalPermission.PHARMACY_ADJUST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create physical inventory count or stock adjustment' })
  async createStockAdjustment(
    @Body() dto: CreateStockAdjustmentDto,
    @Req() req: any,
  ) {
    return this.pharmacyService.createStockAdjustment(
      dto,
      req.user?.id ? Number(req.user.id) : undefined,
    );
  }

  // ===========================================================================
  // 6. RETURNS (PATIENT & SUPPLIER)
  // ===========================================================================

  @Get('returns')
  @RequirePermissions(HospitalPermission.PHARMACY_RETURN)
  @ApiOperation({ summary: 'List pharmacy returns' })
  async findAllReturns() {
    return this.pharmacyService.getReturns();
  }

  @Post('returns')
  @RequirePermissions(HospitalPermission.PHARMACY_RETURN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Process patient return or supplier return' })
  async createPharmacyReturn(
    @Body() dto: CreatePharmacyReturnDto,
    @Req() req: any,
  ) {
    return this.pharmacyService.processReturn(
      dto,
      req.user?.id ? Number(req.user.id) : undefined,
    );
  }

  @Get('returns/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_RETURN)
  @ApiOperation({ summary: 'Get pharmacy return details' })
  @ApiParam({ name: 'id', description: 'Return ID' })
  async findOneReturn(@Param('id', ParseIntPipe) id: number) {
    return this.pharmacyService.getReturnById(id);
  }

  // ===========================================================================
  // 7. STOCK MOVEMENTS & AUDIT LEDGER
  // ===========================================================================

  @Get('movements')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Query complete immutable stock movement ledger' })
  async findAllStockMovements(@Query() query: QueryStockMovementDto) {
    return this.pharmacyService.getStockLedger(query);
  }

  // ===========================================================================
  // 8. REPORTS
  // ===========================================================================

  @Get('reports/valuation')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @ApiOperation({ summary: 'Get current pharmacy inventory valuation report' })
  async getValuationReport() {
    return this.pharmacyService.getValuationReport();
  }

  @Get('reports/expiring')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @ApiOperation({ summary: 'Get batches expiring within N days' })
  @ApiQuery({ name: 'days', required: false, description: 'Days threshold (default 60)' })
  async getExpiringBatches(@Query('days') days?: string) {
    return this.pharmacyService.getExpiryReport(days ? parseInt(days, 10) : 60);
  }

  @Get('reports/low-stock')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @ApiOperation({ summary: 'Get medicines with low stock below threshold' })
  @ApiQuery({ name: 'threshold', required: false, description: 'Quantity threshold (default 10)' })
  async getLowStockReport(@Query('threshold') threshold?: string) {
    return this.pharmacyService.getLowStockReport(threshold ? parseInt(threshold, 10) : 10);
  }
}
