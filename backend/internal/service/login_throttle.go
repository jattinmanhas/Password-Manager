package service

import (
	"sync"
	"time"
)

// loginThrottle is a per-account, in-memory lockout for failed password
// attempts. It complements the per-IP rate limiter: the IP limiter caps
// request volume from one source, while this caps failed attempts against a
// single account regardless of source IP, mitigating distributed password
// guessing.
//
// State is in-memory and therefore per-process: it is not shared across
// multiple instances and resets on restart. That is acceptable for the
// self-hosted, single-instance deployment target; a durable (DB-backed)
// lockout would be needed for a multi-instance setup.
type loginThrottle struct {
	mu          sync.Mutex
	entries     map[string]*loginAttempt
	maxAttempts int
	window      time.Duration
	lockFor     time.Duration
	now         func() time.Time
}

type loginAttempt struct {
	failures    int
	windowStart time.Time
	lockedUntil time.Time
}

func newLoginThrottle(maxAttempts int, window, lockFor time.Duration, now func() time.Time) *loginThrottle {
	if now == nil {
		now = time.Now
	}
	t := &loginThrottle{
		entries:     make(map[string]*loginAttempt),
		maxAttempts: maxAttempts,
		window:      window,
		lockFor:     lockFor,
		now:         now,
	}
	return t
}

// locked reports whether the key is currently locked out.
func (t *loginThrottle) locked(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	entry := t.entries[key]
	if entry == nil {
		return false
	}
	return entry.lockedUntil.After(t.now())
}

// recordFailure registers a failed attempt for the key and returns true if the
// account is now locked.
func (t *loginThrottle) recordFailure(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := t.now()
	entry := t.entries[key]
	if entry == nil || now.Sub(entry.windowStart) > t.window {
		entry = &loginAttempt{windowStart: now}
		t.entries[key] = entry
	}

	entry.failures++
	if entry.failures >= t.maxAttempts {
		entry.lockedUntil = now.Add(t.lockFor)
		entry.failures = 0
		entry.windowStart = now
		return true
	}
	return false
}

// reset clears any failure state for the key after a successful login.
func (t *loginThrottle) reset(key string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.entries, key)
}
