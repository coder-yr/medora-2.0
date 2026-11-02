import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Eye,
  ToggleLeft,
  ToggleRight,
  Package,
  Layers,
  Building2,
  Boxes,
  Truck,
  X,
} from 'lucide-react';
import type {
  Medicine,
  MedicineCategory,
  Manufacturer,
  DosageForm,
  MeasurementUnit,
  Supplier,
  PaginatedMedicines,
} from '../types/medicine';

interface Props {
  apiBaseUrl: string;
  token: string;
  userRole: 'Doctor' | 'Admin' | 'Pharmacist' | 'Laboratorist';
  onNotification: (type: 'success' | 'error', message: string) => void;
}

export function MedicineCatalogue({
  apiBaseUrl,
  token,
  userRole,
  onNotification,
}: Props) {
  // Navigation sub-tab
  const [activeTab, setActiveTab] = useState<
    'catalogue' | 'categories' | 'manufacturers' | 'standards' | 'suppliers'
  >('catalogue');

  // Medicines state
  const [medicinesData, setMedicinesData] = useState<PaginatedMedicines>({
    data: [],
    meta: { total: 0, page: 1, limit: 15, totalPages: 1 },
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<string>('true');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Metadata dictionaries
  const [categories, setCategories] = useState<MedicineCategory[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modals state
  const [viewMedicine, setViewMedicine] = useState<Medicine | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    name: '',
    generic: '',
    company: '',
    categoryId: '',
    manufacturerId: '',
    dosageFormId: '',
    strength: '',
    unitId: '',
    supplierId: '',
    box: '',
    price: 0,
    sPrice: 0,
    quantity: 0,
    effects: '',
    expiryDate: '',
    isActive: true,
  });

  // Supporting entities form states
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newMfrName, setNewMfrName] = useState('');
  const [newMfrCountry, setNewMfrCountry] = useState('');
  const [newDfName, setNewDfName] = useState('');
  const [newDfDesc, setNewDfDesc] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');

  const canEdit = userRole === 'Admin' || userRole === 'Pharmacist';
  const canDelete = userRole === 'Admin';

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load metadata
  const loadMetadata = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [catsRes, mfrsRes, dfRes, uRes, supRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/medicines/meta/categories`, { headers }),
        fetch(`${apiBaseUrl}/api/v1/medicines/meta/manufacturers`, { headers }),
        fetch(`${apiBaseUrl}/api/v1/medicines/meta/dosage-forms`, { headers }),
        fetch(`${apiBaseUrl}/api/v1/medicines/meta/units`, { headers }),
        fetch(`${apiBaseUrl}/api/v1/medicines/meta/suppliers`, { headers }),
      ]);

      if (catsRes.ok) {
        const d = await catsRes.json();
        setCategories(d.data || []);
      }
      if (mfrsRes.ok) {
        const d = await mfrsRes.json();
        setManufacturers(d.data || []);
      }
      if (dfRes.ok) {
        const d = await dfRes.json();
        setDosageForms(d.data || []);
      }
      if (uRes.ok) {
        const d = await uRes.json();
        setUnits(d.data || []);
      }
      if (supRes.ok) {
        const d = await supRes.json();
        setSuppliers(d.data || []);
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load medicines
  const loadMedicines = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('q', debouncedSearch);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedManufacturer) params.append('manufacturerId', selectedManufacturer);
      if (activeStatus) params.append('isActive', activeStatus);
      params.append('page', currentPage.toString());
      params.append('limit', '15');
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const res = await fetch(`${apiBaseUrl}/api/v1/medicines?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || err.message || 'Failed to fetch medicines');
      }

      const json = await res.json();
      setMedicinesData(json.data);
    } catch (err: any) {
      onNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [
    activeStatus,
    apiBaseUrl,
    currentPage,
    debouncedSearch,
    onNotification,
    selectedCategory,
    selectedManufacturer,
    sortBy,
    sortOrder,
    token,
  ]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  // Open Add/Edit Modal
  const openForm = (med?: Medicine) => {
    if (med) {
      setEditingMedicine(med);
      setFormData({
        name: med.name,
        generic: med.generic || '',
        company: med.company || '',
        categoryId: med.categoryId || '',
        manufacturerId: med.manufacturerId || '',
        dosageFormId: med.dosageFormId || '',
        strength: med.strength || '',
        unitId: med.unitId || '',
        supplierId: med.supplierId || '',
        box: med.box || '',
        price: med.price || 0,
        sPrice: med.sPrice || 0,
        quantity: med.quantity || 0,
        effects: med.effects || '',
        expiryDate: med.expiryDate || '',
        isActive: med.isActive,
      });
    } else {
      setEditingMedicine(null);
      setFormData({
        name: '',
        generic: '',
        company: '',
        categoryId: '',
        manufacturerId: '',
        dosageFormId: '',
        strength: '',
        unitId: '',
        supplierId: '',
        box: '',
        price: 0,
        sPrice: 0,
        quantity: 0,
        effects: '',
        expiryDate: '',
        isActive: true,
      });
    }
    setIsFormOpen(true);
  };

  // Submit Medicine Form
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      onNotification('error', 'Brand name is required');
      return;
    }

    try {
      const payload: any = {
        name: formData.name.trim(),
        generic: formData.generic.trim() || undefined,
        company: formData.company.trim() || undefined,
        categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
        manufacturerId: formData.manufacturerId ? Number(formData.manufacturerId) : undefined,
        dosageFormId: formData.dosageFormId ? Number(formData.dosageFormId) : undefined,
        strength: formData.strength.trim() || undefined,
        unitId: formData.unitId ? Number(formData.unitId) : undefined,
        supplierId: formData.supplierId ? Number(formData.supplierId) : undefined,
        box: formData.box.trim() || undefined,
        price: Number(formData.price) >= 0 ? Number(formData.price) : 0,
        sPrice: Number(formData.sPrice) >= 0 ? Number(formData.sPrice) : undefined,
        quantity: Number(formData.quantity) >= 0 ? Number(formData.quantity) : 0,
        effects: formData.effects.trim() || undefined,
        expiryDate: formData.expiryDate.trim() || undefined,
        isActive: formData.isActive,
      };

      const url = editingMedicine
        ? `${apiBaseUrl}/api/v1/medicines/${editingMedicine.id}`
        : `${apiBaseUrl}/api/v1/medicines`;

      const method = editingMedicine ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Operation failed');
      }

      onNotification(
        'success',
        editingMedicine
          ? `${json.data.name} updated successfully`
          : `${json.data.name} added to the catalogue`,
      );
      setIsFormOpen(false);
      loadMedicines();
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (med: Medicine) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/${med.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !med.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Update failed');

      onNotification(
        'success',
        `${med.name} ${json.data.isActive ? 'activated' : 'deactivated'}`,
      );
      loadMedicines();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Delete Medicine
  const handleDeleteMedicine = async (med: Medicine) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${med.name}" from the hospital catalogue?`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/${med.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Failed to delete medicine');
      }
      onNotification('success', json.data?.message || `${med.name} removed from catalogue`);
      loadMedicines();
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Quick Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/meta/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category: newCatName.trim(), description: newCatDesc.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to add category');
      onNotification('success', `Category "${json.data.category}" created`);
      setNewCatName('');
      setNewCatDesc('');
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: MedicineCategory) => {
    if (!window.confirm(`Remove category "${cat.category}"?`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/meta/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to remove category');
      onNotification('success', json.data?.message || 'Category removed');
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Quick Add Manufacturer
  const handleAddManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMfrName.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/meta/manufacturers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newMfrName.trim(), country: newMfrCountry.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to add manufacturer');
      onNotification('success', `Manufacturer "${json.data.name}" added`);
      setNewMfrName('');
      setNewMfrCountry('');
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Quick Add Dosage Form
  const handleAddDosageForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDfName.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/meta/dosage-forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newDfName.trim(), description: newDfDesc.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to add dosage form');
      onNotification('success', `Dosage form "${json.data.name}" added`);
      setNewDfName('');
      setNewDfDesc('');
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Quick Add Measurement Unit
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !newUnitSymbol.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/meta/units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newUnitName.trim(), symbol: newUnitSymbol.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to add unit');
      onNotification('success', `Unit "${json.data.name}" (${json.data.symbol}) added`);
      setNewUnitName('');
      setNewUnitSymbol('');
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Quick Add Supplier
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/medicines/meta/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newSupName.trim(), phone: newSupPhone.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to add supplier');
      onNotification('success', `Supplier "${json.data.name}" registered`);
      setNewSupName('');
      setNewSupPhone('');
      loadMetadata();
    } catch (err: any) {
      onNotification('error', err.message);
    }
  };

  // Dashboard Stats Calculations
  const totalMedicines = medicinesData.meta.total;
  const inStockCount = medicinesData.data.filter((m) => m.quantity > 0).length;
  const outOfStockCount = medicinesData.data.filter((m) => m.quantity === 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner / Dashboard Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', color: 'var(--primary)' }}>
            <Pill size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Hospital Formularies
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalMedicines}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'var(--success-light)', padding: '12px', borderRadius: '8px', color: 'var(--success)' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Available In Stock
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{inStockCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'var(--danger-light)', padding: '12px', borderRadius: '8px', color: 'var(--danger)' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Out of Stock (Refill)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{outOfStockCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'var(--warning-light)', padding: '12px', borderRadius: '8px', color: 'var(--warning)' }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Formulary Categories
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{categories.length}</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
        }}
      >
        <button
          className={`btn ${activeTab === 'catalogue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('catalogue')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Pill size={16} /> Catalogue Formulary
        </button>
        <button
          className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('categories')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Layers size={16} /> Categories ({categories.length})
        </button>
        <button
          className={`btn ${activeTab === 'manufacturers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('manufacturers')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Building2 size={16} /> Manufacturers ({manufacturers.length})
        </button>
        <button
          className={`btn ${activeTab === 'standards' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('standards')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Boxes size={16} /> Dosage & Units
        </button>
        <button
          className={`btn ${activeTab === 'suppliers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('suppliers')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Truck size={16} /> Suppliers ({suppliers.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. CATALOGUE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'catalogue' && (
        <div className="card" style={{ padding: '20px' }}>
          {/* Action & Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', flex: 1, minWidth: '280px' }}>
              {/* Search input */}
              <div style={{ position: 'relative', minWidth: '260px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '32px' }}
                  placeholder="Search brand, generic, manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Category filter */}
              <select
                className="form-control"
                style={{ width: '160px' }}
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category}
                  </option>
                ))}
              </select>

              {/* Manufacturer filter */}
              <select
                className="form-control"
                style={{ width: '160px' }}
                value={selectedManufacturer}
                onChange={(e) => {
                  setSelectedManufacturer(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Manufacturers</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              {/* Active/Inactive filter */}
              <select
                className="form-control"
                style={{ width: '130px' }}
                value={activeStatus}
                onChange={(e) => {
                  setActiveStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
                <option value="all">All Statuses</option>
              </select>
            </div>

            {/* Add Medicine Button */}
            {canEdit && (
              <button
                className="btn btn-primary"
                onClick={() => openForm()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Medicine
              </button>
            )}
          </div>

          {/* Medicines Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading medicine catalogue...
            </div>
          ) : medicinesData.data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <Pill size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>No medicines found matching the selected filters.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                      Brand Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Generic</th>
                    <th>Category</th>
                    <th>Manufacturer</th>
                    <th>Pack / Strength</th>
                    <th onClick={() => { setSortBy('quantity'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                      Stock {sortBy === 'quantity' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => { setSortBy('sPrice'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>
                      Retail / Cost
                    </th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicinesData.data.map((med) => (
                    <tr key={med.id} style={{ opacity: med.isActive ? 1 : 0.6 }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{med.name}</div>
                        {med.dosageForm && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {med.dosageForm.name}
                          </span>
                        )}
                      </td>
                      <td>{med.generic || '—'}</td>
                      <td>
                        {med.category ? (
                          <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                            {med.category.category}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{med.manufacturer?.name || med.company || '—'}</td>
                      <td>
                        {med.box || (med.strength ? `${med.strength} ${med.measurementUnit?.symbol || ''}` : '—')}
                      </td>
                      <td>
                        {med.quantity === 0 ? (
                          <span className="badge" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                            Out of stock
                          </span>
                        ) : med.quantity < 20 ? (
                          <span className="badge" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                            Low ({med.quantity})
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                            {med.quantity}
                          </span>
                        )}
                      </td>
                      <td>
                        <div>
                          <strong>PKR {med.sPrice != null ? Number(med.sPrice).toFixed(2) : '—'}</strong>
                        </div>
                        {med.price != null && Number(med.price) > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Cost: PKR {Number(med.price).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: med.isActive ? 'var(--success-light)' : 'var(--bg-subtle)',
                            color: med.isActive ? 'var(--success)' : 'var(--text-muted)',
                          }}
                        >
                          {med.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="View formulation details"
                            onClick={() => setViewMedicine(med)}
                          >
                            <Eye size={14} />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                title="Edit medicine"
                                onClick={() => openForm(med)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                title={med.isActive ? 'Deactivate medicine' : 'Activate medicine'}
                                onClick={() => handleToggleActive(med)}
                              >
                                {med.isActive ? (
                                  <ToggleRight size={14} color="var(--success)" />
                                ) : (
                                  <ToggleLeft size={14} color="var(--text-muted)" />
                                )}
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              className="btn btn-danger btn-sm"
                              title="Delete medicine"
                              onClick={() => handleDeleteMedicine(med)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {medicinesData.meta.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Showing Page {medicinesData.meta.page} of {medicinesData.meta.totalPages} ({medicinesData.meta.total} total formularies)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= medicinesData.meta.totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CATEGORIES MANAGEMENT TAB */}
      {/* ========================================================================= */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '20px' }}>
          {canEdit && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Add Category</h3>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Category Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Antibiotics, Analgesics"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Therapeutic class indications"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                  <Plus size={16} /> Save Category
                </button>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Formulary Categories</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Medicines</th>
                  {canDelete && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.category}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.description || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {c.medicineCount ?? 0}
                      </span>
                    </td>
                    {canDelete && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteCategory(c)}
                          title="Delete category"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MANUFACTURERS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'manufacturers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '20px' }}>
          {canEdit && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Add Manufacturer</h3>
              <form onSubmit={handleAddManufacturer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. GlaxoSmithKline, Abbott"
                    value={newMfrName}
                    onChange={(e) => setNewMfrName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Country</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Pakistan, United Kingdom"
                    value={newMfrCountry}
                    onChange={(e) => setNewMfrCountry(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                  <Plus size={16} /> Register Manufacturer
                </button>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Registered Manufacturers</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Manufacturer</th>
                  <th>Country</th>
                  <th>Formularies</th>
                </tr>
              </thead>
              <tbody>
                {manufacturers.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{m.country || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {m.medicineCount ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DOSAGE FORMS & UNITS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'standards' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Dosage Forms */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Dosage Forms</h3>
            {canEdit && (
              <form onSubmit={handleAddDosageForm} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Capsule, Syrup, Drops"
                  value={newDfName}
                  onChange={(e) => setNewDfName(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} /> Add
                </button>
              </form>
            )}
            <table className="table">
              <thead>
                <tr><th>Form</th><th>Count</th></tr>
              </thead>
              <tbody>
                {dosageForms.map((df) => (
                  <tr key={df.id}>
                    <td><strong>{df.name}</strong></td>
                    <td>{df.medicineCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Units */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Measurement Units</h3>
            {canEdit && (
              <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Unit (e.g. Milligram)"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="form-control"
                  style={{ width: '80px' }}
                  placeholder="mg"
                  value={newUnitSymbol}
                  onChange={(e) => setNewUnitSymbol(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} /> Add
                </button>
              </form>
            )}
            <table className="table">
              <thead>
                <tr><th>Unit</th><th>Symbol</th><th>Count</th></tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td><code>{u.symbol}</code></td>
                    <td>{u.medicineCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUPPLIERS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '20px' }}>
          {canEdit && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Register Supplier</h3>
              <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Supplier Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MediCorp Distribution"
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Contact Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="051-1234567"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                  <Plus size={16} /> Save Supplier
                </button>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '14px', fontSize: '16px' }}>Authorized Suppliers</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact Phone</th>
                  <th>Linked Drugs</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.phone || '—'}</td>
                    <td>{s.medicineCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL */}
      {/* ========================================================================= */}
      {viewMedicine && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '600px', maxWidth: '95vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pill size={20} color="var(--primary)" /> {viewMedicine.name}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewMedicine(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generic Salt</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.generic || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Category</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.category?.category || 'Uncategorised'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manufacturer / Company</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.manufacturer?.name || viewMedicine.company || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dosage Form</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.dosageForm?.name || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Strength</span>
                <div style={{ fontWeight: 600 }}>
                  {viewMedicine.strength ? `${viewMedicine.strength} ${viewMedicine.measurementUnit?.symbol || ''}` : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pack / Strength Format (box)</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.box || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stock Balance</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.quantity} units</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Expiry Date</span>
                <div style={{ fontWeight: 600 }}>{viewMedicine.expiryDate || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Retail Sale Price</span>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                  PKR {viewMedicine.sPrice != null ? Number(viewMedicine.sPrice).toFixed(2) : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hospital Cost Price</span>
                <div style={{ fontWeight: 600 }}>
                  PKR {viewMedicine.price != null ? Number(viewMedicine.price).toFixed(2) : '—'}
                </div>
              </div>
            </div>

            {viewMedicine.effects && (
              <div style={{ marginBottom: '16px', background: 'var(--bg-subtle)', padding: '12px', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Side Effects & Advisories:</span>
                <p style={{ marginTop: '4px', fontSize: '13px' }}>{viewMedicine.effects}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setViewMedicine(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT MEDICINE FORM MODAL */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div className="modal-backdrop">
          <div className="card" style={{ width: '700px', maxWidth: '95vw', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px' }}>
                {editingMedicine ? `Edit ${editingMedicine.name}` : 'Add Medicine to Catalogue'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsFormOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Brand Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Amoxicillin 500mg, Panadol"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Generic Salt</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Amoxicillin, Paracetamol"
                    value={formData.generic}
                    onChange={(e) => setFormData({ ...formData, generic: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Category</label>
                  <select
                    className="form-control"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Manufacturer</label>
                  <select
                    className="form-control"
                    value={formData.manufacturerId}
                    onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                  >
                    <option value="">Select Manufacturer</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Dosage Form</label>
                  <select
                    className="form-control"
                    value={formData.dosageFormId}
                    onChange={(e) => setFormData({ ...formData, dosageFormId: e.target.value })}
                  >
                    <option value="">Select Form</option>
                    {dosageForms.map((df) => (
                      <option key={df.id} value={df.id}>
                        {df.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Strength</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 500, 850, 120"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Unit</label>
                  <select
                    className="form-control"
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  >
                    <option value="">Select Unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Pack Size / Packaging Format (box)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 10x10 Tablets, 1 Bottle 120ml"
                    value={formData.box}
                    onChange={(e) => setFormData({ ...formData, box: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>On-Hand Stock Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Cost Price (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Retail Sale Price (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={formData.sPrice}
                    onChange={(e) => setFormData({ ...formData, sPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Side Effects or Advisory Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Contraindications, cautions, administration tips"
                  value={formData.effects}
                  onChange={(e) => setFormData({ ...formData, effects: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMedicine ? 'Update Medicine' : 'Add to Catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
