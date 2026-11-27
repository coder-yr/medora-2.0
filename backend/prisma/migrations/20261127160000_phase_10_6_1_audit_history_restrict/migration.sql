-- Phase 10.6.1: Protect financial & clinical audit-history tables from accidental cascade deletion

-- 1. Consultation Amendments
ALTER TABLE "consultation_amendment" DROP CONSTRAINT IF EXISTS "consultation_amendment_consultation_id_fkey";
ALTER TABLE "consultation_amendment" ADD CONSTRAINT "consultation_amendment_consultation_id_fkey"
  FOREIGN KEY ("consultation_id") REFERENCES "consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Prescription Amendments
ALTER TABLE "prescription_amendment" DROP CONSTRAINT IF EXISTS "prescription_amendment_prescription_id_fkey";
ALTER TABLE "prescription_amendment" ADD CONSTRAINT "prescription_amendment_prescription_id_fkey"
  FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Laboratory Report Amendments
ALTER TABLE "lab_report_amendment" DROP CONSTRAINT IF EXISTS "lab_report_amendment_lab_id_fkey";
ALTER TABLE "lab_report_amendment" ADD CONSTRAINT "lab_report_amendment_lab_id_fkey"
  FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Invoice Items
ALTER TABLE "invoice_item" DROP CONSTRAINT IF EXISTS "invoice_item_payment_id_fkey";
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Invoice Payments
ALTER TABLE "invoice_payment" DROP CONSTRAINT IF EXISTS "invoice_payment_payment_id_fkey";
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Invoice Refunds
ALTER TABLE "invoice_refund" DROP CONSTRAINT IF EXISTS "invoice_refund_payment_id_fkey";
ALTER TABLE "invoice_refund" ADD CONSTRAINT "invoice_refund_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Doctor Shares
ALTER TABLE "doctor_share" DROP CONSTRAINT IF EXISTS "doctor_share_payment_id_fkey";
ALTER TABLE "doctor_share" ADD CONSTRAINT "doctor_share_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Notification Delivery History
ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_notification_id_fkey";
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Critical Lab Escalations
ALTER TABLE "critical_lab_escalations" DROP CONSTRAINT IF EXISTS "critical_lab_escalations_lab_order_id_fkey";
ALTER TABLE "critical_lab_escalations" ADD CONSTRAINT "critical_lab_escalations_lab_order_id_fkey"
  FOREIGN KEY ("lab_order_id") REFERENCES "lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "critical_lab_escalations" DROP CONSTRAINT IF EXISTS "critical_lab_escalations_patient_id_fkey";
ALTER TABLE "critical_lab_escalations" ADD CONSTRAINT "critical_lab_escalations_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
