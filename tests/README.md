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
