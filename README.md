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
- Fixed-capacity 447-byte UART frame accumulation
- Support for both `0xFF` and `0x3B` record markers
- Host-side captured-frame, recovery, diagnostics, and AddressSanitizer tests
- Internal bounded event interface ready for future notification listeners

## Supported hardware

| Item | Supported configuration |
| --- | --- |
| Meter | Fusion Energy / SEM Meter W338 clone |
| Wi-Fi module | ESP32-S3-WROOM-1U |
| Metering controller | AT32F421 |
| Meter UART RX | ESP32 GPIO39 |
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
│       └── sem_meter_parser.h
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

- Missing Phase B usually means `0x3B` records are being ignored.
- Missing records can result from parsing 150/150/147 transport chunks
  independently.
- Weak or unavailable Wi-Fi can result from operating the
  ESP32-S3-WROOM-1U without its required external antenna.
- A device that appears not to boot may simply contain placeholder Wi-Fi
  credentials. Check `secrets.yaml` before assuming a hardware failure.

## License

MIT
