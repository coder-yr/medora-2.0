import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  Video,
  X,
  AlertCircle,
  Stethoscope,
  Filter,
  Users,
  RefreshCw,
  Ban,
  CalendarDays,
  Coffee,
  Activity,
  Eye,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type {
  Appointment,
  CreateAppointmentDto,
  FreeSlot,
  QueueItem,
  QueueSummary,
  WalkInAppointmentDto,
  RescheduleAppointmentDto,
  CancelAppointmentDto,
  DoctorSlot,
  DoctorLeave,
} from '../../types/appointment';
import type { Patient } from '../../types/patient';
import type { Doctor } from '../../types/doctor';

interface AppointmentWorkspaceProps {
  token: string;
  apiBaseUrl: string;
  activeBranchId?: string;
  initialPatient?: Patient | null;
  initialDoctor?: Doctor | null;
  onStartConsultation?: (appointment: Appointment) => void;
  initialAction?: 'book' | null;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const AppointmentWorkspace: React.FC<AppointmentWorkspaceProps> = ({
  token,
  apiBaseUrl,
  activeBranchId,
  initialPatient,
  initialDoctor,
  onStartConsultation,
  initialAction,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Active workspace tab: 'queue' | 'list' | 'schedules'
  const [activeTab, setActiveTab] = useState<'queue' | 'list' | 'schedules'>('queue');

  // Shared Data
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- TAB 1: OPD Waiting Queue State ---
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({
    totalWaiting: 0,
    totalInConsultation: 0,
    totalCompletedToday: 0,
    averageWaitMinutes: 0,
  });
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueDoctorFilter, setQueueDoctorFilter] = useState('');

  // --- TAB 2: Appointment List State ---
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(todayStr);
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // --- TAB 3: Doctor Schedule Management State ---
  const [selectedScheduleDoctorId, setSelectedScheduleDoctorId] = useState('');
  const [doctorSlots, setDoctorSlots] = useState<DoctorSlot[]>([]);
  const [doctorLeaves, setDoctorLeaves] = useState<DoctorLeave[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null);

  // New Leave Form in Schedule tab
  const [newLeaveDate, setNewLeaveDate] = useState(todayStr);
  const [newLeaveStartTime, setNewLeaveStartTime] = useState('');
  const [newLeaveEndTime, setNewLeaveEndTime] = useState('');
  const [newLeaveReason, setNewLeaveReason] = useState('');

  // --- MODALS STATE ---
  // 1. Regular Booking Modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookPatientSearch, setBookPatientSearch] = useState('');
  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDoctor ? initialDoctor.id : '');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'VIP' | 'EMERGENCY'>('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // 2. Walk-in Registration Modal
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInMode, setWalkInMode] = useState<'existing' | 'new'>('existing');
  const [walkInPatientSearch, setWalkInPatientSearch] = useState('');
  const [walkInSearchedPatients, setWalkInSearchedPatients] = useState<Patient[]>([]);
  const [selectedWalkInPatient, setSelectedWalkInPatient] = useState<Patient | null>(null);
  // New patient inline registration
  const [newPatName, setNewPatName] = useState('');
  const [newPatPhone, setNewPatPhone] = useState('');
  const [newPatSex, setNewPatSex] = useState('Male');
  const [newPatAge, setNewPatAge] = useState('');
  const [newPatBlood, setNewPatBlood] = useState('');
  const [newPatAddress, setNewPatAddress] = useState('');
  // Walk-in consultation fields
  const [walkInDoctorId, setWalkInDoctorId] = useState('');
  const [walkInPriority, setWalkInPriority] = useState<'NORMAL' | 'URGENT' | 'VIP' | 'EMERGENCY'>('NORMAL');
  const [walkInReason, setWalkInReason] = useState('');
  const [walkInRemarks, setWalkInRemarks] = useState('');
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);

  // 3. Reschedule Modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(todayStr);
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleFreeSlots, setRescheduleFreeSlots] = useState<FreeSlot[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // 4. Cancellation Modal
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // 5. Appointment Detail Modal
  const [detailTarget, setDetailTarget] = useState<Appointment | null>(null);

  // Initial Auto-Open
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
      setShowBookModal(true);
    }
    if (initialDoctor) {
      setSelectedDoctorId(initialDoctor.id);
      setSelectedScheduleDoctorId(initialDoctor.id);
      setShowBookModal(true);
    }
    if (initialAction === 'book') {
      setShowBookModal(true);
    }
  }, [initialPatient, initialDoctor, initialAction]);

  // Load doctors for dropdowns
  const fetchDoctors = useCallback(async () => {
    if (!token) return;
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/doctors`);
      url.searchParams.set('limit', '100');
      if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const docList = Array.isArray(data.data)
          ? data.data
          : data.data?.items || data.data?.data || [];
        setDoctorsList(docList);
        if (docList.length > 0) {
          if (!selectedDoctorId) setSelectedDoctorId(docList[0].id);
          if (!walkInDoctorId) setWalkInDoctorId(docList[0].id);
          if (!selectedScheduleDoctorId) setSelectedScheduleDoctorId(docList[0].id);
        }
      }
    } catch {
      // Ignore background doctor lookup errors
    }
  }, [token, apiBaseUrl, activeBranchId, selectedDoctorId, walkInDoctorId, selectedScheduleDoctorId]);

  // Fetch OPD Waiting Queue
  const fetchOpdQueue = useCallback(async () => {
    if (!token) return;
    setQueueLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/api/v1/appointments/queue`);
      url.searchParams.set('date', todayStr);
      if (queueDoctorFilter) url.searchParams.set('doctorId', queueDoctorFilter);
      if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setQueueItems(data.data.items || []);
        if (data.data.summary) {
          setQueueSummary(data.data.summary);
        }
      }
    } catch {
      // Queue background poll error
    } finally {
      setQueueLoading(false);
    }
  }, [token, apiBaseUrl, todayStr, queueDoctorFilter, activeBranchId]);

  // Fetch Appointment List
  const fetchAppointments = useCallback(
    async (p = page) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/appointments`);
        if (filterDate) url.searchParams.set('date', filterDate);
        if (filterDoctor) url.searchParams.set('doctor', filterDoctor);
        if (filterStatus) url.searchParams.set('status', filterStatus);
        if (activeBranchId) url.searchParams.set('branchId', activeBranchId);
        url.searchParams.set('page', String(p));
        url.searchParams.set('limit', '25');

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && data.success) {
          const apptList = Array.isArray(data.data)
            ? data.data
            : data.data?.items || data.data?.data || [];
          setAppointments(apptList);
          setTotal(data.data?.meta?.total ?? data.data?.total ?? apptList.length);
          setTotalPages(data.data?.meta?.totalPages ?? data.data?.totalPages ?? 1);
        } else {
          setError(data.error?.message || data.message || 'Failed to fetch appointments.');
        }
      } catch {
        setError('Network communication error with appointment service.');
      } finally {
        setLoading(false);
      }
    },
    [token, apiBaseUrl, filterDate, filterDoctor, filterStatus, activeBranchId, page],
  );

  // Fetch Doctor Schedules & Leaves
  const fetchDoctorSchedules = useCallback(async () => {
    if (!token || !selectedScheduleDoctorId) return;
    setScheduleLoading(true);
    setScheduleSuccessMsg(null);
    try {
      const [schedRes, leavesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/doctors/${selectedScheduleDoctorId}/schedules`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/v1/doctors/${selectedScheduleDoctorId}/leaves`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const schedData = await schedRes.json();
      const leavesData = await leavesRes.json();

      if (schedRes.ok && schedData.success) {
        const existingSlots: DoctorSlot[] = schedData.data || [];
        // Ensure all 7 days exist
        const fullWeek: DoctorSlot[] = [];
        for (let w = 0; w < 7; w++) {
          const found = existingSlots.find((s) => s.weekday === w);
          if (found) {
            fullWeek.push(found);
          } else {
            fullWeek.push({
              weekday: w,
              startTime: '09:00',
              endTime: '17:00',
              slotMinutes: 15,
              active: false,
              breakStartTime: null,
              breakEndTime: null,
            });
          }
        }
        setDoctorSlots(fullWeek);
      }

      if (leavesRes.ok && leavesData.success) {
        setDoctorLeaves(leavesData.data || []);
      }
    } catch {
      // Schedule fetch error
    } finally {
      setScheduleLoading(false);
    }
  }, [token, apiBaseUrl, selectedScheduleDoctorId]);

  // Initial loads
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchOpdQueue();
    } else if (activeTab === 'list') {
      fetchAppointments(1);
    } else if (activeTab === 'schedules') {
      fetchDoctorSchedules();
    }
  }, [activeTab, fetchOpdQueue, fetchAppointments, fetchDoctorSchedules]);

  // Real-time Queue Polling (every 30s when on queue tab)
  useEffect(() => {
    if (activeTab !== 'queue') return;
    const interval = setInterval(() => {
      fetchOpdQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchOpdQueue]);

  // Patient search in Booking Modal
  useEffect(() => {
    if (!token || !bookPatientSearch.trim() || bookPatientSearch.length < 2) {
      setSearchedPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/patients`);
        url.searchParams.set('q', bookPatientSearch.trim());
        url.searchParams.set('limit', '5');
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const patList = Array.isArray(data.data)
            ? data.data
            : data.data?.items || data.data?.data || [];
          setSearchedPatients(patList);
        }
      } catch {
        setSearchedPatients([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [token, apiBaseUrl, bookPatientSearch]);

  // Patient search in Walk-in Modal
  useEffect(() => {
    if (!token || !walkInPatientSearch.trim() || walkInPatientSearch.length < 2) {
      setWalkInSearchedPatients([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/patients`);
        url.searchParams.set('q', walkInPatientSearch.trim());
        url.searchParams.set('limit', '5');
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const patList = Array.isArray(data.data)
            ? data.data
            : data.data?.items || data.data?.data || [];
          setWalkInSearchedPatients(patList);
        }
      } catch {
        setWalkInSearchedPatients([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [token, apiBaseUrl, walkInPatientSearch]);

  // Fetch free slots for booking modal
  useEffect(() => {
    if (!token || !selectedDoctorId || !bookingDate) {
      setFreeSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/appointments/free-slots`);
        url.searchParams.set('doctor', selectedDoctorId);
        url.searchParams.set('date', bookingDate);
        if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setFreeSlots(data.data);
          if (data.data.length > 0) {
            setSelectedSlot(data.data[0].start);
          } else {
            setSelectedSlot('');
          }
        } else {
          setFreeSlots([]);
          setSelectedSlot('');
        }
      } catch {
        setFreeSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [token, apiBaseUrl, selectedDoctorId, bookingDate, activeBranchId]);

  // Fetch free slots for reschedule modal
  useEffect(() => {
    if (!token || !rescheduleTarget || !rescheduleDate) {
      setRescheduleFreeSlots([]);
      return;
    }
    const fetchRescheduleSlots = async () => {
      setRescheduleSlotsLoading(true);
      try {
        const url = new URL(`${apiBaseUrl}/api/v1/appointments/free-slots`);
        url.searchParams.set('doctor', rescheduleTarget.doctorId);
        url.searchParams.set('date', rescheduleDate);
        if (activeBranchId) url.searchParams.set('branchId', activeBranchId);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setRescheduleFreeSlots(data.data);
          if (data.data.length > 0) {
            setRescheduleSlot(data.data[0].start);
          } else {
            setRescheduleSlot('');
          }
        } else {
          setRescheduleFreeSlots([]);
          setRescheduleSlot('');
        }
      } catch {
        setRescheduleFreeSlots([]);
      } finally {
        setRescheduleSlotsLoading(false);
      }
    };
    fetchRescheduleSlots();
  }, [token, apiBaseUrl, rescheduleTarget, rescheduleDate, activeBranchId]);

  // --- ACTIONS ---

  // Check In an Appointment -> creates token & puts in queue
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAppointments(page);
        fetchOpdQueue();
      } else {
        alert(data.error?.message || 'Failed to check in appointment.');
      }
    } catch {
      alert('Network error checking in appointment.');
    }
  };

  // Call Patient into Room
  const handleCallPatient = async (appointmentId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appointments/${appointmentId}/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOpdQueue();
        if (activeTab === 'list') fetchAppointments(page);
      } else {
        alert(data.error?.message || 'Failed to call patient.');
      }
    } catch {
      alert('Network error calling patient.');
    }
  };

  // Start Consultation
  const handleStartConsultation = async (item: QueueItem | Appointment) => {
    const appointmentId = 'appointmentId' in item ? item.appointmentId : item.id;
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/appointments/${appointmentId}/start-consultation`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOpdQueue();
        if (onStartConsultation) {
          onStartConsultation(data.data);
        }
      } else {
        alert(data.error?.message || 'Failed to start consultation.');
      }
    } catch {
      alert('Network error starting consultation.');
    }
  };

  // Complete Consultation
  const handleCompleteConsultation = async (appointmentId: string) => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/appointments/${appointmentId}/complete`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOpdQueue();
        if (activeTab === 'list') fetchAppointments(page);
      } else {
        alert(data.error?.message || 'Failed to complete consultation.');
      }
    } catch {
      alert('Network error completing consultation.');
    }
  };

  // Submit Regular Booking
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setBookingError('Please select a patient.');
      return;
    }
    if (!selectedDoctorId) {
      setBookingError('Please select a doctor.');
      return;
    }
    if (!selectedSlot) {
      setBookingError('Please choose an available appointment time slot.');
      return;
    }

    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const payload: CreateAppointmentDto = {
        patient: selectedPatient.id,
        doctor: selectedDoctorId,
        date: bookingDate,
        start: selectedSlot,
        minutes: durationMinutes,
        status: 'scheduled',
        priority,
        remarks: remarks.trim() || undefined,
        video: isVideo,
        b_p: bp.trim() || undefined,
        pulse: pulse.trim() || undefined,
        temprature: temperature.trim() || undefined,
        weight: weight.trim() || undefined,
        branchId: activeBranchId ? Number(activeBranchId) : undefined,
      };

      const res = await fetch(`${apiBaseUrl}/api/v1/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowBookModal(false);
        setRemarks('');
        setBp('');
        setPulse('');
        setTemperature('');
        setWeight('');
        setIsVideo(false);
        fetchAppointments(1);
        fetchOpdQueue();
      } else {
        const msg = data.error?.message || data.message || 'Booking failed.';
        setBookingError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setBookingError('Network communication error with scheduling engine.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Submit Walk-in Appointment
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInDoctorId) {
      setWalkInError('Please select an attending doctor.');
      return;
    }

    if (walkInMode === 'existing' && !selectedWalkInPatient) {
      setWalkInError('Please search and select an existing patient.');
      return;
    }

    if (walkInMode === 'new' && !newPatName.trim()) {
      setWalkInError('Please enter the patient name.');
      return;
    }

    setWalkInSubmitting(true);
    setWalkInError(null);

    try {
      const payload: WalkInAppointmentDto = {
        doctor: walkInDoctorId,
        priority: walkInPriority,
        reason: walkInReason.trim() || undefined,
        remarks: walkInRemarks.trim() || undefined,
        branchId: activeBranchId ? Number(activeBranchId) : undefined,
      };

      if (walkInMode === 'existing' && selectedWalkInPatient) {
        payload.patient = selectedWalkInPatient.id;
      } else {
        payload.newPatient = {
          name: newPatName.trim(),
          phone: newPatPhone.trim() || undefined,
          sex: newPatSex,
          age: newPatAge ? parseInt(newPatAge, 10) : undefined,
          bloodGroup: newPatBlood || undefined,
          address: newPatAddress.trim() || undefined,
        };
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/appointments/walk-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowWalkInModal(false);
        setSelectedWalkInPatient(null);
        setNewPatName('');
        setNewPatPhone('');
        setNewPatAge('');
        setWalkInReason('');
        setWalkInRemarks('');
        fetchOpdQueue();
        if (activeTab === 'list') fetchAppointments(1);
      } else {
        const msg = data.error?.message || data.message || 'Walk-in registration failed.';
        setWalkInError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setWalkInError('Network error registering walk-in patient.');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    if (!rescheduleSlot) {
      setRescheduleError('Please choose a new time slot.');
      return;
    }

    setRescheduleSubmitting(true);
    setRescheduleError(null);

    try {
      const payload: RescheduleAppointmentDto = {
        date: rescheduleDate,
        start: rescheduleSlot,
        reason: rescheduleReason.trim() || 'Patient requested reschedule',
      };

      const res = await fetch(
        `${apiBaseUrl}/api/v1/appointments/${rescheduleTarget.id}/reschedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setRescheduleTarget(null);
        setRescheduleReason('');
        fetchAppointments(page);
        fetchOpdQueue();
      } else {
        const msg = data.error?.message || data.message || 'Rescheduling failed.';
        setRescheduleError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setRescheduleError('Network error communicating with scheduling engine.');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  // Submit Cancellation
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for cancelling this appointment.');
      return;
    }

    setCancelSubmitting(true);
    setCancelError(null);

    try {
      const payload: CancelAppointmentDto = {
        reason: cancelReason.trim(),
      };

      const res = await fetch(
        `${apiBaseUrl}/api/v1/appointments/${cancelTarget.id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setCancelTarget(null);
        setCancelReason('');
        fetchAppointments(page);
        fetchOpdQueue();
      } else {
        const msg = data.error?.message || data.message || 'Cancellation failed.';
        setCancelError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setCancelError('Network error cancelling appointment.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Save Doctor Weekly Schedule Matrix
  const handleSaveDoctorSchedule = async () => {
    if (!selectedScheduleDoctorId) return;
    setScheduleSaving(true);
    setScheduleSuccessMsg(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/doctors/${selectedScheduleDoctorId}/schedules`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slots: doctorSlots }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setScheduleSuccessMsg('Doctor weekly schedule updated successfully.');
        fetchDoctorSchedules();
      } else {
        alert(data.error?.message || 'Failed to update schedule.');
      }
    } catch {
      alert('Network error saving schedule.');
    } finally {
      setScheduleSaving(false);
    }
  };

  // Add Doctor Leave
  const handleAddDoctorLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleDoctorId || !newLeaveDate) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/doctors/${selectedScheduleDoctorId}/leaves`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: newLeaveDate,
            startTime: newLeaveStartTime || undefined,
            endTime: newLeaveEndTime || undefined,
            reason: newLeaveReason || 'Leave',
            branchId: activeBranchId ? Number(activeBranchId) : undefined,
          }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setNewLeaveReason('');
        setNewLeaveStartTime('');
        setNewLeaveEndTime('');
        fetchDoctorSchedules();
      } else {
        alert(data.error?.message || 'Failed to record leave.');
      }
    } catch {
      alert('Network error adding leave.');
    }
  };

  // Delete Doctor Leave
  const handleDeleteDoctorLeave = async (blockId: string) => {
    if (!confirm('Remove this leave block?')) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/doctors/${selectedScheduleDoctorId}/leaves/${blockId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        fetchDoctorSchedules();
      }
    } catch {
      alert('Network error deleting leave block.');
    }
  };

  const getPriorityBadgeClass = (p?: string) => {
    switch (p) {
      case 'EMERGENCY':
        return 'badge-danger';
      case 'URGENT':
        return 'badge-warning';
      case 'VIP':
        return 'badge-primary';
      default:
        return 'badge-secondary';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Fast Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Calendar size={22} style={{ color: '#0284c7' }} />
            Outpatient Clinic Operations & Waiting Queue
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Real-time OPD queue tracking, doctor consultation schedules, appointments, and walk-in triage
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (doctorsList.length > 0 && !walkInDoctorId) {
                setWalkInDoctorId(doctorsList[0].id);
              }
              setShowWalkInModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Activity size={16} style={{ color: '#d97706' }} />
            Walk-in Patient
          </button>

          <button
            className="btn btn-primary"
            onClick={() => {
              if (!selectedDoctorId && doctorsList.length > 0) {
                setSelectedDoctorId(doctorsList[0].id);
              }
              setShowBookModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Book Appointment
          </button>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: 2,
        }}
      >
        <button
          onClick={() => setActiveTab('queue')}
          style={{
            padding: '8px 18px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'queue' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: -2,
            background: 'transparent',
            color: activeTab === 'queue' ? '#0284c7' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={16} />
          Live OPD Queue
          {queueSummary.totalWaiting > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              {queueSummary.totalWaiting}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('list')}
          style={{
            padding: '8px 18px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'list' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: -2,
            background: 'transparent',
            color: activeTab === 'list' ? '#0284c7' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CalendarDays size={16} />
          Appointments List
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          style={{
            padding: '8px 18px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'schedules' ? '2px solid #0284c7' : '2px solid transparent',
            marginBottom: -2,
            background: 'transparent',
            color: activeTab === 'schedules' ? '#0284c7' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Coffee size={16} />
          Doctor Availability & Schedules
        </button>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 8,
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: LIVE OPD WAITING QUEUE */}
      {/* ============================================================== */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Queue Metrics Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Waiting in Queue
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>
                  {queueSummary.totalWaiting}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Stethoscope size={24} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  In Consultation
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0284c7' }}>
                  {queueSummary.totalInConsultation}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle size={24} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Completed Today
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>
                  {queueSummary.totalCompletedToday}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={24} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Average Wait
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>
                  {queueSummary.averageWaitMinutes} <span style={{ fontSize: 13, fontWeight: 500 }}>min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Queue Filter Bar */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Stethoscope size={16} style={{ color: '#64748b' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Doctor Filter:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '6px 12px' }}
                  value={queueDoctorFilter}
                  onChange={(e) => setQueueDoctorFilter(e.target.value)}
                >
                  <option value="">All OPD Doctors</option>
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-secondary"
                onClick={fetchOpdQueue}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <RefreshCw size={14} className={queueLoading ? 'animate-spin' : ''} />
                Refresh Queue
              </button>
            </div>
          </div>

          {/* Queue Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px', width: 60 }}>Pos</th>
                    <th style={{ padding: '10px 14px' }}>Token #</th>
                    <th style={{ padding: '10px 14px' }}>Priority</th>
                    <th style={{ padding: '10px 14px' }}>Patient</th>
                    <th style={{ padding: '10px 14px' }}>Doctor</th>
                    <th style={{ padding: '10px 14px' }}>Wait Duration</th>
                    <th style={{ padding: '10px 14px' }}>Queue State</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Front-Desk Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueLoading && queueItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading real-time waiting queue...
                      </td>
                    </tr>
                  ) : queueItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Users size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                        <div>No patients currently waiting in the OPD queue.</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Check in scheduled appointments or register walk-in patients to add them to queue.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    queueItems.map((item) => (
                      <tr key={item.appointmentId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>
                          #{item.queuePosition}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              background: '#f1f5f9',
                              color: '#0f172a',
                              padding: '4px 8px',
                              borderRadius: 6,
                              letterSpacing: '0.5px',
                            }}
                          >
                            {item.tokenNumber}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className={`badge ${getPriorityBadgeClass(item.priority)}`}
                            style={{ fontWeight: 700, fontSize: 11 }}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{item.patient?.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            MRN #{item.patient?.patientId || item.patient?.id}
                            {item.patient?.allergies && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  color: '#dc2626',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 2,
                                }}
                              >
                                <ShieldAlert size={12} />
                                Allergy: {item.patient.allergies}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{item.doctor?.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {item.doctor?.department || 'General OPD'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: item.waitingMinutes > 30 ? '#dc2626' : 'var(--text-main)' }}>
                            <Clock size={14} />
                            {item.waitingMinutes} min
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className={`badge ${
                              item.status === 'in_consultation'
                                ? 'badge-primary'
                                : item.status === 'called'
                                ? 'badge-warning'
                                : 'badge-secondary'
                            }`}
                            style={{ textTransform: 'capitalize' }}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {item.status === 'waiting' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, color: '#d97706' }}
                                onClick={() => handleCallPatient(item.appointmentId)}
                                title="Call patient to consultation room"
                              >
                                Call Patient
                              </button>
                            )}

                            {(item.status === 'waiting' || item.status === 'called') && (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: 12 }}
                                onClick={() => handleStartConsultation(item)}
                                title="Start Doctor Consultation"
                              >
                                <Stethoscope size={14} />
                                Start Consult
                              </button>
                            )}

                            {item.status === 'in_consultation' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, color: '#15803d' }}
                                onClick={() => handleCompleteConsultation(item.appointmentId)}
                                title="Mark Consultation Completed"
                              >
                                <CheckCircle size={14} />
                                Complete
                              </button>
                            )}

                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                              onClick={() => {
                                setCancelTarget({
                                  id: item.appointmentId,
                                  patientId: item.patient.id,
                                  doctorId: item.doctor.id,
                                  date: todayStr,
                                  timeSlot: item.timeSlot,
                                  sTime: '',
                                  eTime: '',
                                  status: item.status,
                                  mode: 'in_person',
                                  patient: item.patient,
                                  doctor: item.doctor,
                                });
                              }}
                              title="Cancel / Remove from queue"
                            >
                              <Ban size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: APPOINTMENT LIST VIEW */}
      {/* ============================================================== */}
      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filter Toolbar */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} style={{ color: '#64748b' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Date:</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 'auto', padding: '6px 10px' }}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Stethoscope size={16} style={{ color: '#64748b' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Doctor:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '6px 10px' }}
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                >
                  <option value="">All Consultants</option>
                  {doctorsList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={16} style={{ color: '#64748b' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Status:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '6px 10px' }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="waiting">Waiting in Queue</option>
                  <option value="in_consultation">In Consultation</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFilterDate(todayStr);
                  setFilterDoctor('');
                  setFilterStatus('');
                }}
                style={{ marginLeft: 'auto', fontSize: 12 }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Appointment Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Outpatient Encounters: <strong style={{ color: 'var(--text-main)' }}>{total}</strong>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Date: <strong>{filterDate || 'All dates'}</strong>
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 16px' }}>Slot Time</th>
                    <th style={{ padding: '10px 16px' }}>Token</th>
                    <th style={{ padding: '10px 16px' }}>Patient</th>
                    <th style={{ padding: '10px 16px' }}>Attending Doctor</th>
                    <th style={{ padding: '10px 16px' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading appointment schedule...
                      </td>
                    </tr>
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No appointments found for this selection.
                      </td>
                    </tr>
                  ) : (
                    appointments.map((apt) => (
                      <tr key={apt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} />
                            {apt.timeSlot || apt.sTime?.split(' ')[1] || 'TBD'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {apt.date}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {apt.tokenNumber ? (
                            <span style={{ fontWeight: 700, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                              {apt.tokenNumber}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{apt.patient?.name || `Patient #${apt.patientId}`}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            MRN #{apt.patient?.patientId || apt.patientId}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{apt.doctor?.name || `Doctor #${apt.doctorId}`}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {apt.doctor?.department || 'General OPD'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className={`badge ${
                              apt.status === 'completed'
                                ? 'badge-success'
                                : apt.status === 'in_consultation' || apt.status === 'in consultation'
                                ? 'badge-primary'
                                : apt.status === 'waiting' || apt.status === 'called'
                                ? 'badge-warning'
                                : apt.status === 'cancelled'
                                ? 'badge-danger'
                                : 'badge'
                            }`}
                            style={{ textTransform: 'capitalize', fontWeight: 600 }}
                          >
                            {apt.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {apt.videoUrl && (
                              <a
                                href={apt.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, color: '#0284c7' }}
                                title="Join Telemedicine Video Call"
                              >
                                <Video size={14} /> Video
                              </a>
                            )}

                            {apt.status === 'scheduled' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, color: '#d97706' }}
                                onClick={() => handleCheckIn(apt.id)}
                                title="Issue token and add to OPD Queue"
                              >
                                <CheckCircle size={14} /> Check In
                              </button>
                            )}

                            {apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'rescheduled' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, color: '#0284c7' }}
                                onClick={() => {
                                  setRescheduleTarget(apt);
                                  setRescheduleDate(apt.date);
                                }}
                                title="Reschedule Appointment"
                              >
                                <ArrowRight size={14} /> Reschedule
                              </button>
                            )}

                            {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                                onClick={() => setCancelTarget(apt)}
                                title="Cancel Appointment"
                              >
                                <X size={14} /> Cancel
                              </button>
                            )}

                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => setDetailTarget(apt)}
                              title="View Details & Audit Trail"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                }}
              >
                <button
                  className="btn btn-secondary"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    const prev = Math.max(1, page - 1);
                    setPage(prev);
                    fetchAppointments(prev);
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
                    fetchAppointments(next);
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: DOCTOR AVAILABILITY & SCHEDULE MANAGEMENT */}
      {/* ============================================================== */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Doctor Selector */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Stethoscope size={20} style={{ color: '#0284c7' }} />
              <label style={{ fontSize: 14, fontWeight: 700 }}>Select Doctor:</label>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: 260 }}
                value={selectedScheduleDoctorId}
                onChange={(e) => setSelectedScheduleDoctorId(e.target.value)}
              >
                {doctorsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.department || 'General Practice'}
                  </option>
                ))}
              </select>

              {scheduleSuccessMsg && (
                <span style={{ color: '#15803d', fontWeight: 600, fontSize: 13, marginLeft: 'auto' }}>
                  ✓ {scheduleSuccessMsg}
                </span>
              )}
            </div>
          </div>

          {/* Weekly Schedule Grid */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: '#0284c7' }} />
              Weekly Consultation Hours & Breaks
            </h3>

            {scheduleLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading doctor schedules...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {doctorSlots.map((slot, idx) => (
                  <div
                    key={slot.weekday}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 80px 1fr 1fr 100px 1fr',
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: slot.active ? 'var(--bg-card)' : '#f8fafc',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      opacity: slot.active ? 1 : 0.6,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{WEEKDAYS[slot.weekday]}</div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={slot.active}
                          onChange={(e) => {
                            const updated = [...doctorSlots];
                            updated[idx] = { ...updated[idx], active: e.target.checked };
                            setDoctorSlots(updated);
                          }}
                        />
                        {slot.active ? 'Active' : 'Off'}
                      </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hours:</span>
                      <input
                        type="time"
                        className="form-input"
                        disabled={!slot.active}
                        value={slot.startTime}
                        onChange={(e) => {
                          const updated = [...doctorSlots];
                          updated[idx] = { ...updated[idx], startTime: e.target.value };
                          setDoctorSlots(updated);
                        }}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        className="form-input"
                        disabled={!slot.active}
                        value={slot.endTime}
                        onChange={(e) => {
                          const updated = [...doctorSlots];
                          updated[idx] = { ...updated[idx], endTime: e.target.value };
                          setDoctorSlots(updated);
                        }}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Coffee size={14} style={{ color: '#d97706' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Break:</span>
                      <input
                        type="time"
                        className="form-input"
                        disabled={!slot.active}
                        placeholder="Start"
                        value={slot.breakStartTime || ''}
                        onChange={(e) => {
                          const updated = [...doctorSlots];
                          updated[idx] = {
                            ...updated[idx],
                            breakStartTime: e.target.value || null,
                          };
                          setDoctorSlots(updated);
                        }}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        className="form-input"
                        disabled={!slot.active}
                        placeholder="End"
                        value={slot.breakEndTime || ''}
                        onChange={(e) => {
                          const updated = [...doctorSlots];
                          updated[idx] = {
                            ...updated[idx],
                            breakEndTime: e.target.value || null,
                          };
                          setDoctorSlots(updated);
                        }}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                    </div>

                    <div>
                      <select
                        className="form-select"
                        disabled={!slot.active}
                        value={slot.slotMinutes}
                        onChange={(e) => {
                          const updated = [...doctorSlots];
                          updated[idx] = {
                            ...updated[idx],
                            slotMinutes: parseInt(e.target.value, 10),
                          };
                          setDoctorSlots(updated);
                        }}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        <option value="10">10 min</option>
                        <option value="15">15 min</option>
                        <option value="20">20 min</option>
                        <option value="30">30 min</option>
                      </select>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {slot.active
                        ? `${slot.startTime}-${slot.endTime} (${slot.slotMinutes}m slots)`
                        : 'Doctor clinic closed'}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    disabled={scheduleSaving}
                    onClick={handleSaveDoctorSchedule}
                  >
                    {scheduleSaving ? 'Saving...' : 'Save Weekly Schedule'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Doctor Leaves & Unavailable Periods */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ban size={18} style={{ color: '#ef4444' }} />
              Scheduled Leaves & Blocks
            </h3>

            {/* Add Leave Form */}
            <form
              onSubmit={handleAddDoctorLeave}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto',
                gap: 12,
                alignItems: 'end',
                padding: 14,
                background: '#f8fafc',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Leave Date *</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={newLeaveDate}
                  onChange={(e) => setNewLeaveDate(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Start Time (Optional)</label>
                <input
                  type="time"
                  className="form-input"
                  value={newLeaveStartTime}
                  onChange={(e) => setNewLeaveStartTime(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>End Time (Optional)</label>
                <input
                  type="time"
                  className="form-input"
                  value={newLeaveEndTime}
                  onChange={(e) => setNewLeaveEndTime(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Reason</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Surgery / Personal leave"
                  value={newLeaveReason}
                  onChange={(e) => setNewLeaveReason(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                Add Leave
              </button>
            </form>

            {/* Existing Leaves List */}
            {doctorLeaves.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>
                No upcoming leaves configured for this doctor.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doctorLeaves.map((l) => (
                  <div
                    key={l.id || l.date}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <strong style={{ color: '#be123c' }}>{l.date}</strong>
                      <span style={{ marginLeft: 8, fontSize: 13, color: '#881337' }}>
                        {l.startTime && l.endTime
                          ? `${l.startTime} to ${l.endTime}`
                          : 'Full Day Unavailable'}
                      </span>
                      {l.reason && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                          • {l.reason}
                        </span>
                      )}
                    </div>
                    {l.id && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                        onClick={() => handleDeleteDoctorLeave(l.id!)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: WALK-IN ENCOUNTER REGISTRATION */}
      {/* ============================================================== */}
      {showWalkInModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 600,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowWalkInModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3
              style={{
                margin: '0 0 14px 0',
                fontSize: 18,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Activity size={20} style={{ color: '#d97706' }} />
              Walk-in Patient Triage & Queue Registration
            </h3>

            {walkInError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: 6,
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                <AlertCircle size={16} />
                <span>{walkInError}</span>
              </div>
            )}

            <form onSubmit={handleWalkInSubmit}>
              {/* Patient Selection Toggle */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="walkInMode"
                    checked={walkInMode === 'existing'}
                    onChange={() => setWalkInMode('existing')}
                  />
                  Existing Patient
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="walkInMode"
                    checked={walkInMode === 'new'}
                    onChange={() => setWalkInMode('new')}
                  />
                  Register New Walk-in Patient
                </label>
              </div>

              {walkInMode === 'existing' ? (
                <div className="form-group">
                  <label className="form-label">Search Patient (MRN or Name) *</label>
                  {selectedWalkInPatient ? (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: '#fef3c7',
                        borderRadius: 8,
                        border: '1px solid #fde68a',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#b45309' }}>{selectedWalkInPatient.name}</strong>
                        <span style={{ fontSize: 12, color: '#92400e', marginLeft: 8 }}>
                          MRN #{selectedWalkInPatient.patientId || selectedWalkInPatient.id}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedWalkInPatient(null)}
                        style={{ fontSize: 12, color: '#b45309', textDecoration: 'underline' }}
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
                        value={walkInPatientSearch}
                        onChange={(e) => setWalkInPatientSearch(e.target.value)}
                      />
                      {walkInSearchedPatients.length > 0 && (
                        <div
                          style={{
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
                            overflowY: 'auto',
                          }}
                        >
                          {walkInSearchedPatients.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedWalkInPatient(p);
                                setWalkInPatientSearch('');
                                setWalkInSearchedPatients([]);
                              }}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                fontSize: 13,
                              }}
                            >
                              <strong>{p.name}</strong>{' '}
                              <span style={{ color: '#0284c7' }}>#{p.patientId || p.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                    QUICK DEMOGRAPHIC DETAILS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Full Name *</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={newPatName}
                        onChange={(e) => setNewPatName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Phone Number</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={newPatPhone}
                        onChange={(e) => setNewPatPhone(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Sex</label>
                      <select
                        className="form-select"
                        value={newPatSex}
                        onChange={(e) => setNewPatSex(e.target.value)}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Age</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newPatAge}
                        onChange={(e) => setNewPatAge(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Attending Doctor *</label>
                  <select
                    className="form-select"
                    required
                    value={walkInDoctorId}
                    onChange={(e) => setWalkInDoctorId(e.target.value)}
                  >
                    <option value="">Select Doctor</option>
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Triage Priority *</label>
                  <select
                    className="form-select"
                    value={walkInPriority}
                    onChange={(e) => setWalkInPriority(e.target.value as any)}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="VIP">VIP</option>
                    <option value="EMERGENCY">Emergency (Jump Queue)</option>
                  </select>
                </div>
              </div>

              {/* Chief Complaint */}
              <div className="form-group">
                <label className="form-label">Chief Complaint / Visit Reason *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Acute high fever, breathlessness..."
                  value={walkInReason}
                  onChange={(e) => setWalkInReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowWalkInModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={walkInSubmitting}>
                  {walkInSubmitting ? 'Registering...' : 'Add to OPD Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: REGULAR APPOINTMENT BOOKING MODAL */}
      {/* ============================================================== */}
      {showBookModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowBookModal(false)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: 18,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Plus size={20} style={{ color: '#0284c7' }} />
              Book Outpatient Consultation
            </h3>

            {bookingError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: 6,
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} />
                <span>{bookingError}</span>
              </div>
            )}

            <form onSubmit={handleBookAppointment}>
              {/* Step 1: Patient Selection */}
              <div className="form-group">
                <label className="form-label">1. Select Patient *</label>
                {selectedPatient ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: '#e0f2fe',
                      borderRadius: 8,
                      border: '1px solid #bae6fd',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0369a1' }}>{selectedPatient.name}</strong>
                      <span style={{ fontSize: 12, color: '#0284c7', marginLeft: 8 }}>
                        MRN #{selectedPatient.patientId || selectedPatient.id}
                      </span>
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
                      value={bookPatientSearch}
                      onChange={(e) => setBookPatientSearch(e.target.value)}
                    />
                    {searchedPatients.length > 0 && (
                      <div
                        style={{
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
                          overflowY: 'auto',
                        }}
                      >
                        {searchedPatients.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatient(p);
                              setBookPatientSearch('');
                              setSearchedPatients([]);
                            }}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                          >
                            <strong>{p.name}</strong>{' '}
                            <span style={{ color: '#0284c7' }}>#{p.patientId || p.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Doctor, Priority and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">2. Attending Doctor *</label>
                  <select
                    className="form-select"
                    required
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    <option value="">Select Doctor</option>
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                    <option value="VIP">VIP</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Appointment Date *</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Step 3: Available Free Slot Picker */}
              <div className="form-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <label className="form-label" style={{ margin: 0 }}>
                    3. Available Consultation Slots
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                    <select
                      className="form-select"
                      style={{ width: 'auto', padding: '2px 6px', fontSize: 11 }}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 15)}
                    >
                      <option value="15">15 mins</option>
                      <option value="30">30 mins</option>
                      <option value="45">45 mins</option>
                    </select>
                  </div>
                </div>

                {slotsLoading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Checking doctor availability & clinic schedule...
                  </div>
                ) : !selectedDoctorId ? (
                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: '#64748b' }}>
                    Please select an attending doctor above to view available consultation slots.
                  </div>
                ) : freeSlots.length === 0 ? (
                  <div style={{ padding: 14, background: '#fffbeb', borderRadius: 6, border: '1px solid #fef3c7', fontSize: 13, color: '#92400e' }}>
                    No consultation slots available for this doctor on {bookingDate}.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 130, overflowY: 'auto', padding: 4 }}>
                    {freeSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot.start)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: selectedSlot === slot.start ? '#0284c7' : 'var(--border-color)',
                          background: selectedSlot === slot.start ? '#0284c7' : 'var(--bg-subtle)',
                          color: selectedSlot === slot.start ? '#fff' : 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        {slot.start}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preliminary Vitals Intake */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-main)' }}>
                  Preliminary Vitals (Optional)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Blood Pressure</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="120/80"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Pulse (bpm)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="72"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Temp</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="98.6 F"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Weight</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="70 kg"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Remarks & Telemedicine */}
              <div className="form-group">
                <label className="form-label">Chief Complaint / Remarks</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Patient reason for visit..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <input
                  type="checkbox"
                  id="telemedicine-check"
                  checked={isVideo}
                  onChange={(e) => setIsVideo(e.target.checked)}
                />
                <label
                  htmlFor="telemedicine-check"
                  style={{
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Video size={14} style={{ color: '#0284c7' }} /> Enable Jitsi Telemedicine Video Room
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBookModal(false)}
                  disabled={bookingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bookingSubmitting || !selectedSlot}
                >
                  {bookingSubmitting ? 'Confirming...' : `Confirm Booking for ${selectedSlot || '...'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: RESCHEDULE APPOINTMENT MODAL */}
      {/* ============================================================== */}
      {rescheduleTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 520, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setRescheduleTarget(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowRight size={18} style={{ color: '#0284c7' }} />
              Reschedule Outpatient Appointment
            </h3>

            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
              <div><strong>Patient:</strong> {rescheduleTarget.patient?.name}</div>
              <div><strong>Doctor:</strong> {rescheduleTarget.doctor?.name}</div>
              <div><strong>Current Slot:</strong> {rescheduleTarget.date} at {rescheduleTarget.timeSlot}</div>
            </div>

            {rescheduleError && (
              <div style={{ padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
                {rescheduleError}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit}>
              <div className="form-group">
                <label className="form-label">New Date *</label>
                <input
                  type="date"
                  required
                  className="form-input"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Available Slots on {rescheduleDate} *</label>
                {rescheduleSlotsLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Checking slots...</div>
                ) : rescheduleFreeSlots.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#dc2626' }}>No slots available on this date.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
                    {rescheduleFreeSlots.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        onClick={() => setRescheduleSlot(s.start)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: rescheduleSlot === s.start ? '#0284c7' : 'var(--border-color)',
                          background: rescheduleSlot === s.start ? '#0284c7' : 'var(--bg-subtle)',
                          color: rescheduleSlot === s.start ? '#fff' : 'var(--text-main)',
                        }}
                      >
                        {s.start}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Rescheduling</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Doctor in emergency surgery / Patient delayed"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRescheduleTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={rescheduleSubmitting || !rescheduleSlot}
                >
                  {rescheduleSubmitting ? 'Rescheduling...' : `Confirm New Time (${rescheduleSlot || '...'})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: CANCELLATION MODAL */}
      {/* ============================================================== */}
      {cancelTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 480, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setCancelTarget(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 14px 0', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
              <Ban size={18} />
              Cancel Appointment
            </h3>

            <div style={{ padding: 12, background: '#fff1f2', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
              <div><strong>Patient:</strong> {cancelTarget.patient?.name}</div>
              <div><strong>Doctor:</strong> {cancelTarget.doctor?.name}</div>
              <div><strong>Date & Time:</strong> {cancelTarget.date} {cancelTarget.timeSlot}</div>
            </div>

            {cancelError && (
              <div style={{ padding: 10, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 13, marginBottom: 14 }}>
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSubmit}>
              <div className="form-group">
                <label className="form-label">Mandatory Cancellation Reason *</label>
                <textarea
                  required
                  rows={3}
                  className="form-textarea"
                  placeholder="State clinical or patient rationale for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCancelTarget(null)}
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  disabled={cancelSubmitting || !cancelReason.trim()}
                >
                  {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: APPOINTMENT DETAIL & AUDIT MODAL */}
      {/* ============================================================== */}
      {detailTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 540, width: '100%', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setDetailTarget(null)}
              style={{ position: 'absolute', right: 18, top: 18, color: '#94a3b8' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={18} style={{ color: '#0284c7' }} />
              Appointment Record & Audit Trail
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 16 }}>
              <div><strong>Appointment ID:</strong> #{detailTarget.id}</div>
              <div><strong>Status:</strong> {detailTarget.status}</div>
              <div><strong>Patient:</strong> {detailTarget.patient?.name}</div>
              <div><strong>MRN:</strong> {detailTarget.patient?.patientId}</div>
              <div><strong>Doctor:</strong> {detailTarget.doctor?.name}</div>
              <div><strong>Department:</strong> {detailTarget.department || detailTarget.doctor?.department || 'General'}</div>
              <div><strong>Date & Slot:</strong> {detailTarget.date} {detailTarget.timeSlot}</div>
              <div><strong>Token:</strong> {detailTarget.tokenNumber || 'None'}</div>
              <div><strong>Priority:</strong> {detailTarget.priority || 'NORMAL'}</div>
              <div><strong>Mode:</strong> {detailTarget.mode}</div>
              {detailTarget.checkedInAt && (
                <div><strong>Checked In:</strong> {new Date(detailTarget.checkedInAt).toLocaleTimeString()}</div>
              )}
              {detailTarget.consultStartedAt && (
                <div><strong>Consult Started:</strong> {new Date(detailTarget.consultStartedAt).toLocaleTimeString()}</div>
              )}
              {detailTarget.completedAt && (
                <div><strong>Completed:</strong> {new Date(detailTarget.completedAt).toLocaleTimeString()}</div>
              )}
              {detailTarget.cancellationReason && (
                <div style={{ gridColumn: 'span 2', color: '#dc2626' }}>
                  <strong>Cancellation Reason:</strong> {detailTarget.cancellationReason}
                </div>
              )}
              {detailTarget.rescheduledFromId && (
                <div style={{ gridColumn: 'span 2', color: '#0284c7' }}>
                  <strong>Rescheduled From:</strong> Appointment #{detailTarget.rescheduledFromId}
                  {detailTarget.rescheduleReason && ` (${detailTarget.rescheduleReason})`}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDetailTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
