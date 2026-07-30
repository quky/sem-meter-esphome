# SEM Meter Development Notes

## Current Stable Release

- Version: `4.0.0`
- Annotated tag: `v4.0.0`
- Release merge commit:
  `59033e999c6a9a96656c948a226b156f292351ba`
- Hardware OTA validation: completed
- GitHub synchronization: `main`, `development`, and `v4.0.0` match the
  verified local release refs

The stable firmware lives on `main`. Detailed installation, architecture, and
diagnostic behavior are documented in [README.md](README.md),
[docs/development.md](docs/development.md), and
[docs/diagnostics.md](docs/diagnostics.md).

## Current Development Cycle

New work happens on `development`; stable releases live on `main`.

The current `development` head is
`c2396148aed227970572cb658909f1220858797f`. The centralized component version
still reports `4.0.0`. The next required housekeeping task, after the next
milestone is defined, is to start `4.1.0-dev`.

## Current Architecture

- W338-compatible SEM meter using an ESP32-S3-WROOM-1U
- Meter UART RX on GPIO39 at 115200 baud, 8N1; no UART TX
- Confirmed onboard passive buzzer on GPIO41 using LEDC/PWM and RTTTL
- 447-byte measurement cycle transported as 150 + 150 + 147 byte chunks
- Supported record markers `0xFF`, captured-fixture `0x3B`, and live `0x3C`
- Sixteen branch-circuit entities plus Phase A and Phase B measurements
- Bounded UART reads, fixed-buffer accumulation, structural synchronization,
  transactional validation, last-good protection, and malformed-data recovery
- Parser watchdog and safe parser-timeout simulation
- Independent Wi-Fi watchdog and safe Wi-Fi-fault simulation
- Manual nonblocking self-test framework
- Runtime parser, Wi-Fi, and self-test counters
- Reset reason, component version, ESPHome version, hardware profile, and board
  identity
- Component-generated diagnostic report transported through three Home
  Assistant text sensors
- Each report part is limited to 220 characters and split only between complete
  label/value blocks
- Home Assistant concatenates the report parts and optionally handles Telegram;
  firmware never sends Telegram messages directly

## Diagnostics V4 Status

Release `v4.0.0` implements Report Format 1 with this stable field order:

1. Component Version
2. ESPHome Version
3. Hardware Profile
4. Board Variant
5. Reset Reason
6. Parser health
7. Wi-Fi health
8. Home Assistant status
9. Last Self-Test
10. Parser Faults
11. WiFi Faults
12. Self-Test Runs
13. Self-Test Failures
14. Last Parser Outage
15. Last WiFi Outage
16. Additional Diagnostics

Hardware validation passed for healthy reports, active parser faults and
recovery, active Wi-Fi faults and recovery, self-test PASS and FAIL results,
counter accuracy, three-part splitting, label/value integrity, and immutable
snapshot consistency.

## Validation Baseline

The `v4.0.0` release baseline is:

- MSVC C++17 `/W4`: 44 checkpoints passed
- AddressSanitizer: 44 checkpoints passed
- ESPHome configuration: valid
- Full ESP32-S3 compilation: passed
- Compiler and ESPHome warnings: none
- RAM: 113,075 / 341,760 bytes (33.1%)
- Flash: 870,979 / 8,126,464 bytes (10.7%)
- OTA image: 871,088 bytes
- Factory image: 936,624 bytes

Use this baseline for regression comparison. Host-test commands and coverage
are maintained in [tests/README.md](tests/README.md).

## Development Workflow

1. Work on `development`.
2. Review every change manually.
3. Run the native tests.
4. Run the AddressSanitizer suite.
5. Run ESPHome configuration validation.
6. Run a complete ESP32-S3 compile.
7. Flash manually over OTA.
8. Perform hardware validation.
9. Commit only after validation.
10. Merge `development` into `main` for releases.
11. Create an annotated release tag.
12. Push only after final approval.

