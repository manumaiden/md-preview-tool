# Case #70044 — Backup job fails nightly at 02:00

## Log excerpt
```bash
--------------------------------------------------------------------------------
Nov 18 02:00:11 backup01 rsync[2211]: ERROR: connection unexpectedly closed
Nov 18 02:00:11 backup01 rsync[2211]: rsync error: error in rsync protocol data stream (code 12)
Nov 18 02:00:12 backup01 systemd[1]: backup-nightly.service: Main process exited, code=exited, status=12
--------------------------------------------------------------------------------
```

## Next step
Check `backup01` disk space and the target NAS share permissions before the next run.
