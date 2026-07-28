# Programming Reference

## Header signals

The development board uses a project-installed 2.54 mm header on the factory
programming pads. Factory boards normally do not include it.

Required signals:

| Signal | Purpose |
| --- | --- |
| `3.3V` | Regulated 3.3 V bench power |
| `GND` | Common ground |
| `TXD` | Serial programming data |
| `RXD` | Serial programming data |
| `IO0` | Hold low during power-up to enter the ROM bootloader |
| `EN` | ESP32-S3 enable/reset signal |

Approximately 3.26 V was measured between `3.3V` and `GND` while the
development board was normally powered. There is no documented 5 V
programming input.

## CH340 wiring

| CH340 | SEM Meter |
|-------|-----------|
| 3.3V | 3.3V |
| GND | GND |
| TX | TXD |
| RX | RXD |

Set the CH340 voltage selector to 3.3 V. Never connect 5 V. Verify every signal
against the silk screen instead of relying only on cable color or header
orientation.

## Visual references

![Factory board orientation](images/board-overview.jpg)

*Factory SEM Meter board showing the location of the ESP32-S3 module and
programming header.*

![Installed development header](images/programming-header-closeup.jpg)

*Programming header installed on the development board. This header was added
during reverse engineering and firmware development. Factory boards normally
do not include this header.*

The verified arrow annotation planned as
`images/programming-header-labeled.png` is pending. See
[images/README.md](images/README.md) for its acceptance requirements.

## Bootloader check

With power disconnected, connect IO0 to GND and then apply regulated 3.3 V:

```powershell
python -m esptool --chip esp32s3 --port COM5 --baud 115200 --before no-reset chip-id
```

The documented development board reports an ESP32-S3 and MAC
`80:b5:4e:e3:f0:a4`. Other boards will have different MAC addresses.

See [flashing.md](flashing.md) for the complete flashing procedure.
