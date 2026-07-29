# ESPHome Firmware for W338 SEM Meter Clones

## Project overview

This repository contains ESPHome firmware for the Fusion Energy / SEM Meter
W338 clone built around an ESP32-S3-WROOM-1U Wi-Fi module and an AT32F421
metering controller.

The firmware replaces the original cloud integration while preserving the
meter's observed UART protocol. A reusable local component performs bounded
UART accumulation, record decoding, diagnostics, and reliability-state
tracking without blocking ESPHome's Wi-Fi, API, OTA, web server, or watchdog
tasks.

## Features

- Sixteen named branch-circuit power sensors
- Phase A, Phase B, Phase C, total-main, and balance power sensors
- Phase A and Phase B voltage and line-frequency sensors
- Daily energy sensors for every branch and total main power
- Per-circuit enable and 240 V multiplier switches
- ESPHome API, OTA updates, web server, Wi-Fi diagnostics, and restart control
- GPIO41 passive-buzzer support using LEDC/PWM and RTTTL
- One-shot parser timeout and recovery alerts with a 30-second startup grace
- Fixed-capacity 447-byte UART frame accumulation
- Support for `0xFF`, captured-fixture `0x3B`, and live-stream `0x3C` record markers
- Host-side captured-frame, recovery, diagnostics, and AddressSanitizer tests
- Internal bounded event interface ready for future notification listeners

## Home Assistant diagnostics

The component exposes a deliberately small diagnostic set. `SEM Meter Healthy`,
`UART Healthy`, `Component State`, and `Last Event` are enabled by default.
Advanced numeric diagnostics—milliseconds since the last valid frame, frames
processed, malformed frames, buffer recoveries, and event count—are disabled
by default and update every five seconds.

Health, state, and last-event entities publish immediately when a real state or
event transition occurs. The YAML does not duplicate parser or timeout logic.

Production watchdog entities add `SEM Parser Healthy`, `SEM Diagnostic Status`,
`SEM Last Valid Frame Age`, and `SEM Last Parser Outage Duration`. The watchdog
allows 30 seconds for startup synchronization, then requires an accepted frame
at least every 10 seconds. Its buzzer alerts occur once per failure or recovery
transition and never repeat continuously.

Home Assistant—not ESPHome—owns Telegram delivery. See the
[parser watchdog and notification guide](docs/diagnostics.md) for entity
semantics, complete lost/restored automation examples, and troubleshooting.

## Sensor value validation

Every voltage, frequency, circuit-power, main-power, total-power, and balance
sample passes through a shared validation filter immediately before Home
Assistant publication. The initial absolute ranges are 70–150 V for phase
voltage, 40–70 Hz for frequency, 0–50 kW per circuit, 0–100 kW per main phase,
and 0–200 kW for total and balance power. Balance remains non-negative, matching
its existing clamped behavior.

The validator also compares each sample with its last accepted value. Maximum
one-sample changes are 40 V, 10 Hz, 20 kW per circuit, 50 kW per main phase, and
100 kW for total or balance power. A valid zero always passes the power jump
check so idle records retain their established zero-reset behavior.

Rejected samples are dropped from the filter chain, leaving Home Assistant and
daily-energy integration on the last good value. `Last Rejected Sensor` and
`Last Rejection Reason` are enabled diagnostic text sensors. `Last Rejected
Value` and `Rejected Samples` are available but disabled by default.

Validation begins independently for each measurement only after its UART record
has been decoded. Startup placeholder values therefore remain unavailable and
do not count as rejected samples. Before the first real rejection, the rejected
sample count is `0`, the rejected sensor and reason are `NONE`, and `Last
Rejected Value` remains unavailable rather than publishing a fabricated zero.

## Supported hardware

| Item | Supported configuration |
| --- | --- |
| Meter | Fusion Energy / SEM Meter W338 clone |
| Wi-Fi module | ESP32-S3-WROOM-1U |
| Metering controller | AT32F421 |
| Meter UART RX | ESP32 GPIO39 |
| Onboard buzzer | Passive buzzer on ESP32 GPIO41; LEDC/PWM required |
| UART format | 115200 baud, 8 data bits, no parity, 1 stop bit |
| Flash size | 16 MB |
| Antenna | External 2.4 GHz antenna required for the `-1U` module |
| Serial programming voltage | 3.3 V only |

