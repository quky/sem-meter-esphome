# SEM Meter Development Notes

## Current branch

development

## Current objective

Make the skeleton SEM Meter custom component boot successfully with:

- Wi-Fi
- ESPHome API
- OTA
- web server

The parser and UART processing are intentionally disabled for this milestone.

## Known-good recovery firmware

The proven working YAML firmware is stored outside the Git repository at:

```text
C:\Users\Papi\ESPHome\sem-meter
```

Known-good factory image:

```text
C:\Users\Papi\ESPHome\sem-meter\.esphome\build\sem-meter\build\firmware.factory.bin
```

## Recovery procedure

1. Power off the board.
2. Connect IO0 to GND.
3. Power the board from the CH340 adapter at 3.3 V.
4. Flash using COM5 at 115200 baud:

   ```powershell
   python -m esptool --chip esp32s3 --port COM5 --baud 115200 --before no-reset write-flash 0x0 "C:\Users\Papi\ESPHome\sem-meter\.esphome\build\sem-meter\build\firmware.factory.bin"
   ```

5. Wait for:

   ```text
   Hash of data verified.
   ```

6. Power off.
7. Remove IO0 from GND.
8. Power on normally.
9. Verify with:

   ```powershell
   python -m esphome logs "C:\Users\Papi\ESPHome\sem-meter\sem-meter.yaml" --device 192.168.8.100
   ```

## Current status

- Working YAML UART parser confirmed.
- All 16 circuit entities confirmed.
- Phase A and Phase B confirmed.
- 447-byte frame confirmed.
- 150 + 150 + 147 transport chunks confirmed.
- Both 0xFF and 0x3B record markers confirmed.
- Host replay tests pass.
- Shared accumulator tests pass.
- AddressSanitizer tests pass.
- Full custom component build currently fails to boot.
- Skeleton component is the next boot test.
- Development changes are not committed yet.

## Development checklist

- [x] Back up original 16 MB firmware
- [x] Recover ESP32-S3 bootloader access
- [x] Decode UART protocol
- [x] Confirm 447-byte complete cycle
- [x] Confirm 0xFF and 0x3B markers
- [x] Decode all 16 circuits
- [x] Decode Phase A and Phase B
- [x] Create GitHub repository
- [x] Create development branch
- [x] Add parser replay tests
- [x] Add shared accumulator tests
- [x] Add AddressSanitizer test coverage
- [ ] Confirm skeleton component boots
- [ ] Restore component setup logging
- [ ] Restore fixed accumulator object
- [ ] Restore bounded UART reading
- [ ] Restore parser feed
- [ ] Verify sensor publishing
- [ ] Verify live UART readings in panel
- [ ] Commit development milestone
- [ ] Merge stable component to main
- [ ] Create first release tag

## Rules for future development

- Never experiment in `C:\Users\Papi\ESPHome\sem-meter`.
- Keep that folder as recovery firmware only.
- Do development only in `sem-meter-esphome` on the `development` branch.
- Do not commit a milestone until the firmware boots successfully.
- Keep `MAX_BYTES_PER_LOOP = 128`.
- Keep `MAX_FRAMES_PER_LOOP = 1`.
- Do not use unbounded UART loops.
- Do not restore delimiter `"\n"` or `bytes: 400`.
- Do not change entity names or IDs without a migration plan.
- Always run host tests, ESPHome config, and ESPHome compile before flashing.
- Keep the known-good factory image available before every experimental flash.

## Milestone log

| Date | Milestone | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-27 | Working YAML parser | Passed | All phases and 16 circuits decoded |
| 2026-07-27 | GitHub repository created | Passed | Initial working firmware published |
| 2026-07-27 | Host replay tests | Passed | 447-byte, chunked, byte-at-a-time, recovery and ASan tests |
| 2026-07-27 | First native component attempt | Failed | Device did not return to API |
| 2026-07-27 | Recovery firmware restored | Passed | Device booted and connected normally |
| 2026-07-27 | Skeleton component prepared | Pending | Next bench boot test |
