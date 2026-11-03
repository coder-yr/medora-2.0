import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  Printer,
  AlertCircle,
  X,
  FileText,
  Trash2,
} from 'lucide-react';
import type {
  Invoice,
  CreateInvoiceDto,
  CreatePaymentDto
} from '../../types/billing';
import type { Patient } from '../../types/patient';
import type { Doctor } from '../../types/doctor';

interface BillingWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  initialPatientId?: string | null;
  initialDoctorId?: string | null;
}

export const BillingWorkspace: React.FC<BillingWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
  initialPatientId,
  initialDoctorId,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalOwed, setTotalOwed] = useState<number | string>(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'outstanding' | 'settled'>('all');
  const [searchPatient, setSearchPatient] = useState('');

  // Raise Invoice Modal State
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctorId || '');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState<number>(0);
  const [vat, setVat] = useState<number>(0);
  const [remarks, setRemarks] = useState('');
  const [careSetting, setCareSetting] = useState<'opd' | 'ipd'>('opd');
  const [lineItems, setLineItems] = useState<Array<{ name: string; quantity: number; unit_price: number }>>([
    { name: 'Consultation - OPD', quantity: 1, unit_price: 500 },
  ]);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);

  // Record Payment Modal State
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Print Modal
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

  // Fetch Invoices
  const fetchInvoices = useCallback(async (p = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/invoices`);
      if (statusFilter !== 'all') url.searchParams.set('show', statusFilter);
      if (searchPatient.trim()) url.searchParams.set('patient', searchPatient.trim());
      url.searchParams.set('page', String(p));
      url.searchParams.set('limit', '25');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setInvoices(data.data.data || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
        setTotalOwed(data.data.totalOwed || 0);
      } else {
        setError(data.error?.message || data.message || 'Failed to fetch invoices.');
      }
    } catch {
      setError('Network communication error with billing service.');
    } finally {
      setLoading(false);
    }
  }, [token, apiBaseUrl, statusFilter, searchPatient, page]);

  // Fetch Doctors
  const fetchDoctors = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/doctors?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDoctorsList(data.data.data || []);
      }
    } catch {
      // Ignore background doctor lookup error
    }
  }, [token, apiBaseUrl]);

  // Initial Patient Preload
  useEffect(() => {
    if (initialPatientId && token) {
      fetch(`${apiBaseUrl}/api/v1/patients/${initialPatientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setSelectedPatient(data.data);
            setShowRaiseModal(true);
          }
        })
        .catch(() => {});
    }
  }, [initialPatientId, token, apiBaseUrl]);

  useEffect(() => {
    fetchInvoices(1);
    fetchDoctors();
  }, [fetchInvoices, fetchDoctors]);

  // Patient search in modal
  useEffect(() => {
    if (!token || !patientSearchQuery.trim() || patientSearchQuery.length < 2) {
      setPatientsList([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/patients`);
        url.searchParams.set('q', patientSearchQuery.trim());
        url.searchParams.set('limit', '5');
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setPatientsList(data.data.data || []);
        }
      } catch {
        setPatientsList([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [token, apiBaseUrl, patientSearchQuery]);

  // Calculation helpers
  const subtotal = lineItems.reduce((acc, curr) => acc + curr.quantity * curr.unit_price, 0);
  const grossTotal = Math.max(0, subtotal - discount + vat);

  const addLineItem = () => {
    setLineItems([...lineItems, { name: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== idx));
    }
  };

  const updateLineItem = (idx: number, field: string, val: any) => {
    const next = [...lineItems];
    next[idx] = { ...next[idx], [field]: val };
    setLineItems(next);
  };

  const handleRaiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setRaiseError('Please select a patient to bill.');
      return;
    }
    if (lineItems.some((i) => !i.name.trim() || i.quantity < 1)) {
      setRaiseError('All line items must have a valid name and quantity >= 1.');
      return;
    }

    setSubmittingInvoice(true);
    setRaiseError(null);

    try {
      const payload: CreateInvoiceDto = {
        patient: selectedPatient.id,
        doctor: selectedDoctorId || undefined,
        date: invoiceDate,
        discount: Number(discount) || 0,
        vat: Number(vat) || 0,
        remarks: remarks.trim() || undefined,
        care_setting: careSetting,
        branchId: activeBranchId ? Number(activeBranchId) : undefined,
        items: lineItems.map((i) => ({
          name: i.name.trim(),
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowRaiseModal(false);
        setSelectedPatient(null);
        setLineItems([{ name: 'Consultation - OPD', quantity: 1, unit_price: 500 }]);
        setDiscount(0);
        setVat(0);
        setRemarks('');
        fetchInvoices(1);
      } else {
        const msg = data.error?.message || data.message || 'Failed to raise invoice.';
        setRaiseError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setRaiseError('Network communication error with invoice service.');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    if (paymentAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }
    if (paymentAmount > Number(paymentInvoice.balance)) {
      setPaymentError(`Payment cannot exceed outstanding balance of Rs. ${paymentInvoice.balance}`);
      return;
    }

    setSubmittingPayment(true);
    setPaymentError(null);

    try {
      const payload: CreatePaymentDto = {
        amount: Number(paymentAmount),
        method: paymentMethod,
        reference: paymentRef.trim() || undefined,
        date: new Date().toISOString().split('T')[0],
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/invoices/${paymentInvoice.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPaymentInvoice(null);
        setPaymentAmount(0);
        setPaymentRef('');
        fetchInvoices(page);
      } else {
        const msg = data.error?.message || data.message || 'Payment recording failed.';
        setPaymentError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setPaymentError('Network error processing payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={22} style={{ color: '#0284c7' }} />
            Patient Billing, Invoices & Revenue
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Generate patient itemized invoices, track payments, receivables, and doctor revenue allocations
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowRaiseModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Raise New Invoice
        </button>
      </div>

      {/* KPI & Filter Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: 12, borderRadius: 10 }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Outstanding Receivables
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>
              Rs. {Number(totalOwed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 12, borderRadius: 10 }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Invoices on Record
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {total}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => setStatusFilter('all')}
            >
              All Invoices
            </button>
            <button
              className={`btn ${statusFilter === 'outstanding' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => setStatusFilter('outstanding')}
            >
              Outstanding (Unpaid)
            </button>
            <button
              className={`btn ${statusFilter === 'settled' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => setStatusFilter('settled')}
            >
              Fully Settled
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flex: '1', maxWidth: 360 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search patient MRN or ID..."
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                style={{ paddingLeft: 34, padding: '6px 10px 6px 34px', fontSize: 13 }}
              />
              <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
            </div>
            {searchPatient && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 10px' }}
                onClick={() => setSearchPatient('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#b91c1c', fontSize: 13 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Invoice Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 16px' }}>Invoice #</th>
                <th style={{ padding: '10px 16px' }}>Date</th>
                <th style={{ padding: '10px 16px' }}>Patient</th>
                <th style={{ padding: '10px 16px' }}>Attending Doctor</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Gross Total</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Paid</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Balance</th>
                <th style={{ padding: '10px 16px' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading patient invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No invoices matching current filter.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>
                      #{inv.id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{inv.date}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{inv.patient?.name || `Patient #${inv.patientId}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        MRN #{inv.patient?.patientId || inv.patientId}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {inv.doctor?.name || (inv.doctorId ? `Doctor #${inv.doctorId}` : 'General / Facility')}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                      Rs. {Number(inv.grossTotal).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#16a34a' }}>
                      Rs. {Number(inv.paid).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: Number(inv.balance) > 0 ? '#dc2626' : '#16a34a' }}>
                      Rs. {Number(inv.balance).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className={`badge ${
                          inv.status === 'paid'
                            ? 'badge-success'
                            : inv.status === 'part paid'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => setPrintInvoice(inv)}
                          title="Print Receipt"
                        >
                          <Printer size={14} />
                        </button>
                        {Number(inv.balance) > 0 && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: 12, background: '#16a34a' }}
                            onClick={() => {
                              setPaymentInvoice(inv);
                              setPaymentAmount(Number(inv.balance));
                            }}
                            title="Record Payment Installment"
                          >
                            <CreditCard size={14} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                fetchInvoices(prev);
              }}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                fetchInvoices(next);
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Raise Invoice Modal */}
      {showRaiseModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button
              onClick={() => setShowRaiseModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={20} style={{ color: '#0284c7' }} />
              Raise Patient Invoice
            </h3>

            {raiseError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} />
                <span>{raiseError}</span>
              </div>
            )}

            <form onSubmit={handleRaiseInvoice}>
              {/* Patient Selection */}
              <div className="form-group">
                <label className="form-label">1. Billable Patient *</label>
                {selectedPatient ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#e0f2fe', borderRadius: 8 }}>
                    <div>
                      <strong style={{ color: '#0369a1' }}>{selectedPatient.name}</strong>
                      <span style={{ fontSize: 12, color: '#0284c7', marginLeft: 8 }}>MRN #{selectedPatient.patientId || selectedPatient.id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      style={{ fontSize: 12, color: '#0284c7', textDecoration: 'underline' }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search patient by MRN or name..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                    />
                    {patientsList.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10,
                        maxHeight: 180,
                        overflowY: 'auto'
                      }}>
                        {patientsList.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatient(p);
                              setPatientSearchQuery('');
                              setPatientsList([]);
                            }}
                            style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13 }}
                          >
                            <strong>{p.name}</strong> <span style={{ color: '#0284c7' }}>#{p.patientId || p.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor, Date, Care Setting */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Attending Doctor</label>
                  <select
                    className="form-select"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">Hospital / General OPD</option>
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Care Setting</label>
                  <select
                    className="form-select"
                    value={careSetting}
                    onChange={(e) => setCareSetting(e.target.value as any)}
                  >
                    <option value="opd">Outpatient (OPD)</option>
                    <option value="ipd">Inpatient (IPD)</option>
                  </select>
                </div>
              </div>

              {/* Line Items Table */}
              <div style={{ marginTop: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Itemized Charges *</label>
                  <button type="button" className="btn btn-secondary" onClick={addLineItem} style={{ fontSize: 12 }}>
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Service Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 90 }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', width: 120 }}>Unit Price</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: 120 }}>Line Total</th>
                      <th style={{ padding: '8px 10px', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            required
                            className="form-input"
                            placeholder="e.g. Consultation, Dressing, Lab Test..."
                            value={item.name}
                            onChange={(e) => updateLineItem(idx, 'name', e.target.value)}
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="1"
                            required
                            className="form-input"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            className="form-input"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          Rs. {(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLineItem(idx)}
                              style={{ color: '#ef4444', background: 'none' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Billing Remarks</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Optional administrative or clinical remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                    <strong>Rs. {subtotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Discount (Rs.):</span>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: 100, padding: '4px 8px', textAlign: 'right' }}
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>VAT/Tax (Rs.):</span>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      style={{ width: 100, padding: '4px 8px', textAlign: 'right' }}
                      value={vat}
                      onChange={(e) => setVat(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: 6, fontSize: 15 }}>
                    <strong>Net Gross Total:</strong>
                    <strong style={{ color: '#0284c7' }}>Rs. {grossTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRaiseModal(false)}
                  disabled={submittingInvoice}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingInvoice}>
                  {submittingInvoice ? 'Generating Invoice...' : 'Generate & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 440, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setPaymentInvoice(null)}
              style={{ position: 'absolute', right: 16, top: 16, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={20} style={{ color: '#16a34a' }} />
              Record Payment
            </h3>

            {paymentError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
                <AlertCircle size={16} />
                <span>{paymentError}</span>
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Invoice ID:</span>
                <strong>#{paymentInvoice.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Patient:</span>
                <strong>{paymentInvoice.patient?.name || `Patient #${paymentInvoice.patientId}`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 6 }}>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>Balance Owed:</span>
                <strong style={{ color: '#dc2626' }}>Rs. {Number(paymentInvoice.balance).toFixed(2)}</strong>
              </div>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label className="form-label">Payment Amount (Rs.) *</label>
                <input
                  type="number"
                  min="0.01"
                  max={Number(paymentInvoice.balance)}
                  step="any"
                  required
                  className="form-input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online Gateway</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / Slip Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. POS-984210"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaymentInvoice(null)}
                  disabled={submittingPayment}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#16a34a' }} disabled={submittingPayment}>
                  {submittingPayment ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {printInvoice && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 640, width: '100%', background: '#fff', color: '#000', padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0284c7' }}>MEDORA HOSPITAL</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Official Patient Invoice & Receipt</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>INVOICE #{printInvoice.id}</h3>
                <p style={{ margin: 0, fontSize: 12 }}>Date: {printInvoice.date}</p>
                <p style={{ margin: 0, fontSize: 12 }}>Status: <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{printInvoice.status}</span></p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              <div>
                <strong>Billed To:</strong> {printInvoice.patient?.name || `Patient #${printInvoice.patientId}`}<br />
                <strong>MRN:</strong> #{printInvoice.patient?.patientId || printInvoice.patientId}
              </div>
              <div>
                <strong>Attending:</strong> {printInvoice.doctor?.name || 'General Facility'}<br />
                <strong>Setting:</strong> {printInvoice.careSetting?.toUpperCase() || 'OPD'}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                  <th style={{ padding: '6px 0' }}>Service Charge</th>
                  <th style={{ padding: '6px 0', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '6px 0', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '6px 0', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {printInvoice.items && printInvoice.items.length > 0 ? (
                  printInvoice.items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 0', fontWeight: 600 }}>{it.name}</td>
                      <td style={{ padding: '8px 0', textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs. {Number(it.unitPrice).toFixed(2)}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs. {Number(it.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '8px 0' }}>Item details rendered on statement</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 13, marginBottom: 20 }}>
              <div style={{ width: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Gross Total:</span>
                  <strong>Rs. {Number(printInvoice.grossTotal).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#16a34a' }}>
                  <span>Amount Paid:</span>
                  <strong>Rs. {Number(printInvoice.paid).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: 4, fontWeight: 700, fontSize: 14 }}>
                  <span>Balance Owed:</span>
                  <span style={{ color: Number(printInvoice.balance) > 0 ? '#dc2626' : '#000' }}>
                    Rs. {Number(printInvoice.balance).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 12 }}>
              <div>
                <p style={{ margin: 0 }}>Medora 2.0 Audited Accounting Engine</p>
                <p style={{ margin: 0, color: '#64748b' }}>Receipt valid without physical stamp</p>
              </div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #000', width: 140, paddingTop: 4 }}>
                Cashier Signature
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setPrintInvoice(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
