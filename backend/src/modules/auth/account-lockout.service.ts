import { Injectable, Logger } from '@nestjs/common';

interface LockoutState {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  // Default security policy: 5 consecutive failures = 15-minute temporary lockout
  readonly MAX_FAILED_ATTEMPTS = 5;
  readonly LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  readonly ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  private readonly stateMap = new Map<string, LockoutState>();

  private normalizeKey(identifier: string): string {
    return (identifier || '').trim().toLowerCase();
  }

  isLocked(identifier: string): { locked: boolean; remainingSeconds: number } {
    const key = this.normalizeKey(identifier);
    const state = this.stateMap.get(key);
    if (!state || !state.lockedUntil) {
      return { locked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (now >= state.lockedUntil) {
      // Lock expired, decay attempts
      this.stateMap.delete(key);
      this.logger.log(`Account lockout expired for user "${key}"`);
      return { locked: false, remainingSeconds: 0 };
    }

    const remainingSeconds = Math.ceil((state.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }

  recordFailedAttempt(
    identifier: string,
    ip?: string,
  ): { locked: boolean; remainingAttempts: number; lockDurationSeconds?: number } {
    const key = this.normalizeKey(identifier);
    const now = Date.now();
    const existing = this.stateMap.get(key);

    if (existing && existing.lockedUntil && now < existing.lockedUntil) {
      const remainingSeconds = Math.ceil((existing.lockedUntil - now) / 1000);
      return { locked: true, remainingAttempts: 0, lockDurationSeconds: remainingSeconds };
    }

    let state: LockoutState;
    if (!existing || now - existing.firstAttemptAt > this.ATTEMPT_WINDOW_MS) {
      state = {
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: null,
      };
    } else {
      state = {
        ...existing,
        attempts: existing.attempts + 1,
      };
    }

    if (state.attempts >= this.MAX_FAILED_ATTEMPTS) {
      state.lockedUntil = now + this.LOCK_DURATION_MS;
      this.stateMap.set(key, state);
      this.logger.warn(
        `[Security Alert] Account "${key}" temporarily locked for 15 minutes after ${state.attempts} failed login attempts (IP: ${ip || 'unknown'}).`,
      );
      return {
        locked: true,
        remainingAttempts: 0,
        lockDurationSeconds: Math.ceil(this.LOCK_DURATION_MS / 1000),
      };
    }

    this.stateMap.set(key, state);
    const remainingAttempts = Math.max(0, this.MAX_FAILED_ATTEMPTS - state.attempts);
    return { locked: false, remainingAttempts };
  }

  recordSuccessfulLogin(identifier: string): void {
    const key = this.normalizeKey(identifier);
    if (this.stateMap.has(key)) {
      this.stateMap.delete(key);
      this.logger.log(`Reset failed login counters for user "${key}" after successful login`);
    }
  }

  unlock(identifier: string): void {
    const key = this.normalizeKey(identifier);
    this.stateMap.delete(key);
    this.logger.log(`Manually unlocked user account "${key}"`);
  }
}
