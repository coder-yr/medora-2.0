import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DoctorSlotDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  branchId?: number | null;

  @ApiProperty({ example: 1, description: '0=Sunday, 1=Monday ... 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty({ example: '09:00', description: 'Start time (HH:mm)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @ApiProperty({ example: '17:00', description: 'End time (HH:mm)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;

  @ApiProperty({ example: 15, default: 15, description: 'Duration of each consultation slot in minutes' })
  @IsInt()
  @Min(5)
  @Max(120)
  slotMinutes!: number;

  @ApiPropertyOptional({ example: '13:00', description: 'Lunch or break start time (HH:mm)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  breakStartTime?: string | null;

  @ApiPropertyOptional({ example: '14:00', description: 'Lunch or break end time (HH:mm)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  breakEndTime?: string | null;

  @ApiProperty({ example: true, default: true })
  @IsBoolean()
  active!: boolean;
}

export class DoctorScheduleUpdateDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  branchId?: number;

  @ApiProperty({ type: [DoctorSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DoctorSlotDto)
  slots!: DoctorSlotDto[];
}

export class DoctorLeaveDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  id?: string;

  @ApiProperty({ example: '2026-11-25', description: 'Leave date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({ example: '09:00', description: 'Leave window start time (omit for all day)' })
  @IsOptional()
  startTime?: string | null;

  @ApiPropertyOptional({ example: '13:00', description: 'Leave window end time (omit for all day)' })
  @IsOptional()
  endTime?: string | null;

  @ApiPropertyOptional({ example: 'Attending Medical Conference' })
  @IsOptional()
  @IsString()
  reason?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  branchId?: number;
}
