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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import { DoctorResponseDto, PaginatedDoctorsDto } from './dto/doctor-response.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@ApiTags('Doctors')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('doctors')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get()
  @RequirePermissions(HospitalPermission.DOCTOR_VIEW)
  @ApiOperation({
    summary: 'List doctors with single-box search and upcoming appointment load',
    description:
      'Returns paginated doctors ordered alphabetically with upcoming appointment counts. Supports single-box search matching name, department, phone, or email.',
  })
  @ApiResponse({ status: 200, type: PaginatedDoctorsDto })
  async findAll(@Query() query: DoctorQueryDto): Promise<PaginatedDoctorsDto> {
    return this.doctorService.findAll(query);
  }

  @Get('departments')
  @RequirePermissions(HospitalPermission.DOCTOR_VIEW)
  @ApiOperation({
    summary: 'Get department suggestion list for doctor registration',
    description:
      'Merges active department catalogue entries with any legacy department strings on doctor records.',
  })
  @ApiResponse({ status: 200, type: [String] })
  async getDepartments(): Promise<string[]> {
    return this.doctorService.getDepartmentSuggestions();
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.DOCTOR_VIEW)
  @ApiOperation({ summary: 'Get doctor details by ID' })
  @ApiParam({ name: 'id', description: 'Doctor database ID' })
  @ApiResponse({ status: 200, type: DoctorResponseDto })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async findOne(@Param('id') id: string): Promise<DoctorResponseDto> {
    return this.doctorService.findById(id);
  }

  @Post()
  @RequirePermissions(HospitalPermission.DOCTOR_ADD)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a new doctor to the register',
    description:
      'Registers a doctor with only name required. Email is unique if provided. Optionally provisions a staff portal sign-in account.',
  })
  @ApiResponse({ status: 201, type: DoctorResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email/username' })
  async create(@Body() dto: CreateDoctorDto): Promise<DoctorResponseDto> {
    return this.doctorService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(HospitalPermission.DOCTOR_UPDATE)
  @ApiOperation({
    summary: 'Update doctor record',
    description:
      'Updates doctor profile information. Enforces email uniqueness excluding the current doctor record.',
  })
  @ApiParam({ name: 'id', description: 'Doctor database ID' })
  @ApiResponse({ status: 200, type: DoctorResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateDoctorDto): Promise<DoctorResponseDto> {
    return this.doctorService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.DOCTOR_DELETE)
  @ApiOperation({
    summary: 'Remove doctor from register',
    description:
      'Deletes doctor. Rejects deletion if appointments exist on file to protect clinical record integrity.',
  })
  @ApiParam({ name: 'id', description: 'Doctor database ID' })
  @ApiResponse({ status: 200, description: 'Doctor record removed' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete: doctor has appointments on file, so the record stays.',
  })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.doctorService.remove(id);
  }
}
