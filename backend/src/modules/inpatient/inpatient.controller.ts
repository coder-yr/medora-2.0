import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InpatientService } from './inpatient.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { CreateWardDto, UpdateWardDto } from './dto/ward.dto';
import { CreateBedDto, UpdateBedDto, UpdateBedStatusDto } from './dto/bed.dto';
import {
  CancelAdmissionDto,
  CreateAdmissionDto,
  UpdateAdmissionDto,
} from './dto/admission.dto';
import { TransferBedDto } from './dto/transfer.dto';
import { CompleteDischargeDto, RequestDischargeDto } from './dto/discharge.dto';
import { PostFolioChargeDto, ReverseFolioChargeDto, SettleFolioDto } from './dto/folio.dto';
import { QueryAdmissionDto, QueryBedDto } from './dto/query.dto';

@ApiTags('Inpatient & Bed Management (IPD)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('inpatient')
export class InpatientController {
  constructor(private readonly inpatientService: InpatientService) {}

  // =========================================================================
  // 1. DASHBOARD & KPIS
  // =========================================================================

  @Get('dashboard')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'Get operational inpatient KPIs and bed occupancy statistics' })
  @ApiResponse({ status: 200, description: 'Occupancy rate, counts by bed status, active stays' })
  async getDashboard() {
    return this.inpatientService.getDashboardMetrics();
  }

  // =========================================================================
  // 2. WARD & BED CATALOGUE
  // =========================================================================

  @Get('wards')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'List all wards / bed categories with live occupancy numbers' })
  async getWards() {
    return this.inpatientService.getWards();
  }

  @Get('wards/:id')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'Get ward details and registered beds' })
  async getWardById(@Param('id') id: string) {
    return this.inpatientService.getWardById(id);
  }

  @Post('wards')
  @RequirePermissions(HospitalPermission.WARD_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ward with base daily pricing' })
  async createWard(@Body() dto: CreateWardDto) {
    return this.inpatientService.createWard(dto);
  }

  @Put('wards/:id')
  @RequirePermissions(HospitalPermission.WARD_MANAGE)
  @ApiOperation({ summary: 'Update ward configuration or daily bed rate' })
  async updateWard(@Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.inpatientService.updateWard(id, dto);
  }

  @Delete('wards/:id')
  @RequirePermissions(HospitalPermission.WARD_MANAGE)
  @ApiOperation({ summary: 'Delete empty ward' })
  async deleteWard(@Param('id') id: string) {
    return this.inpatientService.deleteWard(id);
  }

  // =========================================================================
  // 3. BED MANAGEMENT & REGISTER
  // =========================================================================

  @Get('beds')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'List beds with ward and active admission details' })
  async getBeds(@Query() query: QueryBedDto) {
    return this.inpatientService.getBeds(query);
  }

  @Get('beds/available')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'Get list of currently allocatable (AVAILABLE) beds' })
  async getAvailableBeds(@Query('categoryId') categoryId?: string) {
    return this.inpatientService.getAvailableBeds(categoryId);
  }

  @Get('beds/:id')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'Get bed details and allocation history' })
  async getBedById(@Param('id') id: string) {
    return this.inpatientService.getBedById(id);
  }

  @Post('beds')
  @RequirePermissions(HospitalPermission.BED_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new bed in a ward' })
  async createBed(@Body() dto: CreateBedDto) {
    return this.inpatientService.createBed(dto);
  }

  @Put('beds/:id')
  @RequirePermissions(HospitalPermission.BED_MANAGE)
  @ApiOperation({ summary: 'Update bed number or description' })
  async updateBed(@Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.inpatientService.updateBed(id, dto);
  }

  @Patch('beds/:id/status')
  @RequirePermissions(HospitalPermission.BED_MANAGE)
  @ApiOperation({ summary: 'Change bed status (e.g. CLEANING, MAINTENANCE, AVAILABLE)' })
  async updateBedStatus(@Param('id') id: string, @Body() dto: UpdateBedStatusDto) {
    return this.inpatientService.updateBedStatus(id, dto);
  }

  @Delete('beds/:id')
  @RequirePermissions(HospitalPermission.BED_MANAGE)
  @ApiOperation({ summary: 'Delete unoccupied bed' })
  async deleteBed(@Param('id') id: string) {
    return this.inpatientService.deleteBed(id);
  }

  // =========================================================================
  // 4. ADMISSIONS LIFECYCLE
  // =========================================================================

  @Get('admissions')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'List admissions with filters and search' })
  async getAdmissions(@Query() query: QueryAdmissionDto) {
    return this.inpatientService.findAllAdmissions(query);
  }

  @Get('admissions/:id')
  @RequirePermissions(HospitalPermission.INPATIENT_VIEW)
  @ApiOperation({ summary: 'Get comprehensive admission details including folio and clinical history' })
  async getAdmissionById(@Param('id') id: string) {
    return this.inpatientService.findAdmissionById(id);
  }

  @Post('admissions')
  @RequirePermissions(HospitalPermission.INPATIENT_ADMIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admit patient, allocate initial bed, and initialize inpatient folio' })
  async createAdmission(@Body() dto: CreateAdmissionDto, @CurrentUser() user: AuthUser) {
    return this.inpatientService.createAdmission(dto, user?.id);
  }

  @Put('admissions/:id')
  @RequirePermissions(HospitalPermission.INPATIENT_UPDATE)
  @ApiOperation({ summary: 'Update admission clinical details or attending doctor' })
  async updateAdmission(@Param('id') id: string, @Body() dto: UpdateAdmissionDto) {
    return this.inpatientService.updateAdmission(id, dto);
  }

  @Post('admissions/:id/cancel')
  @RequirePermissions(HospitalPermission.INPATIENT_ADMIT)
  @ApiOperation({ summary: 'Cancel pending admission with no posted charges' })
  async cancelAdmission(
    @Param('id') id: string,
    @Body() dto: CancelAdmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.cancelAdmission(id, dto, user?.id);
  }

  // =========================================================================
  // 5. BED TRANSFER
  // =========================================================================

  @Post('admissions/:id/transfer')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.INPATIENT_TRANSFER)
  @ApiOperation({ summary: 'Transfer patient to a different bed/ward with concurrency protection' })
  async transferBed(
    @Param('id') id: string,
    @Body() dto: TransferBedDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.transferBed(id, dto, user?.id);
  }

  // =========================================================================
  // 6. DISCHARGE WORKFLOW
  // =========================================================================

  @Post('admissions/:id/discharge/request')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.INPATIENT_DISCHARGE)
  @ApiOperation({ summary: 'Request discharge and prepare clinical summary' })
  async requestDischarge(
    @Param('id') id: string,
    @Body() dto: RequestDischargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.requestDischarge(id, dto, user?.id);
  }

  @Post('admissions/:id/discharge/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.INPATIENT_DISCHARGE)
  @ApiOperation({ summary: 'Complete discharge, release bed to CLEANING, and reconcile folio' })
  async completeDischarge(
    @Param('id') id: string,
    @Body() dto: CompleteDischargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.completeDischarge(id, dto, user?.id);
  }

  // =========================================================================
  // 7. INPATIENT ADMISSION FOLIO & CHARGES
  // =========================================================================

  @Get('admissions/:id/folio')
  @RequirePermissions(HospitalPermission.INPATIENT_FOLIO_VIEW)
  @ApiOperation({ summary: 'Get unified admission folio with itemized charges across all modules' })
  async getFolio(@Param('id') id: string) {
    return this.inpatientService.getFolio(id);
  }

  @Post('admissions/:id/folio/charges')
  @RequirePermissions(HospitalPermission.INPATIENT_CHARGE_POST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post manual clinical or service charge to inpatient folio' })
  async postFolioCharge(
    @Param('id') id: string,
    @Body() dto: PostFolioChargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.postCharge(id, dto, user?.id);
  }

  @Post('folio-items/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.INPATIENT_CHARGE_REVERSE)
  @ApiOperation({ summary: 'Reverse a posted folio charge with auditable reason' })
  async reverseFolioCharge(
    @Param('id') id: string,
    @Body() dto: ReverseFolioChargeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.reverseCharge(id, dto, user?.id);
  }

  @Post('admissions/:id/folio/settle')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.INPATIENT_CHARGE_POST)
  @ApiOperation({ summary: 'Record payment / deposit settlement against admission folio' })
  async settleFolio(
    @Param('id') id: string,
    @Body() dto: SettleFolioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inpatientService.settleFolio(id, dto, user?.id);
  }
}
