import { ApiProperty } from '@nestjs/swagger';

export class DoctorDashboardSummaryDto {
  @ApiProperty({ example: 8 })
  todayAppointments!: number;

  @ApiProperty({ example: 3 })
  waitingPatients!: number;

  @ApiProperty({ example: 1 })
  calledPatients!: number;

  @ApiProperty({ example: 1 })
  activeConsultations!: number;

  @ApiProperty({ example: 4 })
  completedConsultations!: number;

  @ApiProperty({ example: 2 })
  pendingDrafts!: number;

  @ApiProperty({ example: 1, description: 'Patients with critical alerts such as known severe allergies or emergency priority' })
  criticalAlertsCount!: number;

  @ApiProperty({ description: 'Active OPD queue items for this doctor' })
  queue!: any[];

  @ApiProperty({ description: 'Draft consultations pending review and completion' })
  drafts!: any[];
}
