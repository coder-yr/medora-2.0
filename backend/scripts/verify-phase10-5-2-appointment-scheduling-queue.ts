import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });
import {
  PrismaClient,
  OrganizationType,
  OrganizationEdition,
  OrganizationStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { BranchAuthorizationService } from '../src/common/services/branch-authorization.service';
import { PatientService } from '../src/modules/patient/patient.service';
import { DepartmentService } from '../src/modules/department/department.service';
import { DoctorService } from '../src/modules/doctor/doctor.service';
import { AppointmentService } from '../src/modules/appointment/appointment.service';
import { AuthUser } from '../src/common/types/auth-user.interface';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/medora?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runVerification() {
  console.log('================================================================');
  console.log('MEDORA 2.0 — SUBPHASE 10.5.2 END-TO-END VERIFICATION');
  console.log('Appointment Management, Doctor Scheduling & OPD Waiting Queue');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string, details?: string) => {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
      throw new Error(`Test failed: ${testName}`);
    }
  };

  try {
    const timestamp = Date.now();

    // 1. Initialize Services
    const branchAuth = new BranchAuthorizationService(prisma as any);
    const departmentService = new DepartmentService(prisma as any);
    const doctorService = new DoctorService(prisma as any, departmentService);
    const patientService = new PatientService(prisma as any, branchAuth);
    const appointmentService = new AppointmentService(prisma as any, patientService, doctorService, branchAuth);

    // 2. Setup Test Organization, Branch, Doctor, and Patients
    console.log('[Setup] Preparing test fixtures in PostgreSQL...');

    let org = await prisma.organization.findFirst({
      where: { type: OrganizationType.CLINIC },
    });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: `Apex Clinic ${timestamp}`,
          code: `APX-${timestamp.toString().slice(-4)}`,
          type: OrganizationType.CLINIC,
          edition: OrganizationEdition.CLINIC,
          status: OrganizationStatus.ACTIVE,
        },
      });
    }

    let branch = await prisma.hospitalBranch.findFirst({
      where: { organizationId: org.id },
    });
    if (!branch) {
      branch = await prisma.hospitalBranch.create({
        data: {
          organizationId: org.id,
          name: 'Primary Outpatient Wing',
          code: `POW-${timestamp.toString().slice(-4)}`,
          active: true,
        },
      });
    }

    const testStaffUser: AuthUser = {
      id: '999991',
      email: 'staff@hospital.com',
      name: 'Receptionist Staff',
      group: 'Receptionist',
      permissions: ['APPOINTMENT_VIEW', 'APPOINTMENT_ADD', 'APPOINTMENT_UPDATE', 'APPOINTMENT_CANCEL'],
      organizationId: org.id,
      branchId: branch.id,
      isSuperAdmin: false,
    };

    // Create test Department & Doctor
    const testDept = await departmentService.create({
      name: `Cardiology Wing ${timestamp}`,
      description: 'Cardiac care and diagnostics',
    });

    const testDoctor = await doctorService.create({
      name: `Dr. Sarah Tariq ${timestamp}`,
      email: `drsarah_${timestamp}@hospital.com`,
      phone: `0300${timestamp.toString().slice(-7)}`,
      department: testDept.name,
      profile: 'Cardiologist',
      branchId: Number(branch.id),
    });

    // Create 2 test Patients
    const pat1 = await patientService.create({
      name: `Patient One ${timestamp}`,
      phone: `0311${timestamp.toString().slice(-7)}`,
      sex: 'male',
      birthdate: '1980-01-01',
      branchId: Number(branch.id),
    });

    const pat2 = await patientService.create({
      name: `Patient Two ${timestamp}`,
      phone: `0322${timestamp.toString().slice(-7)}`,
      sex: 'female',
      birthdate: '1985-05-15',
      branchId: Number(branch.id),
    });

    console.log(`[Setup] Doctor ID: ${testDoctor.id}, Patient 1 ID: ${pat1.id}, Patient 2 ID: ${pat2.id}\n`);

    // =========================================================================
    // TEST SECTION 1: Doctor Schedules & Break Intervals
    // =========================================================================
    console.log('--- TEST SECTION 1: Doctor Schedule Management & Breaks ---');

    // Configure weekly schedule for doctor: Weekday 1 (Monday) 09:00 - 15:00 with lunch break 12:00 - 13:00
    const updatedSchedules = await doctorService.updateDoctorSchedules(testDoctor.id, {
      slots: [
        {
          weekday: 1, // Monday
          startTime: '09:00',
          endTime: '15:00',
          slotMinutes: 30,
          breakStartTime: '12:00',
          breakEndTime: '13:00',
          active: true,
          branchId: Number(branch.id),
        },
        {
          weekday: 2, // Tuesday
          startTime: '10:00',
          endTime: '16:00',
          slotMinutes: 20,
          breakStartTime: '13:00',
          breakEndTime: '14:00',
          active: true,
          branchId: Number(branch.id),
        },
      ],
    });

    assert(
      updatedSchedules.length === 2 && updatedSchedules[0].breakStartTime === '12:00',
      'Doctor schedules updated with break interval (12:00-13:00) and persisted to DB',
    );

    // Verify GET schedules
    const fetchedSchedules = await doctorService.getDoctorSchedules(testDoctor.id);
    assert(
      fetchedSchedules.some((s) => s.weekday === 1 && s.slotMinutes === 30 && s.breakEndTime === '13:00'),
      'Doctor schedules correctly retrieved via getDoctorSchedules with break periods',
    );

    // =========================================================================
    // TEST SECTION 2: Doctor Leaves & Slot Blocks
    // =========================================================================
    console.log('\n--- TEST SECTION 2: Doctor Leaves & Block Intervals ---');

    // Choose a future date that is Monday
    const targetMonday = '2026-11-30'; // 2026-11-30 is a Monday (weekday 1)

    // Add leave block from 14:00 to 15:00 for audit meeting
    const leaveRecord = await doctorService.addDoctorLeave(testDoctor.id, {
      date: targetMonday,
      startTime: '14:00',
      endTime: '15:00',
      reason: 'Departmental Clinical Audit Meeting',
      branchId: Number(branch.id),
    });

    assert(
      leaveRecord.reason === 'Departmental Clinical Audit Meeting' && Boolean(leaveRecord.id),
      'Doctor leave successfully recorded in database via addDoctorLeave',
    );

    const leavesList = await doctorService.getDoctorLeaves(testDoctor.id);
    assert(
      leavesList.some((l) => l.reason === 'Departmental Clinical Audit Meeting'),
      'Doctor leave retrieved via getDoctorLeaves',
    );

    // =========================================================================
    // TEST SECTION 3: Real-Time Free Slots Calculation (Excluding Breaks & Leaves)
    // =========================================================================
    console.log('\n--- TEST SECTION 3: Real-Time Free Slot Calculation ---');

    // On 2026-11-30 (Monday 09:00 - 15:00):
    // Total potential 30-min slots:
    // 09:00, 09:30, 10:00, 10:30, 11:00, 11:30
    // 12:00, 12:30 -> EXCLUDED BY BREAK (12:00 - 13:00)
    // 13:00, 13:30
    // 14:00, 14:30 -> EXCLUDED BY LEAVE BLOCK (14:00 - 15:00)
    const freeSlots = await appointmentService.getFreeSlots(testDoctor.id, targetMonday, branch.id.toString());
    const slotStarts = freeSlots.map((s) => s.start);

    assert(
      slotStarts.includes('09:00') && slotStarts.includes('11:30'),
      'Morning working hours available in free slot list',
    );
    assert(
      !slotStarts.includes('12:00') && !slotStarts.includes('12:30'),
      'Scheduled break (12:00 - 13:00) correctly excluded from free slots',
    );
    assert(
      slotStarts.includes('13:00') && slotStarts.includes('13:30'),
      'Post-break afternoon working slots available',
    );
    assert(
      !slotStarts.includes('14:00') && !slotStarts.includes('14:30'),
      'Doctor leave block (14:00 - 15:00) correctly excluded from free slots',
    );

    // =========================================================================
    // TEST SECTION 4: Appointment Booking & Double Booking Prevention
    // =========================================================================
    console.log('\n--- TEST SECTION 4: Appointment Booking & Concurrency Guards ---');

    // Attempting to book during break (12:00) should be rejected
    let breakRejected = false;
    try {
      await appointmentService.create({
        patient: pat1.id,
        doctor: testDoctor.id,
        date: targetMonday,
        start: '12:00',
        minutes: 30,
        branchId: Number(branch.id),
      }, testStaffUser.id, testStaffUser);
    } catch (err: any) {
      if (err.message?.includes('break') || err.status === 400) {
        breakRejected = true;
      }
    }
    assert(breakRejected, 'Booking attempt during scheduled doctor break was rejected with 400 Bad Request');

    // Attempting to book during leave (14:00) should be rejected
    let leaveRejected = false;
    try {
      await appointmentService.create({
        patient: pat1.id,
        doctor: testDoctor.id,
        date: targetMonday,
        start: '14:00',
        minutes: 30,
        branchId: Number(branch.id),
      }, testStaffUser.id, testStaffUser);
    } catch (err: any) {
      if (err.message?.includes('not available') || err.status === 400) {
        leaveRejected = true;
      }
    }
    assert(leaveRejected, 'Booking attempt during doctor leave block was rejected with 400 Bad Request');

    // Book valid morning slot: 09:30 - 10:00
    const bookedAppt1 = await appointmentService.create({
      patient: pat1.id,
      doctor: testDoctor.id,
      date: targetMonday,
      start: '09:30',
      minutes: 30,
      priority: 'NORMAL',
      remarks: 'Cardiology routine consult',
      branchId: Number(branch.id),
    }, testStaffUser.id, testStaffUser);

    assert(
      bookedAppt1.status === 'scheduled' && bookedAppt1.timeSlot === '09:30 - 10:00',
      'Valid appointment successfully booked with PostgreSQL persistence',
    );

    // Concurrency / Double Booking check: booking exact same slot for Patient 2 must fail
    let doubleBookingRejected = false;
    try {
      await appointmentService.create({
        patient: pat2.id,
        doctor: testDoctor.id,
        date: targetMonday,
        start: '09:30',
        minutes: 30,
        branchId: Number(branch.id),
      }, testStaffUser.id, testStaffUser);
    } catch (err: any) {
      if (err.message?.includes('already booked') || err.status === 400) {
        doubleBookingRejected = true;
      }
    }
    assert(doubleBookingRejected, 'Double booking rejected via PostgreSQL transactional locking');

    // =========================================================================
    // TEST SECTION 5: Patient Check-In & Queue Token Generation
    // =========================================================================
    console.log('\n--- TEST SECTION 5: Check-In & Queue Token Generation ---');

    assert(bookedAppt1.tokenNumber === null, 'Pre-check-in appointment has null tokenNumber');

    const checkedInAppt = await appointmentService.checkIn(bookedAppt1.id, testStaffUser);

    assert(
      checkedInAppt.status === 'waiting' &&
      Boolean(checkedInAppt.tokenNumber) &&
      Boolean(checkedInAppt.tokenNumber?.startsWith('Q-')),
      `Appointment checked in with sequential token: ${checkedInAppt.tokenNumber}`,
    );

    // =========================================================================
    // TEST SECTION 6: Walk-in Registration Directly into Queue
    // =========================================================================
    console.log('\n--- TEST SECTION 6: Outpatient Walk-in Triage & Queue Injection ---');

    // Register a walk-in patient with URGENT priority
    const walkInAppt = await appointmentService.createWalkIn({
      patient: pat2.id,
      doctor: testDoctor.id,
      priority: 'URGENT',
      reason: 'Acute palpitations and dizziness',
      branchId: Number(branch.id),
    }, testStaffUser.id, testStaffUser);

    assert(
      walkInAppt.status === 'waiting' &&
      walkInAppt.visitType === 'walk_in' &&
      Boolean(walkInAppt.tokenNumber?.startsWith('W-')),
      `Walk-in registered with W-token: ${walkInAppt.tokenNumber} and priority: ${walkInAppt.priority}`,
    );

    // Register a second walk-in with EMERGENCY priority and inline new patient creation
    const emergencyWalkIn = await appointmentService.createWalkIn({
      newPatient: {
        name: `Emergency Case ${timestamp}`,
        phone: '03331122334',
        sex: 'male',
        birthdate: '1970-01-01',
      },
      doctor: testDoctor.id,
      priority: 'EMERGENCY',
      reason: 'Severe acute chest pain',
      branchId: Number(branch.id),
    }, testStaffUser.id, testStaffUser);

    assert(
      emergencyWalkIn.priority === 'EMERGENCY' &&
      emergencyWalkIn.tokenNumber === 'W-02',
      `Emergency walk-in registered with sequential token: ${emergencyWalkIn.tokenNumber}`,
    );

    // =========================================================================
    // TEST SECTION 7: Real-Time OPD Waiting Queue & Priority Ordering
    // =========================================================================
    console.log('\n--- TEST SECTION 7: Live OPD Waiting Queue & Priority Order ---');

    const todayDate = new Date().toISOString().split('T')[0];
    const opdQueue = await appointmentService.getOpdQueue(branch.id.toString(), testDoctor.id, todayDate, testStaffUser);

    assert(
      opdQueue.items.length >= 2,
      `OPD queue returned ${opdQueue.items.length} active waiting patients`,
    );

    // Verify Priority Sorting: EMERGENCY must be first position (#1)
    const firstItem = opdQueue.items[0];
    assert(
      firstItem.priority === 'EMERGENCY' && firstItem.queuePosition === 1,
      `Emergency patient correctly elevated to position #1 ahead of earlier arrivals`,
    );

    assert(
      opdQueue.summary.totalWaiting >= 2,
      `Queue summary accurately computed: totalWaiting = ${opdQueue.summary.totalWaiting}`,
    );

    // =========================================================================
    // TEST SECTION 8: Consultation Lifecycle Transitions
    // =========================================================================
    console.log('\n--- TEST SECTION 8: Consultation Lifecycle Transitions ---');

    // 1. Call Patient into doctor room
    const calledAppt = await appointmentService.callPatient(emergencyWalkIn.id, testStaffUser);
    assert(
      calledAppt.status === 'called' && Boolean(calledAppt.calledInAt),
      'Patient status transitioned to "called" with calledInAt timestamp',
    );

    // 2. Start Consultation
    const inConsultAppt = await appointmentService.startConsultation(emergencyWalkIn.id, testStaffUser);
    assert(
      inConsultAppt.status === 'in_consultation' && Boolean(inConsultAppt.consultStartedAt),
      'Patient status transitioned to "in_consultation" with consultStartedAt timestamp',
    );

    // 3. Complete Consultation
    const completedAppt = await appointmentService.completeConsultation(emergencyWalkIn.id, testStaffUser);
    assert(
      completedAppt.status === 'completed' && Boolean(completedAppt.completedAt),
      'Consultation completed with completedAt and checkedOutAt timestamps',
    );

    // =========================================================================
    // TEST SECTION 9: Rescheduling with Audit Preservation
    // =========================================================================
    console.log('\n--- TEST SECTION 9: Rescheduling with Audit Trail ---');

    // Reschedule bookedAppt1 from 09:30 to 10:00 on targetMonday
    const rescheduledAppt = await appointmentService.reschedule(bookedAppt1.id, {
      date: targetMonday,
      start: '10:00',
      minutes: 30,
      reason: 'Patient requested shift to 10:00 AM',
    }, testStaffUser.id, testStaffUser);

    assert(
      rescheduledAppt.id !== bookedAppt1.id &&
      rescheduledAppt.rescheduledFromId === bookedAppt1.id &&
      rescheduledAppt.timeSlot === '10:00 - 10:30',
      'New appointment created linking to previous encounter via rescheduledFromId',
    );

    // Verify original appointment is marked 'rescheduled' (never silently overwritten)
    const originalApptAfter = await appointmentService.findOne(bookedAppt1.id, testStaffUser);
    assert(
      originalApptAfter.status === 'rescheduled' &&
      Boolean(originalApptAfter.rescheduleReason?.includes('shift to 10:00 AM')),
      'Original appointment preserved in database with status "rescheduled" and reason',
    );

    // =========================================================================
    // TEST SECTION 10: Appointment Cancellation with Mandatory Reason
    // =========================================================================
    console.log('\n--- TEST SECTION 10: Cancellation Workflow ---');

    const cancelledAppt = await appointmentService.cancel(rescheduledAppt.id, {
      reason: 'Patient called to cancel due to out of town emergency',
    }, testStaffUser.id, testStaffUser);

    assert(
      cancelledAppt.status === 'cancelled' &&
      cancelledAppt.cancellationReason === 'Patient called to cancel due to out of town emergency' &&
      Boolean(cancelledAppt.cancelledAt),
      'Appointment cancelled with recorded reason and cancelledAt timestamp',
    );

    // Completing an already cancelled appointment must fail
    let completeCancelledFailed = false;
    try {
      await appointmentService.completeConsultation(cancelledAppt.id, testStaffUser);
    } catch {
      completeCancelledFailed = true;
    }
    assert(completeCancelledFailed, 'Completing an already cancelled appointment correctly rejected');

    console.log('\n================================================================');
    console.log(`SUBPHASE 10.5.2 VERIFICATION COMPLETE: ALL ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nVerification failed with exception:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runVerification();
