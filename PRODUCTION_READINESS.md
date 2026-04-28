# Production Readiness Checklist

## Code Quality
- [ ] All 19+ unit tests passing (`npm test`)
- [ ] No circular dependencies detected
- [ ] No hardcoded API endpoints (all in `lib/clients/`)
- [ ] All error paths have Discord alerts
- [ ] Retry logic is centralized and testable (`lib/retry.js`)
- [ ] All files have documentation headers

## Operations
- [ ] Cron schedule has no conflicting jobs (max 2 concurrent)
- [ ] All `execSync` jobs converted to async (non-blocking)
- [ ] Message queue tested under failure conditions
- [ ] All credentials can be rotated without downtime
- [ ] Health check detects outages within 5 minutes
- [ ] Auto-repair has circuit breaker (no infinite loops)

## Reliability
- [ ] Conversation context survives container restart
- [ ] Message queue persists and retries on failure
- [ ] Config drift detected and alerted
- [ ] Capability status tracks degradation
- [ ] RSS growth acceptable (< 1.5 GB over 7 days)
- [ ] No orphaned child processes on restart

## Documentation
- [x] Runbook: Debug a failed cron job (`docs/debugging-cron-jobs.md`)
- [x] Runbook: Rotate credentials (`RUNBOOK_CREDENTIAL_ROTATION.md`)
- [x] Developer quickstart for adding jobs (`README.md`)
- [x] Architecture overview documented (`README.md`)
- [ ] All modules have clear ownership
- [ ] Archive manifest explains removed scripts

## Deployment
- [ ] Pre-deployment tests pass
- [ ] Rollback procedure documented
- [ ] Staging environment mirrors production
- [ ] Git history is clean (no secrets committed)
- [ ] Railway environment variables are secure
- [ ] Monitoring dashboard configured

## Sign-Off
- [ ] All phases 1-9 complete
- [ ] 24-hour stability run passed
- [ ] No regressions since last production release
- [ ] Team trained on runbooks
- [ ] On-call procedure documented

Date: ___________
Verified by: ___________
