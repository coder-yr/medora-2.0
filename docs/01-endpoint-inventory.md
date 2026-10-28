# Medora 2.0 — Legacy Endpoint Inventory

## 1. Executive Summary
- **Total Route Declarations**: 251 (250 Web routes in `legacy/routes/web.php` + 1 API route in `legacy/routes/api.php`)
- **Unique URI Paths**: 183
- **Middleware Architecture**: `web`, `auth`, `admin`, `checkPermission:{permission_name}`, `activity`
- **Source of Truth**: Read-only audit of `legacy/routes/web.php`, `legacy/routes/api.php`, controllers, and feature test coverage.

---

## 2. Route Domain Breakdown & Target API Mapping

| Domain | Legacy Route Count | Proposed Medora 2.0 NestJS Module | Primary Authorization Guard |
| :--- | :--- | :--- | :--- |
| **Auth & Session** | 15 | `AuthModule (`/api/v1/auth`)` | `Public / JwtAuthGuard` |
| **Administration, Branches & RBAC** | 11 | `AdminModule (`/api/v1/admin`, `/api/v1/branches`)` | `RolesGuard(ADMIN)` |
| **Patient Management** | 16 | `PatientModule (`/api/v1/patients`)` | `PermissionsGuard(patient_*)` |
| **Appointments & Scheduling** | 7 | `AppointmentModule (`/api/v1/appointments`)` | `PermissionsGuard(appointment_*)` |
| **Admissions & Beds** | 14 | `AdmissionModule (`/api/v1/admissions`, `/api/v1/beds`)` | `PermissionsGuard(admission_*, bed_*)` |
| **Clinical Consultations & OPD** | 23 | `ConsultationModule (`/api/v1/consultations`, `/api/v1/opd`)` | `PermissionsGuard(consultation_*, doctor_*)` |
| **Prescriptions & Medicines** | 16 | `PrescriptionModule (`/api/v1/prescriptions`, `/api/v1/medicines`)` | `PermissionsGuard(prescription_*, medicine_*)` |
| **Laboratory & Diagnostics** | 10 | `LabModule (`/api/v1/lab`)` | `PermissionsGuard(lab_test_*)` |
| **Radiology** | 10 | `RadiologyModule (`/api/v1/radiology`)` | `PermissionsGuard(radiology_*)` |
| **Pharmacy & Dispensing** | 5 | `PharmacyModule (`/api/v1/pharmacy`)` | `PermissionsGuard(pharmacy_sale, medicine_*)` |
| **Billing, Pricing & Cashier** | 42 | `BillingModule (`/api/v1/billing`, `/api/v1/cash`, `/api/v1/pricing`)` | `PermissionsGuard(payment_*, invoice_*, cash_close)` |
| **Accounting & Reporting** | 31 | `AccountingModule (`/api/v1/accounting`, `/api/v1/reports`)` | `PermissionsGuard(accounting, view_*_reports)` |
| **Doctors, Staff & Departments** | 18 | `StaffModule (`/api/v1/doctors`, `/api/v1/staff`)` | `PermissionsGuard(doctor_*, staff_*)` |
| **Communications (SMS, Voice, Templates)** | 19 | `CommunicationModule (`/api/v1/communications`)` | `PermissionsGuard(send_sms_voice)` |
| **Utility & Legacy Settings** | 14 | `SettingsModule (`/api/v1/settings`)` | `RolesGuard(ADMIN)` |

---

## Auth & Session (15 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/` | `Closure` | `public` | HTML View | None | ExampleTest.php (GET) |
| **GET** | `/session` | `UsersController@session` | `public` | Redirect (/) | None | *None direct* |
| **GET** | `/` | `HomeController@index` | `public` | View (`login`) | None | ExampleTest.php (GET) |
| **POST** | `/users/login` | `UsersController@postSignin` | `public` | Redirect (/verify_code) | Form validation | *None direct* |
| **GET** | `/verification_code` | `UsersController@codeverify` | `public` | Redirect (/dashboard) | None | *None direct* |
| **POST** | `/users/code_check` | `UsersController@code_check` | `public` | Redirect (/dashboard) | None | *None direct* |
| **GET** | `/verify_code` | `UsersController@verify_code` | `public` | Redirect (/verify_code) | None | *None direct* |
| **POST** | `/verified` | `UsersController@verified` | `public` | Redirect (/verify_code) | None | *None direct* |
| **GET** | `/users/logout` | `UsersController@getLogout` | `public` | Redirect (/dashboard) | Form validation | AdminRouteAccessTest.php (GET) |
| **GET** | `/login/{user_id}` | `UsersController@dologin` | `auth, admin` | Redirect (/dashboard) | Form validation | *None direct* |
| **GET** | `/users` | `UsersController@show` | `auth, admin` | Redirect (/users) | Form validation | AdminRouteAccessTest.php (GET)<br>RoleGroupsTest.php (GET) |
| **POST** | `/usercreate` | `UsersController@create` | `auth, admin` | Redirect (/users) | Form validation | *None direct* |
| **GET** | `/useredit/{id}` | `UsersController@edit` | `auth, admin` | Redirect (/usersedit/) | Form validation | *None direct* |
| **POST** | `/userupdate` | `UsersController@update` | `auth, admin` | Redirect (/usersedit/) | Form validation | *None direct* |
| **GET** | `/userdelete/{id}` | `UsersController@delete` | `auth, admin` | Redirect (/users) | None | *None direct* |

## Administration, Branches & RBAC (11 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/branches` | `InstituteController@branches` | `auth, admin` | Redirect (branches) | Form validation | AdminRouteAccessTest.php (GET) |
| **POST** | `/branch` | `InstituteController@createbranch` | `auth, admin` | Redirect (branches) | Form validation | AdminRouteAccessTest.php (POST) |
| **GET** | `/permission` | `PermissionController@index` | `auth, admin` | Redirect (/permission) | None | AdminRouteAccessTest.php (GET) |
| **POST** | `/permission/create` | `PermissionController@store` | `auth, admin` | Redirect (/permission) | None | AdminRouteAccessTest.php (POST) |
| **GET** | `/institute` | `InstituteController@index` | `auth, admin` | Redirect (branches) | Form validation | *None direct* |
| **POST** | `/institute` | `InstituteController@save` | `auth, admin` | Redirect (institute) | Form validation | *None direct* |
| **GET** | `/hospital-branches` | `BranchController@index` | `checkPermission:branch_view` | Redirect (/hospital-branches) | `name: ['required'`<br>`address: 'nullable|string|max:255'` | BranchPackageVideoTest.php (POST)<br>BranchPackageVideoTest.php (GET) |
| **POST** | `/hospital-branches` | `BranchController@store` | `checkPermission:branch_add` | Redirect (/hospital-branches) | `name: ['required'`<br>`address: 'nullable|string|max:255'` | BranchPackageVideoTest.php (POST)<br>BranchPackageVideoTest.php (GET) |
| **PUT** | `/hospital-branches/{id}` | `BranchController@update` | `checkPermission:branch_update` | Redirect (/hospital-branches) | `name: ['required'`<br>`address: 'nullable|string|max:255'` | *None direct* |
| **POST** | `/hospital-branches/{id}/users` | `BranchController@assign` | `checkPermission:branch_update` | Redirect (/hospital-branches) | `name: ['required'`<br>`address: 'nullable|string|max:255'` | *None direct* |
| **POST** | `/branch/switch` | `BranchController@switch` | `public` | HTML View | `name: ['required'`<br>`address: 'nullable|string|max:255'` | BranchPackageVideoTest.php (POST) |

