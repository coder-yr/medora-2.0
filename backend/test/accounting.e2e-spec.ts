import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaService } from '../src/modules/prisma/prisma.service';

function getData(res: any) {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

function getError(res: any) {
  const err = res.body?.error?.message || res.body?.message;
  return Array.isArray(err) ? err.join('; ') : String(err || '');
}

describe('General Accounting, Chart of Accounts & Expense Ledger (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let accountantToken: string;
  let receptionistToken: string;

  let cashAccountId: number;
  let bankAccountId: number;
  let utilitiesExpenseAccountId: number;

  let createdAccountId: number;
  let createdPeriodId: number;
  let createdJournalId: number;
  let postedJournalId: number;
  let createdExpenseId: number;
  let utilitiesCategoryId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // 1. Authenticate Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    adminToken = getData(adminRes).accessToken;

    // 2. Authenticate Accountant
    const accRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'accountant.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    accountantToken = getData(accRes).accessToken;

    // 3. Authenticate Receptionist
    const recRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'receptionist.test@medora.hospital',
        password: 'ValidPassword123!',
      });
    receptionistToken = getData(recRes).accessToken;

    // Lookup Seeded Accounts
    const acc1010 = await prisma.account.findUnique({ where: { accountCode: '1010' } });
    const acc1020 = await prisma.account.findUnique({ where: { accountCode: '1020' } });
    const acc5200 = await prisma.account.findUnique({ where: { accountCode: '5200' } });

    cashAccountId = Number(acc1010!.id);
    bankAccountId = Number(acc1020!.id);
    utilitiesExpenseAccountId = Number(acc5200!.id);

    const utilCat = await prisma.expenseCategory.findUnique({ where: { code: 'UTIL' } });
    utilitiesCategoryId = Number(utilCat!.id);
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. CHART OF ACCOUNTS (COA)
  // ==========================================
  describe('1. Chart of Accounts (COA)', () => {
    it('GET /api/v1/accounting/accounts - should list standard accounts with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/accounts')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const data = getData(res);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(20);
      expect(data.items.some((a: any) => a.accountCode === '1010')).toBe(true);
    });

    it('GET /api/v1/accounting/accounts/tree - should return hierarchical account tree', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/accounts/tree')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const tree = getData(res);
      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);
    });

    it('POST /api/v1/accounting/accounts - should create a new account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/accounts')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountCode: '1019',
          accountName: 'ICU Petty Cash Box',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
          description: 'Emergency petty cash stored in ICU department',
          currency: 'PKR',
        })
        .expect(201);

      const created = getData(res);
      expect(created.accountCode).toBe('1019');
      createdAccountId = Number(created.id);
    });

    it('POST /api/v1/accounting/accounts - should throw 409 Conflict on duplicate code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/accounts')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountCode: '1019',
          accountName: 'Duplicate ICU Petty Cash',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
        })
        .expect(409);

      expect(getError(res)).toContain('already exists');
    });

    it('PUT /api/v1/accounting/accounts/:id - should update account details', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/accounting/accounts/${createdAccountId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountName: 'ICU Petty Cash Box (Updated)',
          description: 'Updated description for ICU box',
        })
        .expect(200);

      const updated = getData(res);
      expect(updated.accountName).toBe('ICU Petty Cash Box (Updated)');
    });

    it('DELETE /api/v1/accounting/accounts/:id - should prevent deleting system accounts', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounting/accounts/${cashAccountId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(400);

      expect(getError(res)).toContain('System account');
    });

    it('RBAC: non-financial user without permissions receives 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/accounting/accounts')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          accountCode: '9999',
          accountName: 'Unauthorized Account',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
        })
        .expect(403);
    });
  });

  // ==========================================
  // 2. ACCOUNTING PERIODS
  // ==========================================
  describe('2. Accounting Periods', () => {
    it('GET /api/v1/accounting/periods - should list periods', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/periods')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const data = getData(res);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/accounting/periods/current - should return current open period', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/periods/current')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const period = getData(res);
      expect(period).toBeDefined();
      expect(period.status).toBe('OPEN');
    });

    it('POST /api/v1/accounting/periods - should create future period', async () => {
      const uniqueCode = `FY2027-M01-${Date.now().toString().slice(-4)}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/periods')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          periodCode: uniqueCode,
          name: 'January 2027',
          startDate: '2027-01-01',
          endDate: '2027-01-31',
        })
        .expect(201);

      const period = getData(res);
      expect(period.periodCode).toBe(uniqueCode);
      expect(period.status).toBe('OPEN');
      createdPeriodId = Number(period.id);
    });

    it('POST /api/v1/accounting/periods/:id/close - should close period when clean', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/periods/${createdPeriodId}/close`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ closingNotes: 'Closed for testing' })
        .expect(200);

      const closed = getData(res);
      expect(closed.status).toBe('CLOSED');
      expect(closed.closedBy).toBeDefined();
    });

    it('POST /api/v1/accounting/periods/:id/reopen - should reopen closed period', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/periods/${createdPeriodId}/reopen`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ reason: 'Reopening to post adjustments' })
        .expect(200);

      const reopened = getData(res);
      expect(reopened.status).toBe('OPEN');
    });
  });

  // ==========================================
  // 3. DOUBLE-ENTRY JOURNAL ENTRIES
  // ==========================================
  describe('3. Double-Entry Journal Entries', () => {
    it('POST /api/v1/accounting/journals - should post balanced entry immediately', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountingDate: '2026-11-03',
          description: 'Cash deposit into operating bank account',
          postImmediately: true,
          lines: [
            { accountId: bankAccountId, debit: 25000, credit: 0, description: 'Bank deposit' },
            { accountId: cashAccountId, debit: 0, credit: 25000, description: 'Vault disbursement' },
          ],
        })
        .expect(201);

      const journal = getData(res);
      expect(journal.status).toBe('POSTED');
      expect(journal.journalNumber).toMatch(/^JRN-\d{6}-\d{4}$/);
      expect(Number(journal.totalDebit)).toBe(25000);
      expect(Number(journal.totalCredit)).toBe(25000);
      postedJournalId = Number(journal.id);
    });

    it('POST /api/v1/accounting/journals - should reject unbalanced journal (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountingDate: '2026-11-03',
          description: 'Unbalanced fraudulent entry attempt',
          postImmediately: true,
          lines: [
            { accountId: bankAccountId, debit: 25000, credit: 0 },
            { accountId: cashAccountId, debit: 0, credit: 20000 },
          ],
        })
        .expect(400);

      expect(getError(res)).toContain('Unbalanced Journal Entry');
    });

    it('POST /api/v1/accounting/journals - should enforce idempotency', async () => {
      const idempotencyKey = `IDEMP-TEST-${Date.now()}`;

      const res1 = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountingDate: '2026-11-03',
          description: 'Idempotent test entry',
          idempotencyKey,
          postImmediately: true,
          lines: [
            { accountId: bankAccountId, debit: 1000, credit: 0 },
            { accountId: cashAccountId, debit: 0, credit: 1000 },
          ],
        })
        .expect(201);

      const j1 = getData(res1);

      // Repeat identical request with same idempotencyKey
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountingDate: '2026-11-03',
          description: 'Duplicate attempt with same key',
          idempotencyKey,
          postImmediately: true,
          lines: [
            { accountId: bankAccountId, debit: 1000, credit: 0 },
            { accountId: cashAccountId, debit: 0, credit: 1000 },
          ],
        })
        .expect(201);

      const j2 = getData(res2);
      expect(j2.id).toBe(j1.id);
      expect(j2.journalNumber).toBe(j1.journalNumber);
    });

    it('POST /api/v1/accounting/journals - should create draft and post separately', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          accountingDate: '2026-11-03',
          description: 'Draft journal for monthly review',
          postImmediately: false,
          lines: [
            { accountId: utilitiesExpenseAccountId, debit: 8500, credit: 0 },
            { accountId: cashAccountId, debit: 0, credit: 8500 },
          ],
        })
        .expect(201);

      const draft = getData(res);
      expect(draft.status).toBe('DRAFT');
      createdJournalId = Number(draft.id);

      // Now post it
      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/accounting/journals/${createdJournalId}/post`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const posted = getData(postRes);
      expect(posted.status).toBe('POSTED');
    });

    it('DELETE /api/v1/accounting/journals/:id - should reject deleting a POSTED journal (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounting/journals/${postedJournalId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(403);

      expect(getError(res)).toContain('Immutable Ledger Invariant');
    });

    it('POST /api/v1/accounting/journals/:id/reverse - should create signed mirror-image reversal', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/journals/${postedJournalId}/reverse`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ reason: 'Reversing erroneous bank deposit' })
        .expect(200);

      const reversal = getData(res);
      expect(reversal.status).toBe('POSTED');
      expect(reversal.reversedEntryId).toBe(postedJournalId.toString());

      // Verify lines are swapped: bank should now be credit 25000, cash debit 25000
      const bankLine = reversal.lines.find((l: any) => Number(l.accountId) === bankAccountId);
      const cashLine = reversal.lines.find((l: any) => Number(l.accountId) === cashAccountId);

      expect(Number(bankLine.credit)).toBe(25000);
      expect(Number(cashLine.debit)).toBe(25000);

      // Verify original journal status is now REVERSED
      const originalRes = await request(app.getHttpServer())
        .get(`/api/v1/accounting/journals/${postedJournalId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const original = getData(originalRes);
      expect(original.status).toBe('REVERSED');
    });
  });

  // ==========================================
  // 4. EXPENSE WORKFLOW & SEPARATION OF DUTIES
  // ==========================================
  describe('4. Expense Workflow & Separation of Duties', () => {
    it('GET /api/v1/accounting/expense-categories - should list seeded categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/expense-categories')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const categories = getData(res);
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.some((c: any) => c.code === 'UTIL')).toBe(true);
    });

    it('POST /api/v1/accounting/expenses - should create expense in DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/expenses')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          categoryId: utilitiesCategoryId,
          description: 'Electricity bill for Main Ward',
          amount: 18500,
          expenseDate: '2026-11-03',
          vendorName: 'WAPDA / IESCO',
          invoiceNumber: 'INV-ELEC-202611',
          paymentMethod: 'CASH',
        })
        .expect(201);

      const expense = getData(res);
      expect(expense.status).toBe('DRAFT');
      expect(expense.expenseNumber).toMatch(/^EXP-\d{6}-\d{4}$/);
      createdExpenseId = Number(expense.id);
    });

    it('PUT /api/v1/accounting/expenses/:id - should update DRAFT expense', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/accounting/expenses/${createdExpenseId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: 19000,
          notes: 'Adjusted including late surcharge estimate',
        })
        .expect(200);

      const updated = getData(res);
      expect(Number(updated.amount)).toBe(19000);
    });

    it('POST /api/v1/accounting/expenses/:id/submit - should submit expense for approval', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/expenses/${createdExpenseId}/submit`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const submitted = getData(res);
      expect(submitted.status).toBe('SUBMITTED');
    });

    it('POST /api/v1/accounting/expenses/:id/approve - should enforce Separation of Duties (403 Forbidden)', async () => {
      // Submitter (Accountant) attempts to approve their own expense
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/expenses/${createdExpenseId}/approve`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ notes: 'Self approving' })
        .expect(403);

      expect(getError(res)).toContain('Separation of Duties Violation');
    });

    it('POST /api/v1/accounting/expenses/:id/approve - should allow Admin supervisor to approve', async () => {
      // Admin approves
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/expenses/${createdExpenseId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Verified utility bill and approved' })
        .expect(200);

      const approved = getData(res);
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedById).toBeDefined();
    });

    it('POST /api/v1/accounting/expenses/:id/pay - should disburse payment and post balanced journal', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting/expenses/${createdExpenseId}/pay`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          paymentMethod: 'CASH',
        })
        .expect(200);

      const paid = getData(res);
      expect(paid.status).toBe('PAID');
      expect(paid.postedJournalEntryId).toBeDefined();

      // Verify the generated journal entry is POSTED and balanced
      const journalRes = await request(app.getHttpServer())
        .get(`/api/v1/accounting/journals/${paid.postedJournalEntryId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const journal = getData(journalRes);
      expect(journal.status).toBe('POSTED');
      expect(Number(journal.totalDebit)).toBe(19000);
      expect(Number(journal.totalCredit)).toBe(19000);
    });

    it('POST /api/v1/accounting/expenses - rejection lifecycle test', async () => {
      // 1. Create another expense
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/accounting/expenses')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          categoryId: utilitiesCategoryId,
          description: 'Spurious expense to test rejection',
          amount: 5000,
          expenseDate: '2026-11-03',
        })
        .expect(201);

      const exp = getData(createRes);

      // 2. Submit
      await request(app.getHttpServer())
        .post(`/api/v1/accounting/expenses/${exp.id}/submit`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      // 3. Admin rejects
      const rejRes = await request(app.getHttpServer())
        .post(`/api/v1/accounting/expenses/${exp.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Original vendor receipt missing' })
        .expect(200);

      const rejected = getData(rejRes);
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Original vendor receipt missing');
    });
  });

  // ==========================================
  // 5. FINANCIAL REPORTS ENGINE
  // ==========================================
  describe('5. Financial Reports Engine', () => {
    it('GET /api/v1/accounting/reports/trial-balance - should return balanced Trial Balance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/trial-balance')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const tb = getData(res);
      expect(tb.isBalanced).toBe(true);
      expect(tb.totalDebitSum).toBe(tb.totalCreditSum);
      expect(Array.isArray(tb.accounts)).toBe(true);
    });

    it('GET /api/v1/accounting/reports/profit-loss - should return P&L statement', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/profit-loss')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const pl = getData(res);
      expect(pl.totalRevenue).toBeDefined();
      expect(pl.totalExpense).toBeDefined();
      expect(pl.netOperatingIncome).toBeDefined();
      expect(Array.isArray(pl.revenues)).toBe(true);
      expect(Array.isArray(pl.expenses)).toBe(true);
    });

    it('GET /api/v1/accounting/reports/balance-sheet - should return balanced Balance Sheet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/balance-sheet')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const bs = getData(res);
      expect(bs.isBalanced).toBe(true);
      expect(bs.totalAssets).toBe(bs.totalLiabilitiesAndEquity);
      expect(Array.isArray(bs.assets)).toBe(true);
      expect(Array.isArray(bs.liabilities)).toBe(true);
      expect(Array.isArray(bs.equity)).toBe(true);
    });

    it('GET /api/v1/accounting/reports/general-ledger/:accountId - should return account ledger audit trail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/accounting/reports/general-ledger/${cashAccountId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const gl = getData(res);
      expect(gl.account.code).toBe('1010');
      expect(Array.isArray(gl.entries)).toBe(true);
    });

    it('GET /api/v1/accounting/reports/expense-summary - should return category breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/expense-summary')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const summary = getData(res);
      expect(summary.totalExpense).toBeGreaterThanOrEqual(19000);
      expect(Array.isArray(summary.categories)).toBe(true);
    });

    it('GET /api/v1/accounting/reports/cash-bank-summary - should return liquidity summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/reports/cash-bank-summary')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const liquidity = getData(res);
      expect(liquidity.totalLiquidity).toBeDefined();
      expect(Array.isArray(liquidity.accounts)).toBe(true);
    });

    it('GET /api/v1/accounting/dashboard - should return dashboard metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/dashboard')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const metrics = getData(res);
      expect(metrics.totalRevenueMonth).toBeDefined();
      expect(metrics.totalExpenseMonth).toBeDefined();
      expect(metrics.totalLiquidity).toBeDefined();
      expect(metrics.totalReceivables).toBeDefined();
      expect(Array.isArray(metrics.recentJournals)).toBe(true);
    });
  });

  // ==========================================
  // 6. LEGACY SINGLE-ENTRY COMPATIBILITY
  // ==========================================
  describe('6. Legacy Single-Entry Compatibility', () => {
    it('POST /api/v1/accounting/legacy - should record legacy entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/legacy')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          name: 'Legacy Supplier Co',
          sector: 'Pathology Consumables',
          category: 'expense',
          amount: 3500,
          date: '03-11-2026',
          receiptNo: 'LEGACY-REC-001',
        })
        .expect(201);

      const legacy = getData(res);
      expect(legacy.name).toBe('Legacy Supplier Co');
      expect(Number(legacy.amount)).toBe(3500);
    });

    it('GET /api/v1/accounting/legacy - should return legacy records', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/legacy?category=expense')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const records = getData(res);
      expect(Array.isArray(records)).toBe(true);
      expect(records.some((r: any) => r.receiptNo === 'LEGACY-REC-001')).toBe(true);
    });

    it('POST /api/v1/accounting/legacy/sectors & GET - should create and list legacy sector', async () => {
      const uniqueSector = `Diagnostic Supplies ${Date.now().toString().slice(-4)}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting/legacy/sectors')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          name: uniqueSector,
          type: 'expense',
        })
        .expect(201);

      const sector = getData(res);
      expect(sector.name).toBe(uniqueSector);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/accounting/legacy/sectors')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      const sectors = getData(listRes);
      expect(sectors.some((s: any) => s.name === uniqueSector)).toBe(true);
    });
  });
});