Hardware revisions can differ. Verify the PCB silk screen and board voltage
before connecting a programmer.

## Repository layout

```text
.
├── components/
│   └── sem_meter/
│       ├── __init__.py
│       ├── sem_meter.cpp
│       ├── sem_meter.h
│       ├── sem_meter_accumulator.h
│       ├── sem_meter_diagnostics.h
│       ├── sem_meter_parser.h
│       ├── sem_meter_validator.cpp
│       └── sem_meter_validator.h
├── docs/
│   ├── development.md
│   ├── flashing.md
│   ├── hardware.md
│   ├── images/
│   ├── programming-reference.md
│   ├── protocol.md
│   └── recovery.md
├── tests/
│   ├── captured_frame_001.hex
│   ├── parser_replay_test.cpp
│   └── README.md
├── DEV_NOTES.md
├── secrets.example.yaml
└── sem-meter.yaml
```

## Installation

1. Install Python and ESPHome.
2. Clone the repository and change to its directory:

   ```powershell
   cd "C:\Users\Papi\ESPHome\sem-meter\sem-meter-esphome"
   ```

3. Copy `secrets.example.yaml` to `secrets.yaml`.
4. Replace all placeholder Wi-Fi values with real credentials. Never commit
   `secrets.yaml`.
5. Validate and compile:

   ```powershell
   python -m esphome config .\sem-meter.yaml
   python -m esphome compile .\sem-meter.yaml
   ```

6. If working firmware is already connected to Wi-Fi, use the recommended OTA
   procedure in [the flashing guide](docs/flashing.md). Use serial recovery
   only when OTA is unavailable.

## Documentation

- [Developer guide](docs/development.md)
- [Parser watchdog and notifications](docs/diagnostics.md)
- [Hardware guide](docs/hardware.md)
- [Programming reference](docs/programming-reference.md)
- [Flashing guide](docs/flashing.md)
- [Recovery guide](docs/recovery.md)
- [UART protocol reference](docs/protocol.md)
- [Migration from MQTT entity IDs](docs/migration-from-mqtt.md)
- [Host replay test guide](tests/README.md)

## Protocol summary

The meter emits a 447-byte measurement cycle as transport chunks of 150, 150,
and 147 bytes. Chunk boundaries are not record boundaries. The component
preserves partial data and processes at most one frame per loop invocation.

The scheduler-safety limits are intentionally fixed:

```text
MAX_BYTES_PER_LOOP = 128
MAX_FRAMES_PER_LOOP = 1
MAX_BUFFER_SIZE = 894
```

See [docs/protocol.md](docs/protocol.md) for record layouts, offsets, status
values, and calibration divisors.

## Contributing

Before proposing a change:

1. Work on a development branch.
2. Preserve existing entity names and IDs unless a migration plan is included.
3. Do not introduce unbounded UART loops or dynamic allocation in the parser
   path.
4. Run the AddressSanitizer host replay tests.
5. Run ESPHome configuration validation and compilation.
6. Do not include Wi-Fi credentials, private firmware images, flash backups, or
   device-specific secrets.

See [docs/development.md](docs/development.md) for the full workflow.

## Developer Notes

[DEV_NOTES.md](DEV_NOTES.md) records project-specific milestones and recovery
context. It is useful historical information, but contributors should follow
the current build and safety procedures in `docs/`.

The developer also maintains private recovery firmware outside this repository
at `C:\Users\Papi\ESPHome\sem-meter`. That directory is not committed to
GitHub and must not be used for experiments.

## Troubleshooting

- Missing Phase B usually means secondary-marker records (`0x3B` or live
  `0x3C`) are being ignored.
- Missing records can result from parsing 150/150/147 transport chunks
  independently.
- Weak or unavailable Wi-Fi can result from operating the
  ESP32-S3-WROOM-1U without its required external antenna.
- `FRAME_TIMEOUT` means accepted SEM frames have stopped. Last-good electrical
  values may remain visible until parser communication recovers.
- Wi-Fi/API connectivity and SEM UART/parser health are independent.
- A device that appears not to boot may simply contain placeholder Wi-Fi
  credentials. Check `secrets.yaml` before assuming a hardware failure.

## License

MIT
