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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import {
  DepartmentAdoptResultDto,
  DepartmentListResponseDto,
  DepartmentResponseDto,
  DepartmentUpdateResultDto,
} from './dto/department-response.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @RequirePermissions(HospitalPermission.DEPARTMENT_VIEW)
  @ApiOperation({
    summary: 'List departments with usage metrics and unlisted specialties',
    description:
      'Returns the full department catalogue ordered alphabetically, showing active doctor counts and unlisted departments used by doctors.',
  })
  @ApiResponse({ status: 200, type: DepartmentListResponseDto })
  async findAll(): Promise<DepartmentListResponseDto> {
    return this.departmentService.findAll();
  }

  @Post('adopt')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.DEPARTMENT_ADD)
  @ApiOperation({
    summary: 'Adopt unlisted departments referenced by doctors',
    description:
      'Finds all department names currently assigned to doctors that are missing from the formal catalogue and creates them automatically.',
  })
  @ApiResponse({ status: 200, type: DepartmentAdoptResultDto })
  async adopt(): Promise<DepartmentAdoptResultDto> {
    return this.departmentService.adopt();
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.DEPARTMENT_VIEW)
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiParam({ name: 'id', description: 'Department database ID' })
  @ApiResponse({ status: 200, type: DepartmentResponseDto })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(@Param('id') id: string): Promise<DepartmentResponseDto> {
    return this.departmentService.findById(id);
  }

  @Post()
  @RequirePermissions(HospitalPermission.DEPARTMENT_ADD)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a new hospital department',
    description: 'Enforces unique name validation and registers the clinical department.',
  })
  @ApiResponse({ status: 201, type: DepartmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failure or duplicate name' })
  async create(@Body() dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    return this.departmentService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(HospitalPermission.DEPARTMENT_UPDATE)
  @ApiOperation({
    summary: 'Update department and cascade rename to doctors',
    description:
      'Updates department details. If renamed, automatically and atomically cascades the new name to all assigned doctors.',
  })
  @ApiParam({ name: 'id', description: 'Department database ID' })
  @ApiResponse({ status: 200, type: DepartmentUpdateResultDto })
  @ApiResponse({ status: 400, description: 'Validation failure or duplicate name' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentUpdateResultDto> {
    return this.departmentService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.DEPARTMENT_DELETE)
  @ApiOperation({
    summary: 'Remove an unused department',
    description:
      'Deletes a department from the catalogue. Rejects deletion if any doctors currently belong to it.',
  })
  @ApiParam({ name: 'id', description: 'Department database ID' })
  @ApiResponse({ status: 200, description: 'Department successfully deleted' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete: doctors currently assigned to department',
  })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.departmentService.remove(id);
  }
}
