# Recovery Guide

## Recovery principle

Use OTA for routine updates. Use serial recovery only when the installed
firmware cannot provide a reliable OTA path.

The developer maintains known-good private recovery firmware outside the Git
repository:

```text
C:\Users\Papi\ESPHome\sem-meter
```

This directory is not committed to GitHub. Keep it unchanged and available
before testing experimental firmware.

## When to recover over serial

- OTA is unavailable.
- Wi-Fi credentials are invalid.
- The device is boot-looping.
- The ESPHome API is unavailable.
- Experimental firmware does not boot.

## Recovery steps

1. Disconnect mains and bench power.
2. Verify the CH340 is configured for 3.3 V.
3. Connect `3.3V`, `GND`, `TX`, and `RX` as shown in
   [programming-reference.md](programming-reference.md).
4. Connect `IO0` to `GND`.
5. Apply regulated 3.3 V.
6. Confirm the bootloader:

   ```powershell
   python -m esptool --chip esp32s3 --port COM5 --baud 115200 --before no-reset chip-id
   ```

7. Flash the selected factory-format recovery image at address `0x0`.
8. Wait for `Hash of data verified.`
9. Disconnect power.
10. Remove IO0 from GND.
11. Reconnect power and allow 20–30 seconds for startup.
12. Verify logs and connectivity.

For the repository-built image and exact command, follow
[flashing.md](flashing.md).

## Before diagnosing a failed boot

Check `secrets.yaml`. During development, placeholder values
`YOUR_WIFI_SSID` and `YOUR_WIFI_PASSWORD` made correctly built firmware appear
to have failed. Confirm credentials and the external antenna before assuming a
firmware or hardware fault.

## Recovery records

Record the image hash, ESPHome version, build time, flash command, serial port,
and test result for every known-good recovery artifact. Do not store private
firmware binaries in this repository.
