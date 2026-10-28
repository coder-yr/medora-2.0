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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PaginatedPatientsDto, PatientResponseDto } from './dto/patient-response.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientService } from './patient.service';

@ApiTags('Patient Registry & Demographics')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
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
  async findAll(@Query() query: PatientQueryDto): Promise<PaginatedPatientsDto> {
    return this.patientService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.PATIENT_VIEW)
  @ApiOperation({ summary: 'Retrieve patient demographics by ID or 6-digit patient_id' })
  @ApiResponse({ status: 200, type: PatientResponseDto, description: 'Patient details' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async findOne(@Param('id') id: string): Promise<PatientResponseDto> {
    return this.patientService.findById(id);
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
  async create(@Body() createPatientDto: CreatePatientDto): Promise<PatientResponseDto> {
    return this.patientService.create(createPatientDto);
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
  ): Promise<PatientResponseDto> {
    return this.patientService.update(id, updatePatientDto);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.PATIENT_DELETE)
  @ApiOperation({ summary: 'Remove a patient record' })
  @ApiResponse({ status: 200, description: 'Patient record removed' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.patientService.remove(id);
  }
}
