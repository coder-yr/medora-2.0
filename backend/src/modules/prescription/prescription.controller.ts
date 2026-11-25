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
import { AuthUser } from '../../common/types/auth-user.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClinicalAccessGuard } from '../../common/guards/clinical-access.guard';
import { ProtectClinicalAccess } from '../../common/decorators/clinical-access.decorator';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import {
  MedicineSearchResultDto,
  PaginatedPrescriptionsDto,
  PrescriptionPrintoutDto,
  PrescriptionResponseDto,
} from './dto/prescription-response.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { SignPrescriptionDto } from './dto/sign-prescription.dto';
import { CancelPrescriptionDto } from './dto/cancel-prescription.dto';
import { AmendPrescriptionDto } from './dto/amend-prescription.dto';
import { PrescriptionService } from './prescription.service';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, ClinicalAccessGuard)
@ProtectClinicalAccess()
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Get('medicines/search')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_VIEW)
  @ApiOperation({
    summary: 'Search medicine catalog for prescribing',
    description: 'Returns available medicines from the hospital catalogue matching name, generic, or brand.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search term for medicine name or generic' })
  @ApiResponse({
    status: 200,
    description: 'Matching catalog medicines.',
    type: [MedicineSearchResultDto],
  })
  async searchMedicines(
    @Query('q') query: string = '',
  ): Promise<MedicineSearchResultDto[]> {
    return this.prescriptionService.searchMedicines(query);
  }

  @Get('pharmacy/queue')
  @RequirePermissions(HospitalPermission.PHARMACY_VIEW)
  @ApiOperation({
    summary: 'Get prescriptions in pharmacy dispensing queue',
    description: 'Returns prescriptions ready to be dispensed with status SIGNED or PARTIALLY_DISPENSED.',
  })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by Rx number, patient name, or MRN' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by prescription date' })
  async getPharmacyQueue(
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.prescriptionService.getPharmacyQueue({ branchId, search, date }, user);
  }

  @Get()
  @RequirePermissions(HospitalPermission.PRESCRIPTION_VIEW)
  @ApiOperation({
    summary: 'List prescriptions',
    description:
      'Returns a paginated list of prescriptions filterable by patient, doctor, and drug name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of prescriptions.',
    type: PaginatedPrescriptionsDto,
  })
  async findAll(
    @Query() query: PrescriptionQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedPrescriptionsDto> {
    return this.prescriptionService.findAll(query, user);
  }

  @Get(':id/print')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_VIEW)
  @ApiOperation({
    summary: 'Get printable prescription layout',
    description: 'Returns formatted clinical prescription along with clinic metadata and doctor credentials.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Printable prescription layout.',
    type: PrescriptionPrintoutDto,
  })
  async getPrintout(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionPrintoutDto> {
    return this.prescriptionService.getPrintout(id, user);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_VIEW)
  @ApiOperation({
    summary: 'Get prescription by ID',
    description: 'Retrieves a single prescription with patient, clinician, and medication line items.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription details.',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Prescription not found.' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.findById(id, user);
  }

  @Post()
  @RequirePermissions(HospitalPermission.PRESCRIPTION_ADD)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new prescription',
    description:
      'Creates a new prescription record with unique prescriptionNumber, allergy evaluation, and optional immediate signing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Prescription created successfully.',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or empty medication list.',
  })
  @ApiResponse({ status: 404, description: 'Patient or Doctor not found.' })
  async create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.create(dto, user);
  }

  @Post(':id/sign')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Digitally sign a prescription',
    description: 'Signs the prescription, records timestamp and clinician ID, and transitions status to SIGNED.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription signed successfully.',
    type: PrescriptionResponseDto,
  })
  async sign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignPrescriptionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.sign(id, dto, user);
  }

  @Post(':id/cancel')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a prescription',
    description: 'Cancels an active or signed prescription with a mandatory clinical reason.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription cancelled successfully.',
    type: PrescriptionResponseDto,
  })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPrescriptionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.cancel(id, dto, user);
  }

  @Post(':id/amend')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Amend a signed prescription',
    description: 'Records an immutable clinical amendment note on a signed prescription.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription amended successfully.',
    type: PrescriptionResponseDto,
  })
  async amend(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AmendPrescriptionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.amend(id, dto, user);
  }

  @Put(':id')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_UPDATE)
  @ApiOperation({
    summary: 'Update prescription (Draft only)',
    description:
      'Updates prescription header details and replaces line items. Enforces immutability on signed/dispensed prescriptions.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription updated successfully.',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Prescription is immutable or invalid input.' })
  @ApiResponse({ status: 404, description: 'Prescription not found.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrescriptionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete prescription (Draft only)',
    description: 'Removes a draft prescription. Signed and dispensed prescriptions cannot be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription deleted successfully.',
  })
  @ApiResponse({ status: 400, description: 'Cannot delete signed or dispensed prescription.' })
  @ApiResponse({ status: 404, description: 'Prescription not found.' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean; message: string }> {
    return this.prescriptionService.remove(id, user);
  }
}
