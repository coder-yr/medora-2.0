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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConsultationService } from './consultation.service';
import { CreateConsultTemplateDto } from './dto/consult-template.dto';
import { ConsultationQueryDto } from './dto/consultation-query.dto';
import {
  ConsultTemplateResponseDto,
  ConsultationResponseDto,
  PaginatedConsultationsDto,
  VisitConsultationContextDto,
} from './dto/consultation-response.dto';
import { SaveConsultationDto } from './dto/save-consultation.dto';

@ApiTags('Consultations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('consultations')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @Get()
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  @ApiOperation({
    summary: 'List outpatient consultations',
    description:
      'Returns a paginated list of consultations, filterable by date, doctor, patient, and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of consultations.',
    type: PaginatedConsultationsDto,
  })
  async findAll(
    @Query() query: ConsultationQueryDto,
  ): Promise<PaginatedConsultationsDto> {
    return this.consultationService.findAll(query);
  }

  @Get('templates')
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  @ApiOperation({
    summary: 'List available consultation templates',
    description:
      'Returns reusable note templates for the current doctor or hospital-wide.',
  })
  @ApiQuery({ name: 'doctor', required: false, example: '1' })
  @ApiResponse({
    status: 200,
    description: 'List of consultation templates.',
    type: [ConsultTemplateResponseDto],
  })
  async listTemplates(
    @Query('doctor') doctorId?: string,
  ): Promise<ConsultTemplateResponseDto[]> {
    return this.consultationService.listTemplates(doctorId);
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  @ApiOperation({
    summary: 'Create a reusable consultation note template',
    description: 'Saves text sections as a named template for quick clinical entry.',
  })
  @ApiResponse({
    status: 201,
    description: 'Template created successfully.',
    type: ConsultTemplateResponseDto,
  })
  async createTemplate(
    @Body() dto: CreateConsultTemplateDto,
  ): Promise<ConsultTemplateResponseDto> {
    return this.consultationService.createTemplate(dto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  @ApiOperation({
    summary: 'Delete a consultation note template',
    description: 'Removes a saved clinical note template.',
  })
  @ApiParam({ name: 'id', description: 'Template ID', example: '1' })
  @ApiResponse({ status: 200, description: 'Template deleted.' })
  async removeTemplate(@Param('id') id: string): Promise<{ message: string }> {
    return this.consultationService.removeTemplate(id);
  }

  @Get('visit/:appointmentId')
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  @ApiOperation({
    summary: 'Get or initialize the consultation workspace for a visit',
    description:
      'Pre-populates the encounter workspace with carry-forward allergies and past history from the patient\'s last visit, vitals, last 5 consultations, and available templates.',
  })
  @ApiParam({ name: 'appointmentId', description: 'Appointment visit ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Visit consultation context loaded.',
    type: VisitConsultationContextDto,
  })
  @ApiResponse({ status: 404, description: 'Visit or patient not found.' })
  async getVisitContext(
    @Param('appointmentId') appointmentId: string,
  ): Promise<VisitConsultationContextDto> {
    return this.consultationService.getVisitContext(appointmentId);
  }

  @Post('visit/:appointmentId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.CONSULTATION_ADD)
  @ApiOperation({
    summary: 'Save or complete outpatient consultation note',
    description:
      'Records physical examination, diagnosis, plan, obstetric dates, specialty notes, updates visit vitals, transitions appointment status, and optionally saves reusable templates.',
  })
  @ApiParam({ name: 'appointmentId', description: 'Appointment visit ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Consultation saved or completed.',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Visit or patient not found.' })
  async saveVisitConsultation(
    @Param('appointmentId') appointmentId: string,
    @Body() dto: SaveConsultationDto,
    @Request() req: any,
  ): Promise<ConsultationResponseDto> {
    const userId = req.user?.id || req.user?.username || '';
    return this.consultationService.saveVisitConsultation(appointmentId, dto, userId);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  @ApiOperation({
    summary: 'Get single consultation details',
    description: 'Retrieves complete consultation record with patient, doctor, and encounter info.',
  })
  @ApiParam({ name: 'id', description: 'Consultation numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Consultation details found.',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Consultation not found.' })
  async findOne(@Param('id') id: string): Promise<ConsultationResponseDto> {
    return this.consultationService.findOne(id);
  }

  @Get(':id/print')
  @RequirePermissions(HospitalPermission.CONSULTATION_VIEW)
  @ApiOperation({
    summary: 'Printable consultation summary',
    description: 'Formatted clinical summary for discharge summary or medical printout.',
  })
  @ApiParam({ name: 'id', description: 'Consultation numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Printable consultation data.',
    type: ConsultationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Consultation not found.' })
  async printout(@Param('id') id: string): Promise<ConsultationResponseDto> {
    return this.consultationService.printout(id);
  }
}
