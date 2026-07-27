# UART Protocol Notes

The AT32F421 metering MCU sends measurements to the ESP32-S3 over UART.

## UART

- ESP32 RX pin: GPIO39
- Baud: 115200
- Data bits: 8
- Parity: none
- Stop bits: 1

## Cycle Framing

A complete measurement cycle is 447 bytes. It arrives as three chunks:

- 150 bytes
- 150 bytes
- 147 bytes

The working ESPHome parser accumulates incoming UART debug bytes until at least
447 bytes are available, scans the accumulated cycle for records, then clears
the accumulator.

Do not replace this with a newline delimiter parser. Do not use the older
`bytes: 400` parser.

## Record Markers

Records may begin with either marker:

- `0xFF`
- `0x3B`

## Record IDs

| ID | Meaning |
| --- | --- |
| `0x00`-`0x0F` | Branch circuits 1-16 |
| `0x10` | Main Phase A |
| `0x11` | Main Phase B |
| `0x12` | Main Phase C |

## Status Values

Valid status values are:

- `0x01`: inactive, publish `0 W`
- `0x03`: active
- `0x07`: active

Other status values are ignored.

## Field Offsets

The parser treats `r` as the record payload pointer starting at the status byte:

```cpp
const uint8_t *r = &b[i + 2];
```

Offsets are relative to `r`.

| Field | Bytes | Decode |
| --- | --- | --- |
| Voltage | `r[4..5]` | big-endian `uint16_t / 10.30` |
| Power | `r[12..15]` | big-endian `uint32_t` |
| Frequency | `r[20]` | raw Hz value |

## Scaling

- Branch CT power: raw big-endian power / `95.0`
- Main CT power: raw big-endian power / `102.0`
- Main voltage: raw big-endian voltage / `10.30`
- Frequency: `r[20]`
