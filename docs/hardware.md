# Hardware Notes

This project targets the Fusion Energy / SEM Meter W338 clone.

## Known Hardware

- ESP32-S3-WROOM-1U Wi-Fi module
- AT32F421 metering MCU
- Meter UART RX on ESP32 GPIO39
- UART format: 115200 baud, 8 data bits, no parity, 1 stop bit

## Antenna

The working board uses an ESP32-S3-WROOM-1U module. The `U` variant requires an
external antenna. Install and position an appropriate 2.4 GHz antenna before
expecting reliable Wi-Fi performance.

## CH341A Serial Wiring

For this board, the CH341A USB serial adapter wiring that worked was:

| CH341A | Board |
| --- | --- |
| 3.3 V | 3.3 V |
| GND | GND |
| TX | TX |
| RX | RX |

This is unusual compared with the common crossed TX/RX wiring. On this board,
use TX to TX and RX to RX.

Use 3.3 V power. Do not power the ESP32-S3 UART pins with 5 V logic.

## Bootloader Mode

Ground IO0 before power-up to enter the ESP32-S3 serial bootloader. When the
board is in bootloader mode, there may be no beep from the meter.
