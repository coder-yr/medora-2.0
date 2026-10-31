export interface MedicineCategory {
  id: string;
  category: string;
  description?: string | null;
  isActive: boolean;
  medicineCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  country?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  isActive: boolean;
  medicineCount?: number;
}

export interface DosageForm {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  medicineCount?: number;
}

export interface MeasurementUnit {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
  medicineCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  medicineCount?: number;
}

export interface Medicine {
  id: string;
  name: string;
  generic?: string | null;
  company?: string | null;
  categoryId?: string | null;
  category?: MedicineCategory | null;
  manufacturerId?: string | null;
  manufacturer?: Manufacturer | null;
  dosageFormId?: string | null;
  dosageForm?: DosageForm | null;
  strength?: string | null;
  unitId?: string | null;
  measurementUnit?: MeasurementUnit | null;
  supplierId?: string | null;
  supplier?: Supplier | null;
  box?: string | null;
  price?: number;
  sPrice?: number | null;
  quantity: number;
  effects?: string | null;
  expiryDate?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedMedicines {
  data: Medicine[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
