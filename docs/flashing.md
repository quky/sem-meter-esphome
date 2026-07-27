# Flashing

These notes assume a CH341A or similar USB serial adapter connected as described
in [hardware.md](hardware.md).

## Enter Bootloader Mode

1. Disconnect power.
2. Ground IO0.
3. Apply 3.3 V power.
4. Keep IO0 grounded through power-up.

No beep from the meter is a useful sign that the ESP32-S3 is in bootloader mode.

## Factory Backup

Before replacing the factory firmware, make a full flash backup. Adjust the
serial port for your computer.

```sh
esptool.py --chip esp32s3 --port COM5 --baud 921600 read_flash 0x0 0x1000000 backups/w338-factory-16mb.bin
```

The W338 clone used here has 16 MB flash, so the backup length is `0x1000000`.
Do not commit this backup to Git.

## Factory Restore

To restore the original factory image:

```sh
esptool.py --chip esp32s3 --port COM5 --baud 921600 write_flash 0x0 backups/w338-factory-16mb.bin
```

## First ESPHome Serial Flash

Compile the firmware:

```sh
python -m esphome compile sem-meter.yaml
```

Flash over serial:

```sh
python -m esphome upload sem-meter.yaml --device COM5
```

## OTA Update

After the first successful ESPHome flash and Wi-Fi connection, update over OTA:

```sh
python -m esphome upload sem-meter.yaml --device sem-meter.local
```

You can also compile without uploading:

```sh
python -m esphome compile sem-meter.yaml
```
