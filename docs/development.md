# Developer Guide

## Safe workspace

Perform development only in:

```text
C:\Users\Papi\ESPHome\sem-meter\sem-meter-esphome
```

The private recovery directory at `C:\Users\Papi\ESPHome\sem-meter` is not a
development workspace and is not committed to GitHub.

## Architecture

The local `sem_meter` component separates responsibilities:

| File | Responsibility |
| --- | --- |
| `sem_meter_parser.h` | ESPHome-independent record validation and field decoding |
| `sem_meter_accumulator.h` | Fixed-capacity stream accumulation and bounded frame processing |
| `sem_meter_diagnostics.h` | Counters, timing, independent parser/Wi-Fi health state machines, outage durations, and bounded event dispatch |
| `sem_meter_foundation.h` | Centralized component/hardware identity, portable reset-reason names, and runtime-only diagnostic counters |
| `sem_meter_report.h` | Pure read-only diagnostic snapshot formatting and bounded three-part transport |
| `sem_meter.h/.cpp` | UART integration, loop budgets, logging, and component getters |
| `__init__.py` | ESPHome schema, UART registration, and configurable calibration |

The YAML defines entities and calls read-only component getters. Parser and
accumulator code do not publish entities directly.

The parser watchdog is updated only by a transactionally accepted measurement
cycle. It evaluates health once per second, while YAML listens to its
one-shot timeout and restoration events to run centralized GPIO41 buzzer
scripts. See [the diagnostics guide](diagnostics.md) for entity semantics and
Home Assistant notification examples.

The Wi-Fi state machine is also ESPHome-independent. Official `wifi`
`on_connect`/`on_disconnect` triggers supply the real connection state, while
the component evaluates its wrap-safe timers approximately once per second.
Its simulation flag masks only the state-machine input; it never disables the
radio, API, parser, or sensor publication. Parser and Wi-Fi timeout simulations
are separate and can be tested independently.

All buzzer sequences are centralized as `mode: single` YAML scripts. If two
different alerts arrive while RTTTL is already playing, the shared RTTTL
player may replace the current tone sequence; neither event is queued
unboundedly and this has no effect on UART or parser state.

The self-test logic is another pure state machine in
`sem_meter_diagnostics.h`. A manual start records `millis()`, duplicate starts
are ignored, and normal component loops evaluate completion after two seconds.
The final snapshot checks parser health and frame age, real Wi-Fi plus its
watchdog and simulation state, ESPHome's official `api_is_connected()` result,
and conservative internal invariants. Entity publication and RTTTL dispatch
remain in the ESPHome integration/YAML layers.

Diagnostics v3 counter decisions remain in the native-testable foundation
layer. The ESPHome component forwards only one-shot watchdog events and
accepted/completed self-test transitions, then publishes the changed counter.
Identity and reset reason are published once during setup. The reset reason
uses ESP-IDF's public `esp_reset_reason()` API; `ESPHOME_VERSION` comes from
ESPHome's generated public version header.

Diagnostics v4 collects existing centralized values into one immutable
snapshot only when `Generate Diagnostic Report` is pressed. The pure report
helper formats that snapshot once, then splits it between complete label/value
blocks. Three 220-character text-sensor states avoid Home Assistant's
255-character entity-state limit. Report generation has no parser, watchdog,
counter, self-test, Wi-Fi, measurement, persistence, reboot, or buzzer side
effects.

## Behavioral invariants

Do not change these without captured-data evidence and a migration plan:

- UART RX GPIO39, 115200 baud, 8N1
- Complete frame size of 447 bytes
- Transport chunks of 150, 150, and 147 bytes
- `0xFF`, captured-fixture `0x3B`, and live-stream `0x3C` record markers
- Existing record IDs, statuses, field offsets, and calibration divisors
- Entity names, IDs, units, circuit mappings, and energy sensors
- `MAX_BYTES_PER_LOOP = 128`
- `MAX_FRAMES_PER_LOOP = 1`
- `MAX_BUFFER_SIZE = 894`

Transport chunks are not record boundaries. Never restore a newline delimiter,
`bytes: 400`, independent chunk parsing, or an unbounded UART loop.

## Local setup

1. Install Python, ESPHome, and a C++17-capable Visual Studio Build Tools
   environment.
2. Create `secrets.yaml` from `secrets.example.yaml`.
3. Replace every placeholder credential.
4. Keep `secrets.yaml`, firmware binaries, and device backups out of Git.

## Required verification

Run the host replay test from an x64 Native Tools Command Prompt:

```bat
cl /nologo /std:c++17 /EHsc /W4 /fsanitize=address /Zi /I components\sem_meter tests\parser_replay_test.cpp /Fe:tests\parser_replay_test.exe /link /INCREMENTAL:NO
tests\parser_replay_test.exe tests\captured_frame_001.hex
```

Then validate and compile:

```powershell
python -m esphome config .\sem-meter.yaml
python -m esphome compile .\sem-meter.yaml
```

Compilation and host tests are required before flashing. A successful compile
does not prove that a firmware image boots on the physical device.

## Development workflow

1. Confirm the current Git branch and working-tree status.
2. Preserve unrelated local changes.
3. Make one reversible change at a time.
4. Run host tests with AddressSanitizer.
5. Run ESPHome configuration validation and compilation.
6. Review `git diff --check`, `git diff --stat`, and the generated build path.
7. Flash only after a known-good recovery image is available.
8. Commit a milestone only after bench testing confirms successful boot,
   connectivity, and live readings.

## Sensitive and generated files

Never commit:

- `secrets.yaml`
- `.esphome/`
- firmware binaries or ELF/map files
- factory flash backups
- private recovery firmware
- serial logs containing credentials or other sensitive values

## Related references

- [Hardware guide](hardware.md)
- [Programming reference](programming-reference.md)
- [Flashing guide](flashing.md)
- [Recovery guide](recovery.md)
- [UART protocol](protocol.md)
- [Development milestone notes](../DEV_NOTES.md)
