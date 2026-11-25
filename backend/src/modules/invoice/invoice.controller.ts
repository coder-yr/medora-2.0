import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoicesDto,
} from './dto/invoice-response.dto';
import {
  CreateServiceItemDto,
  UpdateServiceItemDto,
} from './dto/service-catalogue.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('metrics/finance-summary')
  @RequirePermissions(HospitalPermission.INVOICE_VIEW)
  @ApiOperation({
    summary: 'Organization finance & billing KPI summary metrics',
    description: 'Returns today invoiced, collected, refunded, net collections, and overdue receivables.',
  })
  async getFinanceSummary(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: any,
  ) {
    return this.invoiceService.getFinanceSummary(req.user, branchId, date);
  }

  @Get('catalogue')
  @RequirePermissions(HospitalPermission.INVOICE_VIEW)
  @ApiOperation({
    summary: 'List billable service catalogue items',
    description: 'Returns active clinic service items and pricing filtered by organization and kind.',
  })
  async listCatalogue(
    @Query('kind') kind: string,
    @Query('search') search: string,
    @Request() req: any,
  ) {
    return this.invoiceService.listServiceCatalogue(req.user, kind, search);
  }

  @Post('catalogue')
  @RequirePermissions(HospitalPermission.INVOICE_ADD)
  @ApiOperation({
    summary: 'Add a new billable service item to catalogue',
  })
  async createCatalogueItem(
    @Body() dto: CreateServiceItemDto,
    @Request() req: any,
  ) {
    return this.invoiceService.createServiceItem(dto, req.user);
  }

  @Put('catalogue/:id')
  @RequirePermissions(HospitalPermission.INVOICE_UPDATE)
  @ApiOperation({
    summary: 'Update an existing service catalogue item or price',
  })
  async updateCatalogueItem(
    @Param('id') id: string,
    @Body() dto: UpdateServiceItemDto,
    @Request() req: any,
  ) {
    return this.invoiceService.updateServiceItem(id, dto, req.user);
  }

  @Post('from-consultation/:id')
  @RequirePermissions(HospitalPermission.INVOICE_ADD)
  @ApiOperation({
    summary: 'Generate invoice from consultation encounter',
    description: 'Idempotent: returns existing invoice if already billed for this consultation.',
  })
  async fromConsultation(
    @Param('id') id: string,
    @Body() dto: Partial<CreateInvoiceDto>,
    @Request() req: any,
  ): Promise<InvoiceResponseDto> {
    return this.invoiceService.createFromConsultation(id, dto, req.user);
  }

  @Post('from-lab-order/:id')
  @RequirePermissions(HospitalPermission.INVOICE_ADD)
  @ApiOperation({
    summary: 'Generate invoice from diagnostic laboratory order',
    description: 'Idempotent: returns existing invoice if already billed for this lab order.',
  })
  async fromLabOrder(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<InvoiceResponseDto> {
    return this.invoiceService.createFromLabOrder(id, req.user);
  }

  @Get()
  @RequirePermissions(HospitalPermission.INVOICE_VIEW)
  @ApiOperation({
    summary: 'List patient invoices',
    description:
      'Returns a paginated list of invoices with total outstanding owed. Filter by show status (outstanding, settled, all), patient ID, and date.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of invoices with total owed.',
    type: PaginatedInvoicesDto,
  })
  async findAll(
    @Query() query: InvoiceQueryDto,
    @Request() req: any,
  ): Promise<PaginatedInvoicesDto> {
    return this.invoiceService.findAll(query, req.user);
  }

  @Post()
  @RequirePermissions(HospitalPermission.INVOICE_ADD)
  @ApiOperation({
    summary: 'Raise a new patient invoice',
    description:
      'Creates an invoice header, validates charge items against active price catalog/overrides, calculates totals on the server, and initiates doctor share allocations.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully.',
    type: InvoiceResponseDto,
  })
  async create(
    @Body() dto: CreateInvoiceDto,
    @Request() req: any,
  ): Promise<InvoiceResponseDto> {
    const userId = req.user?.id ? String(req.user.id) : undefined;
    return this.invoiceService.create(dto, userId, req.user);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.INVOICE_VIEW)
  @ApiOperation({
    summary: 'Get invoice details',
    description:
      'Returns complete invoice details including line items, installment payments, and current balance.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed invoice record.',
    type: InvoiceResponseDto,
  })
  async findOne(@Param('id') id: string, @Request() req: any): Promise<InvoiceResponseDto> {
    return this.invoiceService.findOne(id, req.user);
  }

  @Post(':id/pay')
  @RequirePermissions(HospitalPermission.PAYMENT_ADD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record an installment or full payment against an invoice',
    description:
      'Applies a payment atomically with pessimistic balance lock. Overpayment is strictly rejected.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment recorded and balance updated.',
    type: InvoiceResponseDto,
  })
  async pay(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
    @Request() req: any,
  ): Promise<InvoiceResponseDto> {
    const receivedBy = req.user?.id ? String(req.user.id) : undefined;
    return this.invoiceService.recordPayment(id, dto, receivedBy, req.user);
  }

  @Post(':id/refund')
  @RequirePermissions(HospitalPermission.PAYMENT_ADD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a full or partial refund against an invoice',
    description:
      'Issues an audited refund under row-level lock. Refund amount cannot exceed received funds.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async refund(
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @Request() req: any,
  ): Promise<InvoiceResponseDto> {
    const userId = req.user?.id ? String(req.user.id) : '0';
    return this.invoiceService.processRefund(id, dto, userId, req.user);
  }

  @Post(':id/cancel')
  @RequirePermissions(HospitalPermission.INVOICE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void / cancel an unpaid invoice with mandatory justification',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
    @Request() req: any,
  ): Promise<InvoiceResponseDto> {
    const userId = req.user?.id ? String(req.user.id) : '0';
    return this.invoiceService.cancelInvoice(id, dto, userId, req.user);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.INVOICE_DELETE)
  @ApiOperation({
    summary: 'Delete an unpaid invoice',
    description:
      'Deletes an invoice and its items only if no payments have been recorded.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice successfully removed.',
  })
  async remove(@Param('id') id: string, @Request() req: any): Promise<{ success: boolean; message: string }> {
    return this.invoiceService.remove(id, req.user);
  }
}
