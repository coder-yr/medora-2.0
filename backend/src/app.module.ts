import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './common/config/configuration';
import { validateEnv } from './common/config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { BranchAccessGuard } from './common/guards/branch-access.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConsultationModule } from './modules/consultation/consultation.module';
import { DepartmentModule } from './modules/department/department.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { HealthModule } from './modules/health/health.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { PatientModule } from './modules/patient/patient.module';
import { PrescriptionModule } from './modules/prescription/prescription.module';
import { MedicineModule } from './modules/medicine/medicine.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { RadiologyModule } from './modules/radiology/radiology.module';
import { InpatientModule } from './modules/inpatient/inpatient.module';
import { CashierModule } from './modules/cashier/cashier.module';
import { StaffModule } from './modules/staff/staff.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { HospitalSettingsModule } from './modules/hospital-settings/hospital-settings.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // 100 requests per minute general rate limit
      },
    ]),
    PrismaModule,
    AuthModule,
    HealthModule,
    PatientModule,
    DepartmentModule,
    DoctorModule,
    AppointmentModule,
    ConsultationModule,
    InvoiceModule,
    PrescriptionModule,
    MedicineModule,
    PharmacyModule,
    LaboratoryModule,
    RadiologyModule,
    InpatientModule,
    CashierModule,
    StaffModule,
    AccountingModule,
    HospitalSettingsModule,
    NotificationModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    Reflector,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BranchAccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
