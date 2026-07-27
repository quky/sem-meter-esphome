# UART Protocol Notes

The AT32F421 metering MCU sends measurements to the ESP32-S3 over UART.

## UART

- ESP32 RX pin: GPIO39
- Baud: 115200
- Data bits: 8
- Parity: none
- Stop bits: 1

## Cycle Framing

A complete measurement cycle is 447 bytes. It is transported as three chunks:

- 150 bytes
- 150 bytes
- 147 bytes

The chunk boundaries are transport boundaries, not record boundaries. Records
can cross from one chunk into the next, so the 150, 150, and 147-byte chunks
must not be parsed independently.

The local component treats UART input as a continuous stream and preserves
partial data between ESPHome loop calls. Scheduler work is strictly bounded:

- At most 128 UART bytes are read per loop call.
- At most one complete 447-byte frame is decoded per loop call.
- The receive buffer has a fixed 894-byte capacity.
- A 22-byte overlap is retained when consuming a frame so a split record can
  be completed on a later call.

If synchronization is lost and the fixed buffer fills, the oldest bytes are
dropped with a warning. The component does not allocate memory continuously in
its loop.

Do not replace this with a newline delimiter parser. Do not use the older
`bytes: 400` parser.

## Record Layout

Every record begins with a marker, followed by its record ID and payload. The
payload pointer `r` begins at the status byte:

| Record byte | Meaning |
| --- | --- |
| Byte 0 | Marker (`0xFF` or `0x3B`) |
| Byte 1 | Record ID |
| Byte 2 / `r[0]` | Status |
| `r[4..5]` | Voltage, big-endian `uint16_t` |
| `r[12..15]` | Power, big-endian `uint32_t` |
| `r[20]` | Frequency in Hz |

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
