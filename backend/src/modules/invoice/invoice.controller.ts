import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoicesDto,
} from './dto/invoice-response.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

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
  ): Promise<PaginatedInvoicesDto> {
    return this.invoiceService.findAll(query);
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
    return this.invoiceService.create(dto, userId);
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
  async findOne(@Param('id') id: string): Promise<InvoiceResponseDto> {
    return this.invoiceService.findOne(id);
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
    return this.invoiceService.recordPayment(id, dto, receivedBy);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.INVOICE_DELETE)
  @ApiOperation({
    summary: 'Delete an unpaid invoice',
    description:
      'Deletes an invoice and its items only if no payments have been recorded and no doctor share has been approved/settled.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice successfully removed.',
  })
  async remove(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.invoiceService.remove(id);
  }
}
