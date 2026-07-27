# ESPHome Firmware for W338 SEM Meter Clones

ESPHome configuration for the Fusion Energy / SEM Meter W338 clone using an
ESP32-S3-WROOM-1U module and AT32F421 metering MCU.

This project preserves the working UART accumulator behavior in a reusable,
scheduler-safe local ESPHome component. The meter sends one complete
measurement cycle as three UART transport chunks:

- 150 bytes
- 150 bytes
- 147 bytes
- 447 bytes total

The parser accepts records beginning with either `0xFF` or `0x3B`. It does not
use a newline delimiter and does not use the older `bytes: 400` parser pattern.
Transport chunks are accumulated as a continuous byte stream; they are not
parsed independently.

## Local Component

The UART accumulation and record decoding live outside the YAML:

```text
components/
└── sem_meter/
    ├── __init__.py
    ├── sem_meter_accumulator.h
    ├── sem_meter_parser.h
    ├── sem_meter.h
    └── sem_meter.cpp
```

The component uses a fixed-capacity receive buffer and preserves partial
records between ESPHome loop calls. Each loop reads at most 128 UART bytes and
decodes at most one 447-byte frame before returning control to ESPHome. This
keeps Wi-Fi, API, OTA, web server, and watchdog servicing responsive.

Calibration remains configurable in `sem-meter.yaml`:

```yaml
sem_meter:
  id: sem_meter_parser
  uart_id: meter_uart
  branch_power_divisor: 95.0
  main_power_divisor: 102.0
  voltage_divisor: 10.30
```

## Features

- 16 branch-circuit power sensors
- Phase A and Phase B voltage sensors
- Phase A, Phase B, Phase C, and total main power sensors
- Line frequency sensor
- Per-circuit daily energy sensors
- Total daily energy sensor
- Balance power sensor: total main power minus enabled branch-circuit power,
  clamped to zero
- Per-circuit enabled switches, default ON
- Per-circuit 240 V multiplier switches, default OFF except pool pump and A/C
- Wi-Fi, API, OTA, web server, restart button, and diagnostics

## Hardware

- Device: Fusion Energy / SEM Meter W338 clone
- Wi-Fi MCU: ESP32-S3-WROOM-1U
- Metering MCU: AT32F421
- Meter UART RX: GPIO39
- UART format: 115200 baud, 8N1
- External antenna required for the ESP32-S3-WROOM-1U variant used here

## Quick Start

1. Copy `secrets.example.yaml` to `secrets.yaml`.
2. Fill in your Wi-Fi SSID and password in `secrets.yaml`.
3. Validate the configuration:

   ```sh
   python -m esphome config sem-meter.yaml
   ```

4. Compile the firmware:

   ```sh
   python -m esphome compile sem-meter.yaml
   ```

5. Flash over serial or OTA. See [docs/flashing.md](docs/flashing.md).

## Troubleshooting

### Phase B is missing

Phase B records may use the secondary `0x3B` marker. A parser that accepts only
`0xFF` records commonly loses Phase B.

### Some records are missing

The 150/150/147-byte UART chunks are transport boundaries, not record
boundaries. Parsing each chunk independently can discard a record split across
two chunks.

### Wi-Fi is weak or unavailable

The ESP32-S3-WROOM-1U module used by this meter requires an external antenna.
Confirm that a compatible antenna is securely connected.

## Documentation

- [Hardware notes](docs/hardware.md)
- [Flashing and backup commands](docs/flashing.md)
- [UART protocol notes](docs/protocol.md)
- [Migrating from MQTT entity IDs](docs/migration-from-mqtt.md)

## Circuit Names

The included configuration uses these circuit labels:

| Circuit | Label |
| --- | --- |
| 1 | Laundry |
| 2 | Kitchen Cooking |
| 3 | Master Bedroom |
| 4 | Welder Plug |
| 5 | Generator Plug |
| 6 | Microwave |
| 7 | Air Handler |
| 8 | Circuit 8 |
| 9 | Circuit 9 |
| 10 | Pool Pump |
| 11 | Master Bedroom Light |
| 12 | Lights Ely Mami Bathroom |
| 13 | A/C |
| 14 | Lights Garage Laundry Kitchen |
| 15 | Receptacle Below Panel |
| 16 | TP Link Power Strip |

## License

MIT