Codex may edit, test, compile, commit, merge locally, and prepare tags only
when explicitly instructed. Codex must not push unless explicitly authorized,
must not flash hardware, must stop on merge conflicts, must not rewrite
history, and must not delete branches.

## Emergency Recovery

The known-good recovery firmware is deliberately stored outside the Git
repository:

```text
C:\Users\Papi\ESPHome\sem-meter
```

Known-good factory image:

```text
C:\Users\Papi\ESPHome\sem-meter\.esphome\build\sem-meter\build\firmware.factory.bin
```

Recovery procedure:

1. Power off the board.
2. Connect IO0 to GND.
3. Power the board from the CH340 adapter at 3.3 V.
4. Flash on COM5 at 115200 baud:

   ```powershell
   python -m esptool --chip esp32s3 --port COM5 --baud 115200 --before no-reset write-flash 0x0 "C:\Users\Papi\ESPHome\sem-meter\.esphome\build\sem-meter\build\firmware.factory.bin"
   ```

5. Wait for `Hash of data verified.`
6. Power off.
7. Remove IO0 from GND.
8. Power on normally.
9. Verify operation:

   ```powershell
   python -m esphome logs "C:\Users\Papi\ESPHome\sem-meter\sem-meter.yaml" --device 192.168.8.100
   ```

Keep this factory image available before every experimental flash. Never use
the recovery directory as a development workspace.

## Hardware Safety Rules

- Serial programming voltage is 3.3 V only.
- Keep the known-good recovery image and serial recovery access available.
- The ESP32-S3-WROOM-1U requires an external 2.4 GHz antenna.
- Do not probe or drive unverified GPIOs.
- GPIO39 is reserved for meter UART RX.
- GPIO41 is reserved for the confirmed passive buzzer.
- Do not add UART TX or transmit unknown commands without captured protocol and
  hardware evidence.

## Parser Safety Rules

- Keep `MAX_BYTES_PER_LOOP = 128`.
- Keep `MAX_FRAMES_PER_LOOP = 1`.
- Keep the fixed `MAX_BUFFER_SIZE = 894`.
- Never use an unbounded UART loop.
- Preserve partial UART input between loop calls.
- Do not parse the 150/150/147 transport chunks independently.
- Do not restore delimiter `"\n"` or `bytes: 400`.
- Preserve structural cycle synchronization, transactional validation,
  last-good state, and bounded recovery.
- Do not change protocol markers, IDs, statuses, offsets, divisors, or scheduler
  limits without captured-data evidence and regression tests.

## Development Rules

- Do not change entity names or IDs without a migration plan.
- Do not duplicate the centralized component version.
- Do not change Report Format 1 without an intentional compatibility review.
- Preserve the 220-character report-part limit.
- Split reports only on complete label/value block boundaries.
- Preserve immutable diagnostic snapshot behavior.
- Do not add persistence or flash writes without explicit design approval.
- Do not add automatic reboot behavior without explicit design approval.
- Do not couple firmware directly to Telegram.
- Update tests and documentation with every interface change.
- Run native tests, AddressSanitizer, ESPHome configuration validation, and a
  complete compile before flashing.

## Completed Milestones

- Decoded the UART protocol and confirmed the 447-byte cycle.
- Added native parser replay, corruption, recovery, and AddressSanitizer tests.
- Booted the reusable custom component successfully.
- Restored bounded UART accumulation, parsing, and live sensor publication.
- Confirmed GPIO41 passive-buzzer support.
- Added the parser watchdog and parser-timeout simulation.
- Added the independent Wi-Fi watchdog and Wi-Fi-fault simulation.
- Added the manual self-test framework.
- Added Diagnostics V3 identity, reset reason, and runtime counters.
- Added Diagnostics V4 Report Format 1 and bounded three-part transport.
- Released and hardware-validated `v4.0.0` over OTA.
- Published synchronized GitHub `main`, `development`, and annotated `v4.0.0`
  refs.

## Next Planned Work

- Define the next milestone before implementation.
- Start the next development version as `4.1.0-dev` when that cycle begins.
- Preserve the `v4.0.0` validation baseline for regression comparison.
