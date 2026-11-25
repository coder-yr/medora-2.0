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
import { ClinicalAccessGuard } from '../../common/guards/clinical-access.guard';
import { ProtectClinicalAccess } from '../../common/decorators/clinical-access.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.interface';
import { AppointmentService } from './appointment.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import {
  AppointmentResponseDto,
  FreeSlotDto,
  PaginatedAppointmentsDto,
} from './dto/appointment-response.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { WalkInAppointmentDto } from './dto/walk-in-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { OpdQueueResponseDto } from './dto/queue-response.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, ClinicalAccessGuard)
@ProtectClinicalAccess()
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(HospitalPermission.APPOINTMENT_ADD)
  @ApiOperation({
    summary: 'Book a new appointment',
    description:
      'Creates an outpatient appointment with double-booking prevention, doctor clinic schedule verification, and optional Jitsi telemedicine room generation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment booked successfully.',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failure, scheduling clash, doctor unavailable, or missing referenced patient/doctor.',
  })
  async create(
    @Body() dto: CreateAppointmentDto,
    @Request() req: any,
  ): Promise<AppointmentResponseDto> {
    const userId = req.user?.id || req.user?.username || '';
    return this.appointmentService.create(dto, userId, req.user);
  }

  @Post('walk-in')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(HospitalPermission.APPOINTMENT_ADD)
  @ApiOperation({
    summary: 'Register a walk-in patient directly into the OPD waiting queue',
    description:
      'Creates a walk-in encounter with automatic sequential token generation, immediate queue check-in, and optional inline patient creation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Walk-in registered and added to queue successfully.',
    type: AppointmentResponseDto,
  })
  async createWalkIn(
    @Body() dto: WalkInAppointmentDto,
    @Request() req: any,
  ): Promise<AppointmentResponseDto> {
    const userId = req.user?.id || req.user?.username || '';
    return this.appointmentService.createWalkIn(dto, userId, req.user);
  }

  @Get('queue')
  @RequirePermissions(HospitalPermission.APPOINTMENT_VIEW)
  @ApiOperation({
    summary: 'Get operational real-time OPD waiting queue',
    description:
      'Returns active waiting, called, and in-consultation patients ordered by clinical priority and check-in time with computed wait durations and summary metrics.',
  })
  @ApiQuery({ name: 'branchId', required: false, example: '1' })
  @ApiQuery({ name: 'doctorId', required: false, example: '1' })
  @ApiQuery({ name: 'date', required: false, example: '2026-11-23' })
  @ApiResponse({
    status: 200,
    description: 'OPD queue data and metrics.',
    type: OpdQueueResponseDto,
  })
  async getOpdQueue(
    @Query('branchId') branchId: string | undefined,
    @Query('doctorId') doctorId: string | undefined,
    @Query('date') date: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<OpdQueueResponseDto> {
    return this.appointmentService.getOpdQueue(branchId, doctorId, date, user);
  }

  @Get('free-slots')
  @RequirePermissions(HospitalPermission.APPOINTMENT_VIEW)
  @ApiOperation({
    summary: 'Query available consultation slots for a doctor on a specific date',
    description:
      'Generates free booking slots from the weekly clinic schedule, subtracting existing appointments, scheduled breaks, and blocked leaves.',
  })
  @ApiQuery({ name: 'doctor', required: false, example: '1' })
  @ApiQuery({ name: 'doctorId', required: false, example: '1' })
  @ApiQuery({ name: 'date', required: true, example: '2026-10-01' })
  @ApiQuery({ name: 'branchId', required: false, example: '1' })
  @ApiResponse({
    status: 200,
    description: 'List of available consultation start times and durations.',
    type: [FreeSlotDto],
  })
  async getFreeSlots(
    @Query('doctor') doctor: string | number | undefined,
    @Query('doctorId') doctorId: string | number | undefined,
    @Query('date') date: string,
    @Query('branchId') branchId?: string | number,
  ): Promise<FreeSlotDto[]> {
    const doc = doctor || doctorId;
    if (!doc || !date) {
      return [];
    }
    return this.appointmentService.getFreeSlots(doc, date, branchId);
  }

  @Get()
  @RequirePermissions(HospitalPermission.APPOINTMENT_VIEW)
  @ApiOperation({
    summary: 'List appointments (Front-Desk Day View)',
    description:
      'Lists appointments ordered by start time for daily outpatient management, filterable by date, doctor, patient, and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of appointments for the selected date.',
    type: PaginatedAppointmentsDto,
  })
  async findAll(
    @Query() query: AppointmentQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedAppointmentsDto> {
    return this.appointmentService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(HospitalPermission.APPOINTMENT_VIEW)
  @ApiOperation({
    summary: 'Get appointment details by ID',
    description:
      'Returns the full clinical and scheduling record, including patient summary, doctor details, vitals, and telemedicine URL if video visit.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Appointment details found.',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Appointment not found.' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions(HospitalPermission.APPOINTMENT_UPDATE)
  @ApiOperation({
    summary: 'Update or reschedule an appointment',
    description:
      'Updates appointment status, vitals, remarks, or start time with schedule and overlap clash checks.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Appointment updated successfully.',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or time clash with an existing booking.',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.update(id, dto, user);
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_UPDATE)
  @ApiOperation({
    summary: 'Check in a patient for their appointment',
    description: 'Generates an OPD queue token and updates status to waiting.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Patient checked in successfully.',
    type: AppointmentResponseDto,
  })
  async checkIn(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.checkIn(id, user);
  }

  @Post(':id/call')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_UPDATE)
  @ApiOperation({
    summary: 'Call a patient into the doctor room',
    description: 'Updates appointment status to called.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Patient marked as called.',
    type: AppointmentResponseDto,
  })
  async callPatient(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.callPatient(id, user);
  }

  @Post(':id/start-consultation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_UPDATE)
  @ApiOperation({
    summary: 'Start doctor consultation',
    description: 'Updates appointment status to in_consultation.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Consultation marked as started.',
    type: AppointmentResponseDto,
  })
  async startConsultation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.startConsultation(id, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_UPDATE)
  @ApiOperation({
    summary: 'Complete consultation',
    description: 'Updates appointment status to completed and records checkout time.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Consultation marked as completed.',
    type: AppointmentResponseDto,
  })
  async completeConsultation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.completeConsultation(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_CANCEL)
  @ApiOperation({
    summary: 'Cancel an appointment with reason',
    description: 'Updates appointment status to cancelled and preserves cancellation reason.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Appointment cancelled.',
    type: AppointmentResponseDto,
  })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const userId = user?.id || '';
    return this.appointmentService.cancel(id, dto, userId, user);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_UPDATE)
  @ApiOperation({
    summary: 'Reschedule an appointment',
    description: 'Marks original appointment as rescheduled and creates a linked new appointment.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Appointment rescheduled and new appointment created.',
    type: AppointmentResponseDto,
  })
  async reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AppointmentResponseDto> {
    const userId = user?.id || '';
    return this.appointmentService.reschedule(id, dto, userId, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(HospitalPermission.APPOINTMENT_CANCEL)
  @ApiOperation({
    summary: 'Remove an appointment',
    description: 'Deletes an appointment record matching legacy behavior.',
  })
  @ApiParam({ name: 'id', description: 'Appointment numeric ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Appointment deleted successfully.',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found.' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    return this.appointmentService.remove(id, user);
  }
}
