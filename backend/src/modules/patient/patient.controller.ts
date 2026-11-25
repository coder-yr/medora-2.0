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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProtectClinicalAccess } from '../../common/decorators/clinical-access.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ClinicalAccessGuard } from '../../common/guards/clinical-access.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PaginatedPatientsDto, PatientResponseDto } from './dto/patient-response.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CheckDuplicateQueryDto } from './dto/check-duplicate-query.dto';
import { DuplicateCheckResponseDto } from './dto/duplicate-check-response.dto';
import { PatientEncounterResponseDto } from './dto/patient-encounter-response.dto';
import { CreatePatientDocumentDto, PatientDocumentResponseDto } from './dto/patient-document.dto';
import { PatientService } from './patient.service';

@ApiTags('Patient Registry & Demographics')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, ClinicalAccessGuard)
@ProtectClinicalAccess()
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @ApiOperation({ summary: 'List patients with single-box search and pagination' })
  @ApiResponse({
    status: 200,
    type: PaginatedPatientsDto,
    description: 'Paginated patient directory',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: Missing patient_view permission' })
  async findAll(
    @Query() query: PatientQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedPatientsDto> {
    return this.patientService.findAll(query, user);
  }

  @Get('check-duplicates')
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @ApiOperation({ summary: 'Check for duplicate patient registrations by phone, CNIC, or name and birthdate' })
  @ApiResponse({
    status: 200,
    type: DuplicateCheckResponseDto,
    description: 'Duplicate detection check result',
  })
  async checkDuplicates(
    @Query() query: CheckDuplicateQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DuplicateCheckResponseDto> {
    return this.patientService.checkDuplicates(query, user);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @ApiOperation({ summary: 'Retrieve patient demographics by ID or 6-digit patient_id' })
  @ApiResponse({ status: 200, type: PatientResponseDto, description: 'Patient details' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PatientResponseDto> {
    return this.patientService.findById(id, user);
  }

  @Get(':id/encounters')
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @ApiOperation({ summary: 'Retrieve full outpatient clinical encounter history for a patient' })
  @ApiResponse({
    status: 200,
    type: PatientEncounterResponseDto,
    description: 'Aggregated clinical encounter history',
  })
  async getEncounters(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PatientEncounterResponseDto> {
    return this.patientService.getEncounterHistory(id, user);
  }

  @Get(':id/documents')
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @ApiOperation({ summary: 'Retrieve documents and external medical reports for a patient' })
  @ApiResponse({
    status: 200,
    type: [PatientDocumentResponseDto],
    description: 'Patient medical documents',
  })
  async getDocuments(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PatientDocumentResponseDto[]> {
    return this.patientService.getDocuments(id, user);
  }

  @Post(':id/documents')
  @RequirePermissions(HospitalPermission.PATIENT_UPDATE)
  @ApiOperation({ summary: 'Upload / attach a new document to a patient record' })
  @ApiResponse({
    status: 201,
    type: PatientDocumentResponseDto,
    description: 'Document attached successfully',
  })
  async addDocument(
    @Param('id') id: string,
    @Body() dto: CreatePatientDocumentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PatientDocumentResponseDto> {
    return this.patientService.addDocument(id, dto, user);
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions(HospitalPermission.PATIENT_DELETE)
  @ApiOperation({ summary: 'Remove an attached medical document' })
  @ApiResponse({ status: 200, description: 'Document removed' })
  async removeDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    return this.patientService.removeDocument(id, docId, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(HospitalPermission.PATIENT_ADD)
  @ApiOperation({ summary: 'Register a new patient with sequential MR number and derived age' })
  @ApiResponse({
    status: 201,
    type: PatientResponseDto,
    description: 'Patient registered successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed (missing name or invalid input)' })
  async create(
    @Body() createPatientDto: CreatePatientDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PatientResponseDto> {
    return this.patientService.create(createPatientDto, 'front desk', user);
  }

  @Put(':id')
  @RequirePermissions(HospitalPermission.PATIENT_UPDATE)
  @ApiOperation({ summary: 'Update patient demographics and re-derive age if birthdate changes' })
  @ApiResponse({
    status: 200,
    type: PatientResponseDto,
    description: 'Patient updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PatientResponseDto> {
    return this.patientService.update(id, updatePatientDto, user);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.PATIENT_DELETE)
  @ApiOperation({ summary: 'Remove a patient record' })
  @ApiResponse({ status: 200, description: 'Patient record removed' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    return this.patientService.remove(id, user);
  }
}
