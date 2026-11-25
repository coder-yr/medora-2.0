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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProtectClinicalAccess } from '../../common/decorators/clinical-access.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user.interface';
import { PharmacyService } from './pharmacy.service';
import { CreateBatchDto, UpdateBatchStatusDto } from './dto/batch.dto';
import {
  ApprovePurchaseOrderDto,
  CancelPurchaseOrderDto,
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
} from './dto/purchase.dto';
import { CreateOtcSaleDto, DispensePrescriptionDto } from './dto/dispensation.dto';
import { CreateStockAdjustmentDto } from './dto/adjustment.dto';
import { CreatePharmacyReturnDto } from './dto/return.dto';
import { CreateStockTransferDto, QueryStockTransferDto } from './dto/transfer.dto';
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
  async getDashboard(@CurrentUser() user: AuthUser) {
    return this.pharmacyService.getDashboard(user);
  }

  // ===========================================================================
  // 2. MEDICINE BATCHES
  // ===========================================================================

  @Get('batches')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'List medicine batches with filtering, pagination, and search' })
  @ApiResponse({ status: 200, description: 'Batches retrieved successfully' })
  async findAllBatches(
    @Query() query: QueryBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getBatches(query, user);
  }

  @Post('batches')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an opening or direct medicine batch' })
  @ApiResponse({ status: 201, description: 'Batch registered and stock movement logged' })
  async createBatch(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.createBatch(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  @Get('batches/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Get single batch details including movements' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch details retrieved' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async findOneBatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getBatchById(id, user);
  }

  @Patch('batches/:id/status')
  @RequirePermissions(HospitalPermission.PHARMACY_ADJUST)
  @ApiOperation({ summary: 'Update batch status (e.g. QUARANTINED, RECALLED, SUSPENDED)' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch status updated' })
  async updateBatchStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBatchStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.updateBatchStatus(id, dto, user);
  }

  // ===========================================================================
  // 3. PURCHASING & GOODS RECEIPT
  // ===========================================================================

  @Get('purchases/orders')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @ApiOperation({ summary: 'List purchase orders' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by PO status' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  @ApiResponse({ status: 200, description: 'Purchase orders list' })
  async findAllPurchaseOrders(
    @Query('status') status?: string,
    @Query('branchId') branchId?: number,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.pharmacyService.getPurchaseOrders({ status, branchId }, user);
  }

  @Post('purchases/orders')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order for supplier' })
  @ApiResponse({ status: 201, description: 'Purchase order created' })
  async createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.createPurchaseOrder(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  @Get('purchases/orders/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @ApiOperation({ summary: 'Get purchase order details' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  async findOnePurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getPurchaseOrderById(id, user);
  }

  @Post('purchases/orders/:id/approve')
  @RequirePermissions(HospitalPermission.PO_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve purchase order for supplier fulfillment' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  async approvePurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApprovePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.approvePurchaseOrder(
      id,
      dto.notes,
      user,
    );
  }

  @Post('purchases/orders/:id/cancel')
  @RequirePermissions(HospitalPermission.PHARMACY_PURCHASE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel purchase order' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  async cancelPurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.cancelPurchaseOrder(
      id,
      dto.reason,
      user,
    );
  }

  @Get('purchases/receipts')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @ApiOperation({ summary: 'List goods receipts (GRNs)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  async findAllGoodsReceipts(
    @Query('branchId') branchId?: number,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.pharmacyService.getGoodsReceipts({ branchId }, user);
  }

  @Post('purchases/receipts')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Receive goods receipt, allocate batches and increment inventory' })
  @ApiResponse({ status: 201, description: 'Goods received and batch inventory created' })
  async receiveGoods(
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.createGoodsReceipt(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  @Get('purchases/receipts/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_RECEIVE)
  @ApiOperation({ summary: 'Get goods receipt details' })
  @ApiParam({ name: 'id', description: 'Goods receipt ID' })
  async findOneGoodsReceipt(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getGoodsReceiptById(id, user);
  }

  // ===========================================================================
  // 4. DISPENSING & PRESCRIPTION CONTEXT
  // ===========================================================================

  @ProtectClinicalAccess()
  @Get('dispensations/context/:prescriptionId')
  @RequirePermissions(HospitalPermission.PHARMACY_DISPENSE)
  @ApiOperation({ summary: 'Load prescription items with FEFO batches for dispensing' })
  @ApiParam({ name: 'prescriptionId', description: 'Prescription ID' })
  async getPrescriptionDispenseContext(
    @Param('prescriptionId', ParseIntPipe) prescriptionId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getPrescriptionDispenseContext(prescriptionId, user);
  }

  @ProtectClinicalAccess()
  @Get('dispensations')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'List pharmacy dispensations with search & filters' })
  async findAllDispensations(
    @Query() query: QueryDispensationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getDispensations(query, user);
  }

  @ProtectClinicalAccess()
  @Post('dispensations')
  @RequirePermissions(HospitalPermission.PHARMACY_DISPENSE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Dispense medication against prescription transactionally with FEFO checks',
  })
  @ApiResponse({ status: 201, description: 'Medication dispensed and stock deducted' })
  async dispensePrescription(
    @Body() dto: DispensePrescriptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.dispense(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  @ProtectClinicalAccess()
  @Get('dispensations/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Get dispensation details for print receipt' })
  @ApiParam({ name: 'id', description: 'Dispensation ID' })
  async findOneDispensation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getDispensationById(id, user);
  }

  @Post('sales/otc')
  @RequirePermissions(HospitalPermission.PHARMACY_OTC_SALE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Direct Over-the-Counter retail sale with FEFO batch allocation and prescription checks',
  })
  @ApiResponse({ status: 201, description: 'OTC sale completed and invoice generated' })
  async createOtcSale(
    @Body() dto: CreateOtcSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.sellOtc(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  // ===========================================================================
  // 5. STOCK ADJUSTMENTS
  // ===========================================================================

  @Get('adjustments')
  @RequirePermissions(HospitalPermission.PHARMACY_ADJUST)
  @ApiOperation({ summary: 'List stock adjustments' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  async findAllAdjustments(
    @Query('branchId') branchId?: number,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.pharmacyService.getAdjustments({ branchId }, user);
  }

  @Post('adjustments')
  @RequirePermissions(HospitalPermission.PHARMACY_ADJUST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create physical inventory count or stock adjustment' })
  async createStockAdjustment(
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.createStockAdjustment(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  // ===========================================================================
  // 6. RETURNS (PATIENT & SUPPLIER)
  // ===========================================================================

  @Get('returns')
  @RequirePermissions(HospitalPermission.PHARMACY_RETURN)
  @ApiOperation({ summary: 'List pharmacy returns' })
  @ApiQuery({ name: 'returnType', required: false, description: 'Filter by return type' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  async findAllReturns(
    @Query('returnType') returnType?: string,
    @Query('branchId') branchId?: number,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.pharmacyService.getReturns({ returnType, branchId }, user);
  }

  @Post('returns')
  @RequirePermissions(HospitalPermission.PHARMACY_RETURN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Process patient return or supplier return' })
  async createPharmacyReturn(
    @Body() dto: CreatePharmacyReturnDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.processReturn(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  @Get('returns/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_RETURN)
  @ApiOperation({ summary: 'Get pharmacy return details' })
  @ApiParam({ name: 'id', description: 'Return ID' })
  async findOneReturn(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getReturnById(id, user);
  }

  // ===========================================================================
  // 7. INTER-BRANCH STOCK TRANSFERS
  // ===========================================================================

  @Get('transfers')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'List inter-branch stock transfers' })
  async findAllTransfers(
    @Query() query: QueryStockTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getTransfers(query, user);
  }

  @Post('transfers')
  @RequirePermissions(HospitalPermission.PHARMACY_TRANSFER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and execute inter-branch stock transfer' })
  async createTransfer(
    @Body() dto: CreateStockTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.transferStock(
      dto,
      user?.id ? Number(user.id) : undefined,
      user,
    );
  }

  @Get('transfers/:id')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Get inter-branch stock transfer details' })
  @ApiParam({ name: 'id', description: 'Transfer ID' })
  async findOneTransfer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getTransferById(id, user);
  }

  // ===========================================================================
  // 8. STOCK MOVEMENTS & AUDIT LEDGER
  // ===========================================================================

  @Get('movements')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({ summary: 'Query complete immutable stock movement ledger' })
  async findAllStockMovements(
    @Query() query: QueryStockMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pharmacyService.getStockLedger(query, user);
  }

  // ===========================================================================
  // 8. REPORTS
  // ===========================================================================

  @Get('reports/valuation')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @ApiOperation({ summary: 'Get current pharmacy inventory valuation report' })
  async getValuationReport(@CurrentUser() user: AuthUser) {
    return this.pharmacyService.getValuationReport(user);
  }

  @Get('reports/expiring')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @ApiOperation({ summary: 'Get batches expiring within N days' })
  @ApiQuery({ name: 'days', required: false, description: 'Days threshold (default 60)' })
  async getExpiringBatches(
    @Query('days') days?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.pharmacyService.getExpiryReport(days ? parseInt(days, 10) : 60, user);
  }

  @Get('reports/low-stock')
  @RequirePermissions(HospitalPermission.PHARMACY_REPORTS)
  @ApiOperation({ summary: 'Get medicines with low stock below threshold' })
  @ApiQuery({ name: 'threshold', required: false, description: 'Quantity threshold (default 10)' })
  async getLowStockReport(
    @Query('threshold') threshold?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.pharmacyService.getLowStockReport(threshold ? parseInt(threshold, 10) : 10, user);
  }
}
