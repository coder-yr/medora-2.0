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
import { AppointmentService } from './appointment.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import {
  AppointmentResponseDto,
  FreeSlotDto,
  PaginatedAppointmentsDto,
} from './dto/appointment-response.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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
    return this.appointmentService.create(dto, userId);
  }

  @Get('free-slots')
  @RequirePermissions(HospitalPermission.APPOINTMENT_VIEW)
  @ApiOperation({
    summary: 'Query available consultation slots for a doctor on a specific date',
    description:
      'Generates free booking slots from the weekly clinic schedule, subtracting existing appointments and blocked leaves.',
  })
  @ApiQuery({ name: 'doctor', required: true, example: '1' })
  @ApiQuery({ name: 'date', required: true, example: '2026-10-01' })
  @ApiResponse({
    status: 200,
    description: 'List of available consultation start times and durations.',
    type: [FreeSlotDto],
  })
  async getFreeSlots(
    @Query('doctor') doctor: string | number,
    @Query('date') date: string,
  ): Promise<FreeSlotDto[]> {
    return this.appointmentService.getFreeSlots(doctor, date);
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
  ): Promise<PaginatedAppointmentsDto> {
    return this.appointmentService.findAll(query);
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
  async findOne(@Param('id') id: string): Promise<AppointmentResponseDto> {
    return this.appointmentService.findOne(id);
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
  ): Promise<AppointmentResponseDto> {
    return this.appointmentService.update(id, dto);
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
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.appointmentService.remove(id);
  }
}