## Patient Management (16 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/patients` | `PatientController@index` | `checkPermission:patient_view` | Redirect (/patients/) | Form validation | ConcurrentWriteTest.php (POST)<br>ConsultationTest.php (GET) |
| **GET** | `/patients/create` | `PatientController@create` | `checkPermission:patient_add` | Redirect (/patients/) | Form validation | PricingTest.php (GET)<br>QaFixesOct22Test.php (GET) |
| **POST** | `/patients` | `PatientController@store` | `checkPermission:patient_add` | Redirect (/patients/) | Form validation | ConcurrentWriteTest.php (POST)<br>ConsultationTest.php (GET) |
| **GET** | `/patients/{id}` | `PatientController@show` | `checkPermission:patient_view` | Redirect (/patients/) | Form validation | PricingTest.php (GET)<br>QaFixesOct22Test.php (GET) |
| **GET** | `/patients/{id}/card` | `PatientController@card` | `checkPermission:patient_view` | View (`app.patients.card`) | None | *None direct* |
| **GET** | `/patients/{id}/wristband` | `PatientController@wristband` | `checkPermission:patient_view` | View (`app.patients.card`) | None | *None direct* |
| **GET** | `/patients/{id}/edit` | `PatientController@edit` | `checkPermission:patient_update` | Redirect (/patients/) | Form validation | *None direct* |
| **PUT** | `/patients/{id}` | `PatientController@update` | `checkPermission:patient_update` | Redirect (/patients/) | Form validation | PricingTest.php (GET)<br>QaFixesOct22Test.php (GET) |
| **DELETE** | `/patients/{id}` | `PatientController@destroy` | `checkPermission:patient_delete` | Redirect (/patients) | Form validation | PricingTest.php (GET)<br>QaFixesOct22Test.php (GET) |
| **GET** | `/history` | `MedicalHistoryController@index` | `public` | Redirect (/history?patient=) | Form validation | MedicalHistoryTest.php (POST)<br>MedicalHistoryTest.php (GET) |
| **GET** | `/history/create` | `MedicalHistoryController@create` | `public` | Redirect (/history?patient=) | `patient_id: 'required|integer|exists:patient`<br>`title: 'required|string|max:100'` | *None direct* |
| **POST** | `/history` | `MedicalHistoryController@store` | `public` | Redirect (/history?patient=) | `patient_id: 'required|integer|exists:patient`<br>`title: 'required|string|max:100'` | MedicalHistoryTest.php (POST)<br>MedicalHistoryTest.php (GET) |
| **GET** | `/history/{id}/edit` | `MedicalHistoryController@edit` | `public` | Redirect (/history?patient=) | `patient_id: 'required|integer|exists:patient`<br>`title: 'required|string|max:100'` | *None direct* |
| **PUT** | `/history/{id}` | `MedicalHistoryController@update` | `public` | Redirect (/history?patient=) | `patient_id: 'required|integer|exists:patient`<br>`title: 'required|string|max:100'` | *None direct* |
| **DELETE** | `/history/{id}` | `MedicalHistoryController@destroy` | `public` | Redirect (/history?patient=) | `patient_id: 'required|integer|exists:patient`<br>`title: 'required|string|max:100'` | *None direct* |
| **GET** | `/history/{id}/attachment` | `MedicalHistoryController@attachment` | `public` | HTML View | None | *None direct* |

