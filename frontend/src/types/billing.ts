export interface InvoicePatientSummary {
  id: string;
  patientId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
}

export interface InvoiceDoctorSummary {
  id: string;
  name: string;
  department?: string | null;
}

export interface InvoiceItem {
  id: string;
  paymentId: string;
  paymentCategoryId?: string | null;
  name: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  doctorId?: string | null;
}

export interface InvoicePayment {
  id: string;
  paymentId: string;
  amount: string | number;
  method?: string | null;
  reference?: string | null;
  paidAt?: string | null;
  receivedBy?: string | null;
  createdAt?: string | null;
}

export interface Invoice {
  id: string;
  patientId: string;
  doctorId?: string | null;
  referringDoctorId?: string | null;
  date: string;
  subtotal: string | number;
  discount: string | number;
  vat: string | number;
  grossTotal: string | number;
  paid: string | number;
  balance: string | number;
  status: 'unpaid' | 'part paid' | 'paid' | string;
  remarks?: string | null;
  branchId?: string | null;
  careSetting?: 'opd' | 'ipd' | string;
  patient?: InvoicePatientSummary;
  doctor?: InvoiceDoctorSummary;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateInvoiceItemDto {
  payment_category_id?: number | string;
  name?: string;
  quantity: number;
  unit_price?: number;
  doctor_id?: number | string;
}

export interface CreateInvoiceDto {
  patient: string | number;
  doctor?: string | number;
  referring_doctor?: string | number;
  date: string;
  discount?: number;
  vat?: number;
  remarks?: string;
  patient_type_id?: number | string;
  care_setting?: 'opd' | 'ipd';
  branchId?: string | number;
  items: CreateInvoiceItemDto[];
}

export interface CreatePaymentDto {
  amount: number;
  method?: string;
  reference?: string;
  date?: string;
}

export interface PaginatedInvoices {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalOwed?: string | number;
}
