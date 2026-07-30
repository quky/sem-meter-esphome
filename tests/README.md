# SEM Meter Host Parser Replay Test

This test replays captured SEM Meter UART data through the same pure
fixed-buffer accumulator and record decoder used by the ESPHome component. The
shared path includes make-room recovery, two-pass ordered-cycle
synchronization, transactional electrical validation, malformed-cycle
deduplication, and 22-byte overlap consumption. It does not require ESPHome,
ESP-IDF, PlatformIO, or device hardware.

## Captured Fixture Correction

The original pasted log fixture was missing two zero bytes during
transcription: one in idle record `0x04` and one in idle record `0x09`.
`captured_frame_001.hex` inserts those two `00` bytes to restore the normal
22-byte record cadence and the expected 447-byte complete frame length.

Expected measurements are derived from the actual protocol offsets rather than
visually adjacent bytes. In particular, the payload begins at frame record
offset 2, raw power is the big-endian value at payload `r[12..15]`, and branch
watts are `raw_power / 95.0`. Circuit 3 therefore decodes as approximately
466.7 W from `00 00 AD 34`.

## Windows Build and Run

Open an **x64 Native Tools Command Prompt for Visual Studio**, change to the
repository root, and run:

```bat
cl /nologo /std:c++17 /EHsc /W4 /fsanitize=address /Zi /I components\sem_meter tests\parser_replay_test.cpp /Fe:tests\parser_replay_test.exe /link /INCREMENTAL:NO
tests\parser_replay_test.exe tests\captured_frame_001.hex
```

If the installed MSVC toolchain does not include AddressSanitizer, remove
`/fsanitize=address /Zi` and retain `/W4`.

The executable uses only the C++ standard library. Its replay coverage includes:

- The corrected 447-byte fixture length
- 150/150/147-byte partial feeding
- One-byte-at-a-time feeding
- 37 garbage bytes before valid frames
- Starting halfway through a frame
- Two complete frames back-to-back with one-frame-per-call enforcement
- Fixed-buffer overflow recovery
- Exact 22-byte overlap retention
- Buffer bounds under AddressSanitizer
- Both `0xFF` and `0x3B` record markers
- Circuit 2 and Circuit 3 power
- Phase A and Phase B voltage and nonzero power
- Line frequency
- Idle Phase C power
- An explicit active-to-idle power reset
- A 30-second first-frame startup grace period
- One-shot parser timeout and recovery transitions
- Completed outage-duration tracking
- No recovery event for the first valid frame during a normal boot
- Watchdog-only timeout simulation that defaults off
- Continued parser and electrical-output updates during simulation
- One-shot simulated timeout, recovery, and outage-duration tracking
- Wi-Fi connection within the 180-second startup grace without alerts
- Never-connected Wi-Fi timeout and one-shot event behavior
- Brief disconnection below the 120-second threshold without an outage
- Sustained Wi-Fi timeout, recovery, completed duration, and five-second
  `RECOVERED` state
- Wi-Fi timeout simulation that preserves real connectivity and defaults off
- Wrap-safe Wi-Fi outage timing across `millis()` rollover
- Independence of the parser and Wi-Fi diagnostic state machines
- Self-test `NOT_RUN`, `RUNNING`, `PASS`, and `FAIL` state transitions
- Duplicate self-test start rejection and one-shot result signals
- Parser, Wi-Fi, API, internal-state, and ordered combined failure tokens
- Self-test duration across `millis()` rollover
- Centralized component/hardware identity constants
- All supported reset-reason names plus safe unknown handling
- Runtime parser/Wi-Fi counters across real, simulated, recovered, and repeated outages
- Runtime self-test run/failure counters and duplicate-start protection
- Explicit runtime-counter rollover from `UINT32_MAX` to zero
