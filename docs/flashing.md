# SEM Meter Flashing Guide

## Electrical Safety

The SEM Meter is mains-connected equipment. Disconnect mains power and all
monitored circuits before opening the enclosure or attaching a serial adapter.
Use only regulated 3.3 V power and 3.3 V logic for serial programming. Never
connect 5 V to the board.

Review [hardware.md](hardware.md) and verify all wiring against the PCB silk
screen before applying power.

## OTA Updates (recommended)

OTA is the preferred update method whenever the installed firmware boots
normally and connects to Wi-Fi.

```powershell
cd "C:\Users\Papi\ESPHome\sem-meter\sem-meter-esphome"

python -m esphome run .\sem-meter.yaml --device 192.168.8.100
```

The command validates, compiles, uploads, and opens logs. Confirm that
`secrets.yaml` contains valid credentials before starting.

## Serial Recovery

Use serial flashing only when one or more of these conditions applies:

- OTA is unavailable.
- Wi-Fi credentials are invalid.
- Firmware is in a boot loop.
- The ESPHome API is unavailable.
- Experimental firmware fails to boot.

Serial recovery requires access to `3.3V`, `GND`, `TXD`, `RXD`, `IO0`, and
`EN`. Factory boards normally require a header to be installed on the
programming pads.

## Entering Bootloader

1. Disconnect power.
2. Connect `IO0` to `GND`.
3. Connect the CH340 adapter as documented in
   [programming-reference.md](programming-reference.md).
4. Confirm the CH340 voltage selector is set to **3.3 V**.
5. Apply regulated 3.3 V.
6. Check bootloader communication:

   ```powershell
   python -m esptool --chip esp32s3 --port COM5 --baud 115200 --before no-reset chip-id
   ```

Expected identification for the development board:

```text
ESP32-S3
MAC 80:b5:4e:e3:f0:a4
```

If a different device is being programmed, its MAC address will be different.

## Compiling Firmware

From the development repository:

```powershell
cd "C:\Users\Papi\ESPHome\sem-meter\sem-meter-esphome"

python -m esphome config .\sem-meter.yaml
python -m esphome compile .\sem-meter.yaml
```

The factory-format image is generated at:

```text
.\.esphome\build\sem-meter\build\firmware.factory.bin
```

Compilation does not upload firmware.

## Flashing

With the board still in bootloader mode:

```powershell
python -m esptool --chip esp32s3 --port COM5 --baud 115200 --before no-reset write-flash 0x0 ".\.esphome\build\sem-meter\build\firmware.factory.bin"
```

Do not remove power or disturb the serial connection during the write. A
successful operation includes:

```text
Hash of data verified.
```

## Returning to Normal Boot

1. Disconnect power.
2. Remove the connection between `IO0` and `GND`.
3. Reconnect normal power.
4. Wait approximately 20–30 seconds.
5. Verify operation:

   ```powershell
   python -m esphome logs .\sem-meter.yaml --device 192.168.8.100
   ```

Do not leave IO0 grounded during normal startup.

## Lessons Learned

During development, firmware appeared not to boot. The actual cause was that
the development repository contained placeholder Wi-Fi credentials:

```text
YOUR_WIFI_SSID
YOUR_WIFI_PASSWORD
```

Always verify `secrets.yaml` before assuming the firmware or hardware has
failed. The real `secrets.yaml` must remain uncommitted.

## Known-good recovery firmware

The developer maintains private recovery firmware outside this repository at:

```text
C:\Users\Papi\ESPHome\sem-meter
```

That directory is not committed to GitHub. Do not experiment in it or replace
its known-good artifacts. See [recovery.md](recovery.md) for the recovery
workflow.

## Troubleshooting

### Cannot connect with esptool

- Confirm the correct COM port; `COM5` is specific to the documented bench.
- Confirm IO0 was connected to GND before power was applied.
- Confirm the CH340 is connected and selected for 3.3 V.
- Check TX, RX, GND, and 3.3 V against the PCB silk screen.
- Close other programs that may already have the serial port open.

### Device flashes but does not reconnect

- Remove IO0 from GND before normal boot.
- Wait 20–30 seconds.
- Verify that `secrets.yaml` contains real Wi-Fi credentials rather than
  placeholders.
- Confirm the external antenna is connected to the ESP32-S3-WROOM-1U.

### OTA unavailable

- Verify the device is reachable at `192.168.8.100`.
- Check Wi-Fi credentials, antenna connection, and network isolation rules.
- If the running firmware cannot connect to Wi-Fi, use serial recovery.

### ESPHome API unavailable

- Check device logs and confirm port 6053 is reachable.
- Verify the device has not entered a boot loop.
- If logs and OTA are both unavailable, use serial recovery.
