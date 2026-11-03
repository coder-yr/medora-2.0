# Medora 2.0 — Frontend API Integration Mapping

## 1. Authentication & Security Endpoints

| Method | Endpoint | Description | Request Payload | Response DTO |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Staff user authentication | `{ email, password }` | `{ accessToken, refreshToken, user }` |
| `POST` | `/api/v1/auth/refresh` | Token rotation | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `POST` | `/api/v1/auth/logout` | Revoke active session | `{ refreshToken }` | `{ message }` |
| `GET` | `/api/v1/auth/me` | Current profile & permissions | *None (Bearer Token)* | `UserProfileDto` |
| `POST` | `/api/v1/auth/change-password` | Password update | `{ oldPassword, newPassword }` | `{ success: true }` |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset link | `{ email }` | `{ success: true }` |

---

## 2. Clinical Operations & Patient Management

### Patient Registry (`/api/v1/patients`)
- **`GET /api/v1/patients?q={query}&page={page}&limit={limit}&branchId={branchId}`**: Searches patients across name, MRN (`patientId`), phone, CNIC, and email.
- **`GET /api/v1/patients/:id`**: Retrieves full demographic details by internal ID or 6-digit MRN.
- **`POST /api/v1/patients`**: Registers a new patient. Payload:
  ```json
  {
    "name": "Fatima Noor",
    "fatherName": "Noor Muhammad",
    "sex": "female",
    "birthdate": "1995-04-12",
    "phone": "03112233445",
    "cnic": "37405-1234567-2",
    "bloodGroup": "B+",
    "city": "Islamabad",
    "address": "Sector F-8, Islamabad",
    "mlc": false,
    "branchId": 1
  }
  ```

### Doctor & Department Directory (`/api/v1/doctors`, `/api/v1/departments`)
- **`GET /api/v1/doctors?q={q}&page={p}&limit={l}&branchId={b}`**: Returns paginated doctors with upcoming appointment loads.
- **`GET /api/v1/doctors/departments`**: Returns list of active department names.
- **`POST /api/v1/doctors`**: Adds a new doctor consultant.
- **`GET /api/v1/departments`**: Returns department catalogue with doctor counts and unlisted strings.
- **`POST /api/v1/departments/adopt`**: Creates formal catalogue records for unlisted doctor specialties.

### Appointments & Visits (`/api/v1/appointments`)
- **`GET /api/v1/appointments/free-slots?doctor={doctorId}&date={date}`**: Dynamic slot calculator subtracting booked visits from clinic schedule.
- **`GET /api/v1/appointments?date={date}&doctor={doctorId}&status={status}&page={p}`**: Daily front-desk appointment roster.
- **`POST /api/v1/appointments`**: Books an appointment with double-booking prevention.
- **`PATCH /api/v1/appointments/:id`**: Updates appointment status (`arrived`, `in consultation`, `completed`, `cancelled`).

### Consultations & Encounters (`/api/v1/consultations`)
- **`GET /api/v1/consultations/visit/:appointmentId`**: Preloads encounter workspace with carry-forward allergies, previous visit records, and clinical note templates.
- **`POST /api/v1/consultations/visit/:appointmentId`**: Saves draft (`action: 'save'`) or finalizes encounter (`action: 'complete'`). Updates appointment vitals simultaneously.

### Prescriptions (`/api/v1/prescriptions`)
- **`GET /api/v1/prescriptions?drug={query}`**: Outpatient prescription history.
- **`GET /api/v1/prescriptions/medicines/search?q={query}`**: Live autocomplete from pharmacy medicine formulary.
- **`POST /api/v1/prescriptions`**: Issues prescription with dynamic patient, doctor, and medicine line items.
- **`DELETE /api/v1/prescriptions/:id`**: Restricted removal (Admin only).

---

## 3. Financial & Revenue Invoicing

### Invoices & Payments (`/api/v1/invoices`)
- **`GET /api/v1/invoices?show={all|outstanding|settled}&patient={id}&page={p}`**: Returns paginated invoices with cumulative total owed.
- **`POST /api/v1/invoices`**: Creates patient invoice with itemized line charges, server-side validated subtotal, discount, and VAT.
- **`GET /api/v1/invoices/:id`**: Retrieves detailed invoice record with payment ledger.
- **`POST /api/v1/invoices/:id/pay`**: Applies payment against outstanding invoice balance under row-level balance lock.
- **`DELETE /api/v1/invoices/:id`**: Removes unpaid invoice (only when no payments exist).
