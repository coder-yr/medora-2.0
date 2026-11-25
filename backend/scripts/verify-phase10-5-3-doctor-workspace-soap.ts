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
import { ConsultationService } from '../src/modules/consultation/consultation.service';
import { AuthUser } from '../src/common/types/auth-user.interface';
import { BadRequestException } from '@nestjs/common';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/medora?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runVerification() {
  console.log('================================================================');
  console.log('MEDORA 2.0 — SUBPHASE 10.5.3 LIVE POSTGRESQL E2E VERIFICATION');
  console.log('Doctor Workspace, Clinical Encounters & SOAP Documentation');
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
    const consultationService = new ConsultationService(prisma as any, patientService, doctorService, appointmentService, branchAuth);

    // 2. Setup Test Organization, Branch, Doctor, User, and Patient
    console.log('[Setup] Preparing test fixtures in PostgreSQL...');

    let org = await prisma.organization.findFirst({
      where: { name: 'Medora Clinical Operations Test Org' },
    });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: 'Medora Clinical Operations Test Org',
          code: `SOAP-${timestamp.toString().slice(-6)}`,
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
          name: 'Central OPD Clinic Branch',
          code: `CENTRAL-${timestamp.toString().slice(-4)}`,
          active: true,
        },
      });
    }

    let testUser = await prisma.user.findFirst({
      where: { login: 'dr.soap.specialist' },
    });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          login: 'dr.soap.specialist',
          email: 'dr.soap@medora.health',
          firstName: 'Ayesha',
          lastName: 'Rehman',
          password: 'Password123!',
          group: 'Doctor',
          branchId: branch.id,
        },
      });
    }

    let doctor = await prisma.doctor.findFirst({
      where: { name: 'Dr. Ayesha Rehman' },
    });
    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          name: 'Dr. Ayesha Rehman',
          email: `ayesha.${timestamp}@medora.health`,
          phone: `+92300${timestamp.toString().slice(-7)}`,
          department: 'Internal Medicine',
          ionUserId: testUser.id.toString(),
          branchId: branch.id,
        },
      });
    }

    const patient = await prisma.patient.create({
      data: {
        name: `Tariq Mehmood ${timestamp}`,
        patientId: `MRN-SOAP-${timestamp.toString().slice(-6)}`,
        birthdate: '1982-05-15',
        sex: 'Male',
        phone: `+92321${timestamp.toString().slice(-7)}`,
        bloodGroup: 'B+',
        emergencyContactName: 'Fatima Mehmood',
        emergencyContactPhone: '+923217654321',
        emergencyContactRelation: 'Spouse',
        allergies: 'Penicillin: severe urticaria and facial swelling',
        medicalHistory: JSON.stringify({ hypertension: 'Controlled on Amlodipine 5mg' }),
        branchId: branch.id,
      },
    });

    const todayStr = new Date().toISOString().split('T')[0];

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        branchId: branch.id,
        date: todayStr,
        timeSlot: '10:00 - 10:15',
        sTime: `${todayStr} 10:00:00`,
        eTime: `${todayStr} 10:15:00`,
        status: 'arrived',
        visitType: 'new_consultation',
        queueNumber: 1,
        remarks: 'Persistent dry cough and mild dyspnea on exertion',
      },
    });

    const doctorUser: AuthUser = {
      id: testUser.id.toString(),
      email: testUser.email,
      name: `${testUser.firstName} ${testUser.lastName}`,
      group: 'Doctor',
      permissions: ['consultation_view', 'consultation_add', 'appointment_view'],
      branchId: branch.id,
      organizationId: org.id,
      isSuperAdmin: false,
    };

    console.log('[Setup] Test fixtures created successfully.\n');

    // TEST 1: DOCTOR DASHBOARD & OPD QUEUE
    console.log('[Test Suite 1] Doctor Clinical Dashboard & Metrics');
    const dashboard = await consultationService.getDoctorDashboard(doctor.id.toString(), branch.id.toString(), doctorUser);

    assert(dashboard.todayAppointments >= 1, 'Dashboard computes todayAppointments >= 1');
    assert(dashboard.waitingPatients >= 1, 'Dashboard computes waitingPatients >= 1 for arrived appointment');
    assert(Array.isArray(dashboard.queue), 'Dashboard returns structured OPD queue array');
    const queueItem = dashboard.queue.find((q) => q.appointmentId === appointment.id.toString());
    assert(Boolean(queueItem), 'Active appointment appears in doctor OPD queue');
    assert(queueItem?.patientName === patient.name, 'Queue item correctly links patient demographic name');
    assert(queueItem?.mrn === patient.patientId, 'Queue item displays patient MRN');

    // TEST 2: VISIT CONTEXT & PRE-POPULATION
    console.log('\n[Test Suite 2] Visit Consultation Context & Pre-population');
    const context = await consultationService.getVisitConsultationContext(appointment.id.toString(), doctorUser);

    assert(Boolean(context.patient), 'Context loads patient summary correctly');
    assert(context.patient.name === patient.name, 'Context contains patient name');
    assert(context.visit.status === 'arrived', 'Context loads appointment visit status');
    assert(context.consultation.allergyStatus === 'ALLERGIES_RECORDED', 'Context detects active recorded allergies');
    assert(context.consultation.allergies?.includes('Penicillin') === true, 'Context pre-populates penicillin allergy');

    // TEST 3: STRUCTURED SOAP DOCUMENTATION & LIVE BMI
    console.log('\n[Test Suite 3] Structured SOAP Notes & Auto-Calculated BMI');
    // Height: 175 cm, Weight: 68 kg => BMI = 68 / (1.75^2) = 22.204 -> 22.2
    const savedDraft = await consultationService.saveVisitConsultation(
      appointment.id.toString(),
      {
        action: 'draft',
        presenting_complaint: 'Progressive dry cough and low-grade evening fever for 5 days',
        chief_complaint_details: {
          primary: 'Dry cough',
          onset: '5 days ago',
          duration: 'Continuous',
          severity: 'Moderate',
        },
        hpi_details: {
          progression: 'Worsening at night, disturbs sleep',
          relievingFactors: 'Warm tea',
          aggravatingFactors: 'Cold air',
        },
        soap_subjective: '42yo male reports 5-day history of non-productive cough. Denies hemoptysis, chest pain.',
        vitals: {
          height: 175,
          weight: 68,
          bp: '125/82',
          pulse: 74,
          respiratoryRate: 16,
          temperature: 99.1,
          oxygenSaturation: 98,
        },
        exam: {
          respiratory: { status: 'abnormal', note: 'Occasional end-expiratory rhonchi bilateral bases' },
          cardiovascular: { status: 'normal', note: 'S1 S2 normal, no murmurs' },
        },
        soap_objective: 'Vitals stable. SpO2 98% room air. Throat mild posterior pharyngeal erythema. Bilateral rhonchi.',
        diagnoses: [
          { type: 'PRIMARY', description: 'Acute Bronchitis', code: 'J20.9', status: 'CONFIRMED' },
          { type: 'SECONDARY', description: 'Essential Hypertension', code: 'I10', status: 'CONFIRMED' },
          { type: 'DIFFERENTIAL', description: 'Atypical Pneumonia', code: 'J15.9', status: 'PROVISIONAL' },
        ],
        soap_assessment: 'Acute bronchitis with mild bronchospasm. Differentials: atypical bacterial vs viral infection.',
        plan: '1. Oral hydration and steam inhalation\n2. Dextromethorphan syrup 10ml TDS\n3. Salbutamol inhaler 2 puffs PRN',
        soap_plan: 'Symptomatic therapy. Chest X-ray if symptoms do not improve in 48 hours.',
        treatment_plan: {
          patientEducation: 'Advised on red flag signs: high fever, shortness of breath, rust-colored sputum.',
          followUpAdvice: 'Review SOS or in 5 days for re-evaluation.',
        },
        follow_up_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        follow_up_notes: 'Re-evaluate auscultation and review CXR if performed.',
      },
      testUser.id.toString(),
      doctorUser,
    );

    assert(savedDraft.status === 'draft', 'Consultation saved with status = draft');
    assert(savedDraft.vitals?.bmi === '22.2', `BMI automatically calculated to 22.2 (got: ${savedDraft.vitals?.bmi})`);
    assert(savedDraft.soapSubjective?.includes('42yo male') === true, 'SOAP Subjective narrative persisted correctly');
    assert(savedDraft.soapObjective?.includes('SpO2 98%') === true, 'SOAP Objective narrative persisted correctly');
    assert(savedDraft.soapAssessment?.includes('Acute bronchitis') === true, 'SOAP Assessment narrative persisted correctly');
    assert(savedDraft.soapPlan?.includes('Symptomatic therapy') === true, 'SOAP Plan narrative persisted correctly');
    assert(Array.isArray(savedDraft.diagnoses) && savedDraft.diagnoses.length === 3, 'Structured diagnoses array stored (Primary, Secondary, Differential)');

    // Verify atomic appointment updates
    const updatedApt = await prisma.appointment.findUnique({
      where: { id: appointment.id },
    });
    assert(updatedApt?.status === 'in consultation', 'Appointment status transitioned to "in consultation"');
    assert(updatedApt?.bp === '125/82', 'Appointment BP synchronized atomically');
    assert(updatedApt?.pulse === '74', 'Appointment Pulse synchronized atomically');

    // TEST 4: CONSOLIDATED PATIENT CLINICAL CHART
    console.log('\n[Test Suite 4] Consolidated Patient Clinical Chart');
    const chart = await consultationService.getPatientClinicalChart(patient.id.toString(), doctorUser);

    assert(chart.patient.id === patient.id.toString(), 'Chart contains patient ID');
    assert(chart.patient.bloodGroup === 'B+', 'Chart displays patient Blood Group B+');
    assert(chart.patient.emergencyContactName === 'Fatima Mehmood', 'Chart displays Emergency Contact Name');
    assert(chart.allergyStatus === 'ALLERGIES_RECORDED', 'Chart explicitly identifies allergyStatus = ALLERGIES_RECORDED');
    assert(chart.allergies?.includes('Penicillin') === true, 'Chart includes explicit allergy description');
    assert(chart.latestVitals?.bmi === '22.2', 'Chart retrieves latest vitals with auto-calculated BMI');
    assert(chart.diagnoses.some((d) => d.description === 'Acute Bronchitis'), 'Chart consolidates Acute Bronchitis into diagnoses history');
    assert(chart.consultations.length >= 1, 'Chart lists past clinical consultations');

    // TEST 5: CLINICAL SIGN-OFF & IMMUTABILITY ENFORCEMENT
    console.log('\n[Test Suite 5] Clinical Sign-off & Digital Signature Immutability');
    const signedConsult = await consultationService.saveVisitConsultation(
      appointment.id.toString(),
      {
        action: 'sign',
      },
      testUser.id.toString(),
      doctorUser,
    );

    assert(signedConsult.status === 'signed', 'Consultation status successfully transitioned to "signed"');
    assert(Boolean(signedConsult.signedAt), 'Digital signature timestamp signedAt recorded in database');
    assert(signedConsult.signedById === testUser.id.toString(), 'Digital signer signedById matches clinician ID');

    const finalizedApt = await prisma.appointment.findUnique({
      where: { id: appointment.id },
    });
    assert(finalizedApt?.status === 'completed', 'Appointment visit transitioned to "completed" upon signing');
    assert(Boolean(finalizedApt?.checkedOutAt), 'Appointment checkout timestamp checkedOutAt recorded');

    // Test Immutability: direct update attempt on signed record MUST fail
    let immutabilityBlocked = false;
    try {
      await consultationService.saveVisitConsultation(
        appointment.id.toString(),
        {
          action: 'draft',
          soap_plan: 'Attempting illegal post-sign overwrite without amendment',
        },
        testUser.id.toString(),
        doctorUser,
      );
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('amendment workflow')) {
        immutabilityBlocked = true;
      }
    }
    assert(immutabilityBlocked, 'Direct modification of signed clinical note is rejected (immutability enforced)');

    // TEST 6: AUDITABLE AMENDMENT WORKFLOW
    console.log('\n[Test Suite 6] Auditable Amendment Workflow (Addenda)');
    const amendedConsult = await consultationService.amendConsultation(
      signedConsult.id,
      {
        reason: 'Sputum culture report received showing normal respiratory flora',
        amendedSection: 'ASSESSMENT',
        previousNotes: 'Atypical Pneumonia considered differential',
        newNotes: 'Sputum culture negative for pathogens. Confirmed acute viral bronchitis. Antibiotics withheld.',
      },
      testUser.id.toString(),
      doctorUser,
    );

    assert(Array.isArray(amendedConsult.amendments) && amendedConsult.amendments.length === 1, 'Consultation response contains amendment in permanent audit log');
    const amendmentRecord = amendedConsult.amendments![0];
    assert(amendmentRecord.amendedSection === 'ASSESSMENT', 'Amendment record correctly tracks amendedSection');
    assert(amendmentRecord.reason.includes('Sputum culture report'), 'Amendment record stores clinical reason for change');
    assert(amendmentRecord.newNotes.includes('Antibiotics withheld'), 'Amendment record stores new addendum content');
    assert(Boolean(amendmentRecord.createdAt), 'Amendment record stores precise audit creation timestamp');

    // Direct database verification
    const dbAmendment = await prisma.consultationAmendment.findFirst({
      where: { consultationId: BigInt(signedConsult.id) },
    });
    assert(Boolean(dbAmendment), 'Amendment record physically persisted in "consultation_amendment" PostgreSQL table');

    // TEST 7: PATIENT TIMELINE INTEGRATION
    console.log('\n[Test Suite 7] Patient Encounter Timeline Integration');
    const timeline = await patientService.getEncounterHistory(patient.id.toString(), doctorUser);

    assert(Array.isArray(timeline.consultations), 'Encounter timeline returns consultations array');
    const timelineConsult = timeline.consultations.find((c) => c.id === signedConsult.id);
    assert(Boolean(timelineConsult), 'Signed consultation appears in patient encounter history');
    assert(timelineConsult?.status === 'signed', 'Encounter history correctly reflects "signed" status');
    assert(timelineConsult?.doctorName?.includes('Ayesha') === true, 'Encounter history links attending doctor name');

    console.log('\n[Teardown] Cleaning up test records from PostgreSQL...');
    await prisma.consultationAmendment.deleteMany({
      where: { consultationId: BigInt(signedConsult.id) },
    });
    await prisma.consultation.deleteMany({
      where: { appointmentId: appointment.id },
    });
    await prisma.appointment.delete({
      where: { id: appointment.id },
    });
    await prisma.patient.delete({
      where: { id: patient.id },
    });
    console.log('[Teardown] Test cleanup completed.');

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} (100% SUCCESS)`);
    console.log('MEDORA 2.0 SUBPHASE 10.5.3 CLINICAL OPERATIONS FULLY VERIFIED');
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
