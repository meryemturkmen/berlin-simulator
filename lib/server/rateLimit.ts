export interface RateLimits {
  perUserPerHour: number;
  globalPerDay: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Which limit stopped the request, if any. */
  scope: "user" | "global" | null;
  /** Messages the user has left in the current hour. */
  remaining: number;
}

export interface RateLimiter {
  /** Counts one chat message for the user if both limits allow it. */
  consume(userKey: string, now?: Date): Promise<RateLimitResult>;
}

/** Start of the fixed window (UTC hour or UTC day) that contains `now`. */
export function windowStart(now: Date, unit: "hour" | "day"): Date {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  if (unit === "day") start.setUTCHours(0);
  return start;
}

/**
 * Pure decision: given the current counts, may one more message through?
 * The global daily limit caps total API spend; the hourly limit is per user.
 */
export function decide(
  userCount: number,
  globalCount: number,
  limits: RateLimits,
): RateLimitResult {
  if (globalCount >= limits.globalPerDay) {
    return {
      allowed: false,
      scope: "global",
      remaining: Math.max(0, limits.perUserPerHour - userCount),
    };
  }
  if (userCount >= limits.perUserPerHour) return { allowed: false, scope: "user", remaining: 0 };
  return { allowed: true, scope: null, remaining: limits.perUserPerHour - userCount - 1 };
}

/**
 * In-memory limiter for mock mode and local development. On serverless
 * hosting every instance has its own memory, so production uses the
 * Supabase-backed limiter instead.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly users = new Map<string, { window: number; count: number }>();
  private global = { window: 0, count: 0 };

  constructor(private readonly limits: RateLimits) {}

  async consume(userKey: string, now = new Date()): Promise<RateLimitResult> {
    const hour = windowStart(now, "hour").getTime();
    const day = windowStart(now, "day").getTime();
    if (this.global.window !== day) this.global = { window: day, count: 0 };
    let user = this.users.get(userKey);
    if (!user || user.window !== hour) {
      user = { window: hour, count: 0 };
      this.users.set(userKey, user);
    }

    const result = decide(user.count, this.global.count, this.limits);
    if (result.allowed) {
      user.count++;
      this.global.count++;
    }
    // Forget users from past windows so the map cannot grow without bound.
    if (this.users.size > 5000) {
      for (const [key, entry] of this.users) if (entry.window !== hour) this.users.delete(key);
    }
    return result;
  }
}
