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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import {
  MedicineSearchResultDto,
  PaginatedPrescriptionsDto,
  PrescriptionResponseDto,
} from './dto/prescription-response.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionService } from './prescription.service';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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
  ): Promise<PaginatedPrescriptionsDto> {
    return this.prescriptionService.findAll(query);
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
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.findById(id);
  }

  @Post()
  @RequirePermissions(HospitalPermission.PRESCRIPTION_ADD)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new prescription',
    description:
      'Creates a new prescription record with relational line items, validating that at least one valid medication is prescribed and maintaining the legacy summary column.',
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
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.create(dto);
  }

  @Put(':id')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_UPDATE)
  @ApiOperation({
    summary: 'Update prescription',
    description:
      'Updates prescription header details and replaces line items wholesale, keeping the legacy summary in sync.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription updated successfully.',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Prescription not found.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    return this.prescriptionService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.PRESCRIPTION_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete prescription',
    description: 'Removes a prescription and its medication items. Restricted to administrative users.',
  })
  @ApiParam({ name: 'id', description: 'Prescription database ID' })
  @ApiResponse({
    status: 200,
    description: 'Prescription deleted successfully.',
  })
  @ApiResponse({ status: 404, description: 'Prescription not found.' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.prescriptionService.remove(id);
  }
}
