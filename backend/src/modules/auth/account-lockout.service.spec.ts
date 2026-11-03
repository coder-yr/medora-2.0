import { AccountLockoutService } from './account-lockout.service';

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;

  beforeEach(() => {
    service = new AccountLockoutService();
  });

  it('initially reports account as not locked', () => {
    const status = service.isLocked('admin@hospital.com');
    expect(status.locked).toBe(false);
    expect(status.remainingSeconds).toBe(0);
  });

  it('increments failed attempts without locking until threshold is reached', () => {
    const res1 = service.recordFailedAttempt('test@hospital.com');
    expect(res1.locked).toBe(false);
    expect(res1.remainingAttempts).toBe(4);

    const res2 = service.recordFailedAttempt('test@hospital.com');
    expect(res2.locked).toBe(false);
    expect(res2.remainingAttempts).toBe(3);
  });

  it('locks account when maximum threshold of 5 failures is reached', () => {
    for (let i = 1; i <= 4; i++) {
      service.recordFailedAttempt('victim@hospital.com');
    }
    const fifth = service.recordFailedAttempt('victim@hospital.com', '192.168.1.100');
    expect(fifth.locked).toBe(true);
    expect(fifth.remainingAttempts).toBe(0);
    expect(fifth.lockDurationSeconds).toBeGreaterThan(0);

    const status = service.isLocked('victim@hospital.com');
    expect(status.locked).toBe(true);
    expect(status.remainingSeconds).toBeGreaterThan(0);
  });

  it('resets counters upon successful login', () => {
    service.recordFailedAttempt('user@hospital.com');
    service.recordFailedAttempt('user@hospital.com');
    service.recordSuccessfulLogin('user@hospital.com');

    const next = service.recordFailedAttempt('user@hospital.com');
    expect(next.remainingAttempts).toBe(4);
  });

  it('supports manual unlocking', () => {
    for (let i = 1; i <= 5; i++) {
      service.recordFailedAttempt('locked@hospital.com');
    }
    expect(service.isLocked('locked@hospital.com').locked).toBe(true);

    service.unlock('locked@hospital.com');
    expect(service.isLocked('locked@hospital.com').locked).toBe(false);
  });
});