## Appointments & Scheduling (7 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/appointments` | `AppointmentController@index` | `checkPermission:appointment_view` | Redirect (/appointments?date=) | Form validation | AppointmentTest.php (POST)<br>AppointmentTest.php (PUT) |
| **GET** | `/appointments/create` | `AppointmentController@create` | `checkPermission:appointment_add` | Redirect (/appointments?date=) | Form validation | *None direct* |
| **POST** | `/appointments` | `AppointmentController@store` | `checkPermission:appointment_add` | Redirect (/appointments?date=) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | AppointmentTest.php (POST)<br>AppointmentTest.php (PUT) |
| **GET** | `/appointments/{id}` | `AppointmentController@show` | `checkPermission:appointment_view` | Redirect (/appointments/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **GET** | `/appointments/{id}/edit` | `AppointmentController@edit` | `checkPermission:appointment_update` | Redirect (/appointments/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **PUT** | `/appointments/{id}` | `AppointmentController@update` | `checkPermission:appointment_update` | Redirect (/appointments/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **DELETE** | `/appointments/{id}` | `AppointmentController@destroy` | `checkPermission:appointment_cancel` | Redirect (/appointments?date=) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |

## Admissions & Beds (14 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/beds` | `BedController@index` | `checkPermission:bed_view` | Redirect (/beds) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | AdmissionTest.php (DELETE)<br>AdmissionTest.php (POST) |
| **GET** | `/beds/create` | `BedController@create` | `checkPermission:ward_add` | Redirect (/beds) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/beds` | `BedController@store` | `checkPermission:ward_add` | Redirect (/beds) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | AdmissionTest.php (DELETE)<br>AdmissionTest.php (POST) |
| **GET** | `/beds/categories` | `BedController@categories` | `checkPermission:ward_view` | Redirect (/beds/categories) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/beds/categories` | `BedController@storeCategory` | `checkPermission:ward_add` | Redirect (/beds/categories) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **DELETE** | `/beds/categories/{id}` | `BedController@destroyCategory` | `checkPermission:ward_delete` | Redirect (/beds/categories) | `category: 'required|integer|exists:bed_category`<br>`number: 'required|string|max:100'` | *None direct* |
| **GET** | `/beds/{id}/edit` | `BedController@edit` | `checkPermission:ward_update` | Redirect (/beds) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **PUT** | `/beds/{id}` | `BedController@update` | `checkPermission:ward_update` | Redirect (/beds) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **DELETE** | `/beds/{id}` | `BedController@destroy` | `checkPermission:ward_delete` | Redirect (/beds) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **GET** | `/admissions` | `AdmissionController@index` | `checkPermission:admission_view` | View (`app.admissions.index`) | `patient: 'required|integer|exists:patient`<br>`bed_id: 'required|integer|exists:bed` | AdmissionTest.php (POST)<br>DashboardTest.php (POST) |
| **GET** | `/admissions/create` | `AdmissionController@create` | `checkPermission:admission_add` | Redirect (/admissions) | `patient: 'required|integer|exists:patient`<br>`bed_id: 'required|integer|exists:bed` | *None direct* |
| **POST** | `/admissions` | `AdmissionController@store` | `checkPermission:admission_add` | Redirect (/admissions) | `patient: 'required|integer|exists:patient`<br>`bed_id: 'required|integer|exists:bed` | AdmissionTest.php (POST)<br>DashboardTest.php (POST) |
| **GET** | `/admissions/{id}` | `AdmissionController@show` | `checkPermission:admission_view` | Redirect (/admissions/) | `d_time: 'nullable|date'` | *None direct* |
| **POST** | `/admissions/{id}/discharge` | `AdmissionController@discharge` | `checkPermission:admission_discharge` | Redirect (/admissions/) | `d_time: 'nullable|date'` | *None direct* |

## Clinical Consultations & OPD (23 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/opd/queue` | `OpdController@queue` | `checkPermission:appointment_view` | View (`app.opd.queue`) | Form validation | *None direct* |
| **POST** | `/opd/walk-in` | `OpdController@walkIn` | `checkPermission:appointment_add` | Redirect (/opd/queue?date=) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | OpdQueueTest.php (POST) |
| **POST** | `/opd/{id}/check-in` | `OpdController@checkIn` | `checkPermission:appointment_update` | Redirect (/opd/queue?date=) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **POST** | `/opd/{id}/call-in` | `OpdController@callIn` | `checkPermission:appointment_update` | Redirect (/opd/queue?date=) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **POST** | `/opd/{id}/done` | `OpdController@done` | `checkPermission:appointment_update` | Redirect (/opd/queue?date=) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **POST** | `/opd/{id}/bill` | `OpdController@billVisit` | `checkPermission:payment_add` | View (`app.opd.token`) | None | *None direct* |
| **GET** | `/opd/{id}/token` | `OpdController@token` | `checkPermission:appointment_view` | View (`app.opd.token`) | None | *None direct* |
| **GET** | `/opd/history` | `OpdController@history` | `checkPermission:appointment_view` | View (`app.opd.history`) | None | *None direct* |
| **GET** | `/opd/visit-fees` | `OpdController@fees` | `checkPermission:service_view` | Redirect (/opd/visit-fees) | `doctor_id: 'nullable|integer|exists:doctor`<br>`visit_type: 'required|in:' . implode('` | OpdQueueTest.php (GET) |
| **POST** | `/opd/visit-fees` | `OpdController@storeFee` | `checkPermission:service_update` | Redirect (/opd/visit-fees) | `doctor_id: 'nullable|integer|exists:doctor`<br>`visit_type: 'required|in:' . implode('` | OpdQueueTest.php (GET) |
| **DELETE** | `/opd/visit-fees/{id}` | `OpdController@destroyFee` | `checkPermission:service_update` | Redirect (/opd/visit-fees) | `weekdays: 'required|array|min:1'`<br>`weekdays.*: 'integer|between:0` | *None direct* |
| **GET** | `/opd/free-slots` | `OpdController@freeSlots` | `checkPermission:appointment_add` | JSON | `doctor: 'required|integer'`<br>`date: 'required|date'` | *None direct* |
| **GET** | `/doctors/{id}/slots` | `OpdController@slots` | `checkPermission:doctor_schedule` | JSON | `weekdays: 'required|array|min:1'`<br>`weekdays.*: 'integer|between:0` | *None direct* |
| **POST** | `/doctors/{id}/slots` | `OpdController@storeSlot` | `checkPermission:doctor_schedule` | JSON | `weekdays: 'required|array|min:1'`<br>`weekdays.*: 'integer|between:0` | *None direct* |
| **POST** | `/doctors/{id}/blocks` | `OpdController@storeBlock` | `checkPermission:doctor_schedule` | JSON | `date: 'required|date|after_or_equal:today'`<br>`start_time: 'nullable|date_format:H:i'` | *None direct* |
| **POST** | `/slots/{id}/toggle` | `OpdController@toggleSlot` | `checkPermission:doctor_schedule` | JSON | `date: 'required|date|after_or_equal:today'`<br>`start_time: 'nullable|date_format:H:i'` | *None direct* |
| **DELETE** | `/slots/{id}` | `OpdController@destroySlot` | `checkPermission:doctor_schedule` | JSON | `date: 'required|date|after_or_equal:today'`<br>`start_time: 'nullable|date_format:H:i'` | *None direct* |
| **DELETE** | `/blocks/{id}` | `OpdController@destroyBlock` | `checkPermission:doctor_schedule` | JSON | `doctor: 'required|integer'`<br>`date: 'required|date'` | *None direct* |
| **GET** | `/consultations` | `ConsultationController@index` | `checkPermission:consultation_view` | View (`app.consultations.index`) | Form validation | ConsultationTest.php (GET) |
| **GET** | `/consultations/visit/{id}` | `ConsultationController@visit` | `checkPermission:consultation_add` | View (`app.consultations.form`) | Form validation | *None direct* |
| **POST** | `/consultations/visit/{id}` | `ConsultationController@save` | `checkPermission:consultation_add` | HTML View | `presenting_complaint: 'nullable|string|max:5000'`<br>`history: 'nullable|string|max:10000'` | *None direct* |
| **GET** | `/consultations/{id}/print` | `ConsultationController@printout` | `checkPermission:consultation_view` | View (`app.consultations.print`) | None | *None direct* |
| **DELETE** | `/consultations/templates/{id}` | `ConsultationController@destroyTemplate` | `checkPermission:consultation_add` | HTML View | None | *None direct* |

## Prescriptions & Medicines (16 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/medicines` | `MedicineController@index` | `checkPermission:medicine_view` | Redirect (/medicines) | Form validation | PrescriptionTest.php (DELETE)<br>PrescriptionTest.php (POST) |
| **GET** | `/medicines/create` | `MedicineController@create` | `checkPermission:medicine_add` | Redirect (/medicines) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/medicines` | `MedicineController@store` | `checkPermission:medicine_add` | Redirect (/medicines) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | PrescriptionTest.php (DELETE)<br>PrescriptionTest.php (POST) |
| **GET** | `/medicines/categories` | `MedicineController@categories` | `checkPermission:medicine_view` | Redirect (/medicines/categories) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | PrescriptionTest.php (DELETE) |
| **POST** | `/medicines/categories` | `MedicineController@storeCategory` | `checkPermission:medicine_add` | Redirect (/medicines/categories) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | PrescriptionTest.php (DELETE) |
| **DELETE** | `/medicines/categories/{id}` | `MedicineController@destroyCategory` | `checkPermission:medicine_delete` | Redirect (/medicines/categories) | `name: 'required|string|max:100'`<br>`category: 'nullable|integer|exists:medicine_category` | *None direct* |
| **GET** | `/medicines/{id}/edit` | `MedicineController@edit` | `checkPermission:medicine_update` | Redirect (/medicines) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **PUT** | `/medicines/{id}` | `MedicineController@update` | `checkPermission:medicine_update` | Redirect (/medicines) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | PrescriptionTest.php (DELETE) |
| **DELETE** | `/medicines/{id}` | `MedicineController@destroy` | `checkPermission:medicine_delete` | Redirect (/medicines) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | PrescriptionTest.php (DELETE) |
| **GET** | `/prescriptions` | `PrescriptionController@index` | `checkPermission:prescription_view` | Redirect (/prescriptions/) | Form validation | PrescriptionTest.php (POST)<br>PrescriptionTest.php (PUT) |
| **GET** | `/prescriptions/create` | `PrescriptionController@create` | `checkPermission:prescription_add` | Redirect (/prescriptions/) | Form validation | *None direct* |
| **POST** | `/prescriptions` | `PrescriptionController@store` | `checkPermission:prescription_add` | Redirect (/prescriptions/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | PrescriptionTest.php (POST)<br>PrescriptionTest.php (PUT) |
| **GET** | `/prescriptions/{id}` | `PrescriptionController@show` | `checkPermission:prescription_view` | Redirect (/prescriptions/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **GET** | `/prescriptions/{id}/edit` | `PrescriptionController@edit` | `checkPermission:prescription_update` | Redirect (/prescriptions/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **PUT** | `/prescriptions/{id}` | `PrescriptionController@update` | `checkPermission:prescription_update` | Redirect (/prescriptions/) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |
| **DELETE** | `/prescriptions/{id}` | `PrescriptionController@destroy` | `checkPermission:prescription_delete` | Redirect (/prescriptions) | `patient: 'required|integer|exists:patient`<br>`doctor: 'required|integer|exists:doctor` | *None direct* |

## Laboratory & Diagnostics (10 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/lab` | `LabController@index` | `checkPermission:lab_test_view` | Redirect (/lab/) | `results: 'array'`<br>`results.*: 'nullable|string|max:1000'` | LabRequestTest.php (POST) |
| **GET** | `/lab/create` | `LabController@create` | `checkPermission:lab_test_add` | Redirect (/lab/) | `results: 'array'`<br>`results.*: 'nullable|string|max:1000'` | *None direct* |
| **POST** | `/lab` | `LabController@store` | `checkPermission:lab_test_add` | Redirect (/lab/) | `results: 'array'`<br>`results.*: 'nullable|string|max:1000'` | LabRequestTest.php (POST) |
| **GET** | `/lab/catalogue` | `LabCategoryController@index` | `checkPermission:lab_test_view` | Redirect (/lab/catalogue) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | LabRequestTest.php (DELETE)<br>LabRequestTest.php (POST) |
| **POST** | `/lab/catalogue` | `LabCategoryController@store` | `checkPermission:lab_test_add` | Redirect (/lab/catalogue) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | LabRequestTest.php (DELETE)<br>LabRequestTest.php (POST) |
| **PUT** | `/lab/catalogue/{id}` | `LabCategoryController@update` | `checkPermission:lab_test_update` | Redirect (/lab/catalogue) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **DELETE** | `/lab/catalogue/{id}` | `LabCategoryController@destroy` | `checkPermission:lab_test_delete` | Redirect (/lab/catalogue) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **GET** | `/lab/{id}` | `LabController@show` | `checkPermission:lab_test_view` | Redirect (/lab/) | `results: 'array'`<br>`results.*: 'nullable|string|max:1000'` | LabRequestTest.php (DELETE)<br>LabRequestTest.php (POST) |
| **POST** | `/lab/{id}/results` | `LabController@saveResults` | `checkPermission:lab_test_update` | Redirect (/lab/) | `results: 'array'`<br>`results.*: 'nullable|string|max:1000'` | *None direct* |
| **DELETE** | `/lab/{id}` | `LabController@destroy` | `checkPermission:lab_test_delete` | Redirect (/lab) | `patient: 'required|integer|exists:patient`<br>`doctor: 'nullable|integer|exists:doctor` | LabRequestTest.php (DELETE)<br>LabRequestTest.php (POST) |

## Radiology (10 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/radiology` | `RadiologyController@index` | `checkPermission:diagnostic_report_view` | Redirect (/radiology) | `patient: 'required|integer|exists:patient`<br>`doctor: 'nullable|integer|exists:doctor` | RadiologyTest.php (POST)<br>RadiologyTest.php (PUT) |
| **GET** | `/radiology/create` | `RadiologyController@create` | `checkPermission:diagnostic_report_add` | Redirect (/radiology) | `patient: 'required|integer|exists:patient`<br>`doctor: 'nullable|integer|exists:doctor` | RadiologyTest.php (GET) |
| **POST** | `/radiology` | `RadiologyController@store` | `checkPermission:diagnostic_report_add` | Redirect (/radiology) | `patient: 'required|integer|exists:patient`<br>`doctor: 'nullable|integer|exists:doctor` | RadiologyTest.php (POST)<br>RadiologyTest.php (PUT) |
| **GET** | `/radiology/catalogue` | `RadiologyController@catalogue` | `checkPermission:diagnostic_report_view` | Redirect (/radiology/catalogue) | `name: 'required|string|max:120'`<br>`modality: 'required|in:' . implode('` | RadiologyTest.php (GET) |
| **POST** | `/radiology/catalogue` | `RadiologyController@storeExam` | `checkPermission:diagnostic_report_add` | Redirect (/radiology/catalogue) | `name: 'required|string|max:120'`<br>`modality: 'required|in:' . implode('` | RadiologyTest.php (GET) |
| **PUT** | `/radiology/catalogue/{id}` | `RadiologyController@updateExam` | `checkPermission:diagnostic_report_add` | Redirect (/radiology/catalogue) | `name: 'required|string|max:120'`<br>`modality: 'required|in:' . implode('` | *None direct* |
| **GET** | `/radiology/{id}` | `RadiologyController@show` | `checkPermission:diagnostic_report_view` | Redirect (/radiology/) | `action: 'required|in:schedule`<br>`scheduled_at: 'nullable|date'` | RadiologyTest.php (GET) |
| **PUT** | `/radiology/{id}` | `RadiologyController@update` | `checkPermission:diagnostic_report_add` | Redirect (/radiology/) | `action: 'required|in:schedule`<br>`scheduled_at: 'nullable|date'` | RadiologyTest.php (GET) |
| **POST** | `/radiology/{id}/bill` | `RadiologyController@bill` | `checkPermission:payment_add` | Redirect (/radiology/catalogue) | Form validation | *None direct* |
| **GET** | `/radiology/{id}/print` | `RadiologyController@printout` | `checkPermission:diagnostic_report_view` | Redirect (/radiology/catalogue) | `name: 'required|string|max:120'`<br>`modality: 'required|in:' . implode('` | *None direct* |

## Pharmacy & Dispensing (5 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/pharmacy` | `PharmacyController@index` | `checkPermission:pharmacy_stock_view` | Redirect (/pharmacy/) | Form validation | ConcurrentWriteTest.php (POST)<br>PharmacyTest.php (POST) |
| **GET** | `/pharmacy/create` | `PharmacyController@create` | `checkPermission:pharmacy_sale` | Redirect (/pharmacy/) | Form validation | *None direct* |
| **POST** | `/pharmacy` | `PharmacyController@store` | `checkPermission:pharmacy_sale` | Redirect (/pharmacy/) | `patient: 'nullable|integer|exists:patient`<br>`date: 'required|date'` | ConcurrentWriteTest.php (POST)<br>PharmacyTest.php (POST) |
| **GET** | `/pharmacy/{id}` | `PharmacyController@show` | `checkPermission:pharmacy_stock_view` | Redirect (/pharmacy) | `patient: 'nullable|integer|exists:patient`<br>`date: 'required|date'` | *None direct* |
| **DELETE** | `/pharmacy/{id}` | `PharmacyController@destroy` | `checkPermission:pharmacy_sale` | Redirect (/pharmacy) | `patient: 'nullable|integer|exists:patient`<br>`date: 'required|date'` | *None direct* |

## Billing, Pricing & Cashier (42 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/invoices` | `InvoiceController@index` | `checkPermission:invoice_view` | Redirect (/invoices/) | Form validation | BranchPackageVideoTest.php (POST)<br>BranchPackageVideoTest.php (GET) |
| **GET** | `/invoices/create` | `InvoiceController@create` | `checkPermission:payment_add` | Redirect (/invoices/) | Form validation | PricingTest.php (GET) |
| **POST** | `/invoices` | `InvoiceController@store` | `checkPermission:payment_add` | Redirect (/invoices/) | `amount: 'required|numeric|min:0.01'`<br>`method: 'nullable|string|max:60'` | BranchPackageVideoTest.php (POST)<br>BranchPackageVideoTest.php (GET) |
| **GET** | `/invoices/{id}` | `InvoiceController@show` | `checkPermission:invoice_view` | Redirect (/invoices/) | `amount: 'required|numeric|min:0.01'`<br>`method: 'nullable|string|max:60'` | PricingTest.php (GET) |
| **POST** | `/invoices/{id}/pay` | `InvoiceController@pay` | `checkPermission:payment_add` | Redirect (/invoices/) | `amount: 'required|numeric|min:0.01'`<br>`method: 'nullable|string|max:60'` | *None direct* |
| **DELETE** | `/invoices/{id}` | `InvoiceController@destroy` | `checkPermission:payment_delete` | Redirect (/invoices/) | `amount: 'required|numeric|min:0.01'`<br>`method: 'nullable|string|max:60'` | PricingTest.php (GET) |
| **GET** | `/services` | `PaymentCategoryController@index` | `checkPermission:service_view` | Redirect (/services) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | BranchPackageVideoTest.php (POST)<br>BranchPackageVideoTest.php (PUT) |
| **POST** | `/services` | `PaymentCategoryController@store` | `checkPermission:service_add` | Redirect (/services) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | BranchPackageVideoTest.php (POST)<br>BranchPackageVideoTest.php (PUT) |
| **PUT** | `/services/{id}` | `PaymentCategoryController@update` | `checkPermission:service_update` | Redirect (/services) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **DELETE** | `/services/{id}` | `PaymentCategoryController@destroy` | `checkPermission:service_delete` | Redirect (/services) | `category: 'required|string|max:100'`<br>`description: 'nullable|string|max:100'` | *None direct* |
| **GET** | `/gateways` | `PaymentGatewayController@index` | `public` | Redirect (/gateways) | `name: 'required|string|max:100'`<br>`merchant_key: 'nullable|string|max:100'` | MedicalHistoryTest.php (POST)<br>MedicalHistoryTest.php (GET) |
| **POST** | `/gateways` | `PaymentGatewayController@store` | `public` | Redirect (/gateways) | `name: 'required|string|max:100'`<br>`merchant_key: 'nullable|string|max:100'` | MedicalHistoryTest.php (POST)<br>MedicalHistoryTest.php (GET) |
| **PUT** | `/gateways/{id}` | `PaymentGatewayController@update` | `public` | Redirect (/gateways) | `name: 'required|string|max:100'`<br>`merchant_key: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/gateways/{id}/enable` | `PaymentGatewayController@enable` | `public` | Redirect (/gateways) | `name: 'required|string|max:100'`<br>`merchant_key: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/gateways/{id}/disable` | `PaymentGatewayController@disable` | `public` | Redirect (/gateways) | `name: 'required|string|max:100'`<br>`merchant_key: 'nullable|string|max:100'` | *None direct* |
| **DELETE** | `/gateways/{id}` | `PaymentGatewayController@destroy` | `public` | Redirect (/gateways) | `name: 'required|string|max:100'`<br>`merchant_key: 'nullable|string|max:100'` | *None direct* |
| **GET** | `/patient-types` | `PricingController@types` | `checkPermission:service_view` | Redirect (/patient-types) | `name: ['required'`<br>`kind: 'required|in:' . implode('` | PricingTest.php (DELETE)<br>PricingTest.php (GET) |
| **POST** | `/patient-types` | `PricingController@storeType` | `checkPermission:service_update` | Redirect (/patient-types) | `name: ['required'`<br>`kind: 'required|in:' . implode('` | PricingTest.php (DELETE)<br>PricingTest.php (GET) |
| **PUT** | `/patient-types/{id}` | `PricingController@updateType` | `checkPermission:service_update` | Redirect (/patient-types) | `name: ['required'`<br>`kind: 'required|in:' . implode('` | *None direct* |
| **DELETE** | `/patient-types/{id}` | `PricingController@destroyType` | `checkPermission:service_delete` | Redirect (/patient-types) | `name: ['required'`<br>`kind: 'required|in:' . implode('` | *None direct* |
| **GET** | `/pricing` | `PricingController@index` | `checkPermission:service_view` | Redirect (/pricing?type=) | `type: 'required|integer|exists:patient_type`<br>`opd: 'array'` | PricingTest.php (POST) |
| **POST** | `/pricing` | `PricingController@save` | `checkPermission:service_update` | Redirect (/pricing?type=) | `type: 'required|integer|exists:patient_type`<br>`opd: 'array'` | PricingTest.php (POST) |
| **POST** | `/pricing/copy` | `PricingController@copy` | `checkPermission:service_update` | Redirect (/pricing?type=) | `from: 'required|integer|exists:patient_type`<br>`to: 'required|integer|different:from|exists:patient_type` | PricingTest.php (POST) |
| **POST** | `/pricing/adjust` | `PricingController@adjust` | `checkPermission:service_update` | Redirect (/pricing?type=) | `type: 'required|integer|exists:patient_type`<br>`percent: 'required|numeric|min:-90|max:500'` | PricingTest.php (POST) |
| **GET** | `/pricing/export` | `PricingController@export` | `checkPermission:service_view` | HTML View | None | *None direct* |
| **GET** | `/doctor-share` | `DoctorShareController@report` | `checkPermission:doctor_share_view` | View (`app.doctor-share.report`) | None | DoctorShareTest.php (GET) |
| **POST** | `/doctor-share/approve` | `DoctorShareController@approve` | `checkPermission:doctor_share_approve` | HTML View | `ids: 'required|array'`<br>`ids.*: 'integer'` | DoctorShareTest.php (POST) |
| **POST** | `/doctor-share/pay` | `DoctorShareController@pay` | `checkPermission:doctor_share_approve` | HTML View | `ids: 'required|array'`<br>`ids.*: 'integer'` | DoctorShareTest.php (POST) |
| **GET** | `/doctor-share/policies` | `DoctorShareController@policies` | `checkPermission:doctor_share_view` | Redirect (/doctor-share/policies#policy-) | `name: 'required|string|max:100|unique:share_policy`<br>`notes: 'nullable|string|max:255'` | DoctorShareTest.php (GET)<br>DoctorShareTest.php (POST) |
| **POST** | `/doctor-share/policies` | `DoctorShareController@storePolicy` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies#policy-) | `name: 'required|string|max:100|unique:share_policy`<br>`notes: 'nullable|string|max:255'` | DoctorShareTest.php (GET)<br>DoctorShareTest.php (POST) |
| **PUT** | `/doctor-share/policies/{id}` | `DoctorShareController@updatePolicy` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies#policy-) | `name: ['required'`<br>`notes: 'nullable|string|max:255'` | *None direct* |
| **DELETE** | `/doctor-share/policies/{id}` | `DoctorShareController@destroyPolicy` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies) | `payment_category_id: 'nullable|integer|exists:payment_category`<br>`department: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/doctor-share/policies/{id}/rules` | `DoctorShareController@storeRule` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies#policy-) | `payment_category_id: 'nullable|integer|exists:payment_category`<br>`department: 'nullable|string|max:100'` | *None direct* |
| **POST** | `/doctor-share/policies/{id}/assign` | `DoctorShareController@assign` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies#policy-) | `payment_category_id: 'nullable|integer|exists:payment_category`<br>`department: 'nullable|string|max:100'` | *None direct* |
| **PUT** | `/doctor-share/rules/{id}` | `DoctorShareController@updateRule` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies#policy-) | `payment_category_id: 'nullable|integer|exists:payment_category`<br>`department: 'nullable|string|max:100'` | *None direct* |
| **DELETE** | `/doctor-share/rules/{id}` | `DoctorShareController@destroyRule` | `checkPermission:doctor_share_approve` | Redirect (/doctor-share/policies#policy-) | `payment_category_id: 'nullable|integer|exists:payment_category`<br>`department: 'nullable|string|max:100'` | *None direct* |
| **GET** | `/cash-close` | `CashController@cashClose` | `checkPermission:cash_close` | Redirect (/cash-close/) | `user_id: 'nullable|integer'`<br>`counted_cash: 'nullable|numeric|min:0'` | CashTest.php (POST)<br>CashTest.php (GET) |
| **POST** | `/cash-close` | `CashController@storeClose` | `checkPermission:cash_close` | Redirect (/cash-close/) | `user_id: 'nullable|integer'`<br>`counted_cash: 'nullable|numeric|min:0'` | CashTest.php (POST)<br>CashTest.php (GET) |
| **GET** | `/cash-close/{id}` | `CashController@showClose` | `checkPermission:cash_close` | View (`app.cash.slip`) | None | *None direct* |
| **GET** | `/day-book` | `CashController@dayBook` | `checkPermission:view_payment_reports` | HTML View | None | BranchPackageVideoTest.php (GET)<br>CashTest.php (GET) |
| **GET** | `/settlement` | `CashController@settlement` | `checkPermission:payment_add` | View (`app.cash.settlement`) | `amount: 'nullable|numeric|min:0'`<br>`method: 'required|in:' . implode('` | CashTest.php (POST) |
| **POST** | `/settlement/{patient}` | `CashController@settle` | `checkPermission:payment_add` | Redirect (/settlement?patient=) | `amount: 'nullable|numeric|min:0'`<br>`method: 'required|in:' . implode('` | *None direct* |

## Accounting & Reporting (31 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/accounting` | `AccountingController@index` | `checkPermission:accounting` | Redirect (/accounting) | Form validation | *None direct* |
| **POST** | `/accounting` | `AccountingController@store` | `checkPermission:accounting` | Redirect (/accounting) | Form validation | *None direct* |
| **GET** | `/accounting/sectors` | `AccountingController@sectors` | `checkPermission:accounting` | Redirect (/accounting/sectors) | Form validation | *None direct* |
| **POST** | `/accounting/sectorcreate` | `AccountingController@sectorCreate` | `checkPermission:accounting` | Redirect (/accounting/sectors) | Form validation | *None direct* |
| **GET** | `/accounting/sectorlist` | `AccountingController@sectors` | `checkPermission:accounting` | Redirect (/accounting/sectors) | Form validation | *None direct* |
| **GET** | `/accounting/sectoredit/{id}` | `AccountingController@sectorEdit` | `checkPermission:accounting` | Redirect (/accounting/sectoredit/) | Form validation | *None direct* |
| **POST** | `/accounting/sectorupdate` | `AccountingController@sectorUpdate` | `checkPermission:accounting` | Redirect (/accounting/sectoredit/) | Form validation | *None direct* |
| **GET** | `/accounting/sectordelete/{id}` | `AccountingController@sectorDelete` | `checkPermission:accounting` | Redirect (/accounting/sectors) | Form validation | *None direct* |
| **GET** | `/accounting/income` | `AccountingController@income` | `checkPermission:accounting` | Redirect (/accounting/income) | Form validation | *None direct* |
| **POST** | `/accounting/incomecreate` | `AccountingController@incomeCreate` | `checkPermission:accounting` | Redirect (/accounting/income) | Form validation | *None direct* |
| **GET** | `/accounting/incomelist` | `AccountingController@incomeList` | `checkPermission:accounting` | Redirect (/accounting/incomeedit/) | Form validation | *None direct* |
| **POST** | `/accounting/incomelist` | `AccountingController@incomeListPost` | `checkPermission:accounting` | Redirect (/accounting/incomeedit/) | Form validation | *None direct* |
| **GET** | `/accounting/incomeedit/{id}` | `AccountingController@incomeEdit` | `checkPermission:accounting` | Redirect (/accounting/incomeedit/) | Form validation | *None direct* |
| **POST** | `/accounting/incomeupdate` | `AccountingController@incomeUpdate` | `checkPermission:accounting` | Redirect (/accounting/incomeedit/) | Form validation | *None direct* |
| **GET** | `/accounting/incomedelete/{id}` | `AccountingController@incomeDelete` | `checkPermission:accounting` | Redirect (/accounting/incomelist?year=) | Form validation | *None direct* |
| **GET** | `/accounting/expence` | `AccountingController@expence` | `checkPermission:accounting` | Redirect (/accounting/expence) | Form validation | *None direct* |
| **POST** | `/accounting/expencecreate` | `AccountingController@expenceCreate` | `checkPermission:accounting` | Redirect (/accounting/expence) | Form validation | *None direct* |
| **GET** | `/accounting/expencelist` | `AccountingController@expenceList` | `checkPermission:accounting` | Redirect (/accounting/expenceedit/) | Form validation | *None direct* |
| **POST** | `/accounting/expencelist` | `AccountingController@expenceListPost` | `checkPermission:accounting` | Redirect (/accounting/expenceedit/) | Form validation | *None direct* |
| **GET** | `/accounting/expenceedit/{id}` | `AccountingController@expenceEdit` | `checkPermission:accounting` | Redirect (/accounting/expenceedit/) | Form validation | *None direct* |
| **POST** | `/accounting/expenceupdate` | `AccountingController@expenceUpdate` | `checkPermission:accounting` | Redirect (/accounting/expenceedit/) | Form validation | *None direct* |
| **GET** | `/accounting/expencedelete/{id}` | `AccountingController@expenceDelete` | `checkPermission:accounting` | Redirect (/accounting/expencelist?year=) | None | *None direct* |
| **GET** | `/accounting/report` | `AccountingController@getReport` | `checkPermission:accounting` | Redirect (/accounting/report) | None | *None direct* |
| **GET** | `/accounting/reportsum` | `AccountingController@getReportsum` | `checkPermission:accounting` | Redirect (/accounting/reportsum) | None | *None direct* |
| **GET** | `/accounting/reportprint/{rtype}/{fdate}/{tdate}` | `AccountingController@printReport` | `checkPermission:accounting` | Redirect (/accounting/report) | None | *None direct* |
| **GET** | `/accounting/reportprintsum/{fdate}/{tdate}` | `AccountingController@printReportsum` | `checkPermission:accounting` | Redirect (/accounting/reportsum) | None | *None direct* |
| **GET** | `/reports` | `ReportController@index` | `public` | View (`app.reports.index`) | None | ReportTest.php (GET) |
| **GET** | `/reports/lab` | `ReportController@lab` | `public` | View (`app.reports.lab`) | None | ReportTest.php (GET) |
| **GET** | `/reports/drug-usage` | `ReportController@drugUsage` | `public` | View (`app.reports.drug-usage`) | None | ReportTest.php (GET) |
| **GET** | `/reports/debtors` | `ReportController@debtors` | `public` | View (`app.reports.debtors`) | None | ReportTest.php (GET) |
| **GET** | `/reports/occupancy` | `ReportController@occupancy` | `public` | View (`app.reports.occupancy`) | None | ReportTest.php (GET) |

## Doctors, Staff & Departments (18 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/doctors` | `DoctorController@index` | `checkPermission:doctor_view` | Redirect (/doctors/) | Form validation | DoctorTest.php (POST)<br>DoctorTest.php (PUT) |
| **GET** | `/doctors/create` | `DoctorController@create` | `checkPermission:doctor_add` | Redirect (/doctors/) | Form validation | StaffTest.php (GET) |
| **POST** | `/doctors` | `DoctorController@store` | `checkPermission:doctor_add` | Redirect (/doctors/) | Form validation | DoctorTest.php (POST)<br>DoctorTest.php (PUT) |
| **GET** | `/doctors/{id}` | `DoctorController@show` | `checkPermission:doctor_view` | Redirect (/doctors/) | Form validation | StaffTest.php (GET) |
| **GET** | `/doctors/{id}/edit` | `DoctorController@edit` | `checkPermission:doctor_update` | Redirect (/doctors/) | `name: 'required|string|max:100'`<br>`email: 'nullable|email|max:100'` | *None direct* |
| **PUT** | `/doctors/{id}` | `DoctorController@update` | `checkPermission:doctor_update` | Redirect (/doctors/) | `name: 'required|string|max:100'`<br>`email: 'nullable|email|max:100'` | StaffTest.php (GET) |
| **DELETE** | `/doctors/{id}` | `DoctorController@destroy` | `checkPermission:doctor_delete` | Redirect (/doctors) | `name: 'required|string|max:100'`<br>`email: 'nullable|email|max:100'` | StaffTest.php (GET) |
| **GET** | `/departments` | `DepartmentController@index` | `public` | Redirect (/departments) | Form validation | StaffTest.php (POST)<br>StaffTest.php (PUT) |
| **POST** | `/departments` | `DepartmentController@store` | `public` | Redirect (/departments) | Form validation | StaffTest.php (POST)<br>StaffTest.php (PUT) |
| **POST** | `/departments/adopt` | `DepartmentController@adopt` | `public` | Redirect (/departments) | `name: 'required|string|max:100'`<br>`description: 'nullable|string|max:1000'` | StaffTest.php (POST) |
| **PUT** | `/departments/{id}` | `DepartmentController@update` | `public` | Redirect (/departments) | `name: 'required|string|max:100'`<br>`description: 'nullable|string|max:1000'` | StaffTest.php (POST) |
| **DELETE** | `/departments/{id}` | `DepartmentController@destroy` | `public` | Redirect (/departments) | `name: 'required|string|max:100'`<br>`description: 'nullable|string|max:1000'` | StaffTest.php (POST) |
| **GET** | `/staff/{type}` | `StaffController@index` | `public` | Redirect (/staff/) | Form validation | QaFixesOct22Test.php (POST)<br>StaffTest.php (POST) |
| **GET** | `/staff/{type}/create` | `StaffController@create` | `public` | Redirect (/staff/) | Form validation | *None direct* |
| **POST** | `/staff/{type}` | `StaffController@store` | `public` | Redirect (/staff/) | Form validation | QaFixesOct22Test.php (POST)<br>StaffTest.php (POST) |
| **GET** | `/staff/{type}/{id}/edit` | `StaffController@edit` | `public` | Redirect (/staff/) | Form validation | *None direct* |
| **PUT** | `/staff/{type}/{id}` | `StaffController@update` | `public` | Redirect (/staff/) | `name: 'required|string|max:100'`<br>`email: 'nullable|email|max:100'` | *None direct* |
| **DELETE** | `/staff/{type}/{id}` | `StaffController@destroy` | `public` | Redirect (/staff/) | `name: 'required|string|max:100'`<br>`email: 'nullable|email|max:100'` | *None direct* |

## Communications (SMS, Voice, Templates) (19 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/smslog` | `SmsController@getsmsLog` | `auth, admin` | Redirect (/smslog) | Form validation | *None direct* |
| **POST** | `/smslog` | `SmsController@postsmsLog` | `auth, admin` | Redirect (/smslog) | Form validation | *None direct* |
| **GET** | `/smslog/delete/{id}` | `SmsController@deleteLog` | `auth, admin` | Redirect (/smslog) | None | *None direct* |
| **GET** | `/ictcore` | `ICTCoreController@index` | `auth, admin` | Redirect (ictcore?type=) | Form validation | *None direct* |
| **POST** | `/ictcore` | `ICTCoreController@create` | `auth, admin` | Redirect (ictcore?type=) | Form validation | *None direct* |
| **POST** | `/notification_type` | `ICTCoreController@noti_create` | `auth, admin` | Redirect (/notification_type) | Form validation | *None direct* |
| **GET** | `/notification_type` | `ICTCoreController@noti_index` | `auth, admin` | Redirect (/notification_type) | Form validation | *None direct* |
| **GET** | `/ictcore/attendance` | `ICTCoreController@attendance_index` | `auth, admin` | Redirect (/ictcore/attendance) | Form validation | *None direct* |
| **POST** | `/ictcore/attendance` | `ICTCoreController@post_attendance` | `auth, admin` | Redirect (/ictcore/attendance) | Form validation | *None direct* |
| **GET** | `/ictcore/fees` | `ICTCoreController@fee_message_index` | `auth, admin` | Redirect (/ictcore/fees) | Form validation | *None direct* |
| **POST** | `/ictcore/fees` | `ICTCoreController@post_fees` | `auth, admin` | Redirect (/ictcore/fees) | Form validation | *None direct* |
| **GET** | `/template/create` | `TemplateController@index` | `auth, admin` | Redirect (/message/edit/) | Form validation | *None direct* |
| **POST** | `/template/create` | `TemplateController@create` | `auth, admin` | Redirect (/template/creates) | Form validation | *None direct* |
| **GET** | `/template/list` | `TemplateController@show` | `auth, admin` | Redirect (/template/creates) | Form validation | *None direct* |
| **GET** | `/message/edit/{id}` | `TemplateController@edit` | `auth, admin` | Redirect (/template/creates) | Form validation | *None direct* |
| **POST** | `/message/update` | `TemplateController@update` | `auth, admin` | Redirect (/template/creates) | Form validation | *None direct* |
| **GET** | `/message/delete/{id}` | `TemplateController@delete` | `auth, admin` | Redirect (/template/list) | None | *None direct* |
| **GET** | `/message` | `MessageController@index` | `auth, admin` | Redirect (/message) | Form validation | *None direct* |
| **POST** | `/message` | `MessageController@create` | `auth, admin` | Redirect (/message) | Form validation | *None direct* |

## Utility & Legacy Settings (14 Endpoints)

| Method | URI | Controller Action | Middleware / Perm | Response Type | Validation / Behavior | Test References |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/dashboard/` | `DashboardController@index` | `public` | HTML View | None | BranchPackageVideoTest.php (GET)<br>DashboardTest.php (GET) |
| **GET** | `/search` | `SearchController@index` | `auth` | JSON | None | *None direct* |
| **POST** | `/search` | `SearchController@search` | `auth` | JSON | None | *None direct* |
| **GET** | `/settings` | `SettingsController@index` | `public` | Redirect (/settings) | Form validation | QaFixesOct22Test.php (GET) |
| **POST** | `/settings` | `SettingsController@save` | `public` | Redirect (/settings) | Form validation | QaFixesOct22Test.php (GET) |
| **GET** | `/schedule` | `SettingsController@get_schedule` | `auth, admin` | Redirect (/schedule) | Form validation | *None direct* |
| **POST** | `/schedule` | `SettingsController@post_schedule` | `auth, admin` | Redirect (/schedule) | Form validation | *None direct* |
| **GET** | `/barcode` | `BarcodeController@index` | `public` | Redirect (/barcode) | Form validation | *None direct* |
| **POST** | `/barcode` | `BarcodeController@generate` | `public` | Redirect (/barcode) | Form validation | *None direct* |
| **GET** | `/cronjob/payment-reminder` | `CronjobController@paymentReminder` | `public` | JSON | None | *None direct* |
| **GET** | `/services/{id}/package` | `PackageController@show` | `checkPermission:service_view` | Redirect (/services/) | `component_id: 'required|integer|exists:payment_category`<br>`quantity: 'nullable|integer|min:1|max:999'` | *None direct* |
| **POST** | `/services/{id}/package` | `PackageController@store` | `checkPermission:service_update` | Redirect (/services/) | `component_id: 'required|integer|exists:payment_category`<br>`quantity: 'nullable|integer|min:1|max:999'` | *None direct* |
| **DELETE** | `/package-items/{id}` | `PackageController@destroy` | `checkPermission:service_update` | Redirect (/services/) | None | *None direct* |
| **GET** | `api/user` | `Closure` | `public` | HTML View | None | *None direct* |
