# Case #70012 — Printer queue stuck after firmware update

## Summary
All print jobs sent to **HP-FLOOR3** stay queued and never complete since this morning's firmware push. Affects every user on that floor.

## Steps taken
1. Restarted the print spooler service
2. Rolled back the firmware to the previous version
3. Re-submitted a test print job

## Still open
- Confirm with the vendor whether the new firmware has a known regression
- Check if other printers on the same subnet are affected
