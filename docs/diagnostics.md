# Reliability Diagnostics and Notifications

## Architecture

The SEM parser remains the source of truth for communication health. A frame
updates the watchdog timestamp only after the existing ordered-cycle parser and
electrical validator have accepted the complete cycle. Raw UART bytes,
incomplete input, structurally malformed cycles, and electrically rejected
cycles do not reset the watchdog.

The component evaluates health once per second. State transitions are exposed
to Home Assistant, while two centralized ESPHome scripts drive the local
buzzer:

- `buzzer_parser_lost`: three short warning beeps
- `buzzer_parser_recovered`: one short positive chirp

Both scripts use `mode: single`, so repeated requests cannot queue or stack the
same sound. No sound is played for every frame and no reminder repeats while an
outage persists.

Telegram is intentionally handled by Home Assistant:

- ESPHome cannot send Telegram messages when the device itself has lost Wi-Fi.
- Home Assistant provides centralized routing, timestamps, quiet hours, and
  escalation.
- The onboard buzzer gives an immediate local warning.
- Telegram supplies a detailed remote notification.

Wi-Fi health is tracked independently from parser health. ESPHome's official
`wifi.on_connect` and `wifi.on_disconnect` triggers update a bounded,
ESPHome-independent state machine. The component checks its timers about once
per second. A Wi-Fi outage does not stop local UART parsing, electrical
validation, energy calculation, or the local buzzer.

## Confirmed buzzer hardware

The W338 meter's onboard buzzer is a passive transducer connected to GPIO41.
It requires LEDC/PWM and is driven through ESPHome RTTTL. GPIO21 is not used.

Available patterns are:

| Pattern | Purpose | Behavior |
| --- | --- | --- |
| Buzzer Two Beeps | Manual hardware test | Two short beeps on demand |
| Parser lost | Communication failure | Three short separated warning beeps, once |
| Parser recovered | Communication recovery | One short positive chirp, once |
| Wi-Fi lost | Sustained network failure | Two longer descending tones, once |
| Wi-Fi recovered | Network recovery | Two short ascending chirps, once |
| Self-test start | Manual test accepted | One very short neutral chirp |
| Self-test pass | Every available check passed | Three short ascending tones |
| Self-test fail | One or more checks failed | One long low tone, then two short low tones |

The manual `Buzzer Two Beeps` button is disabled by default and categorized as
a diagnostic entity. Enable it from the device's entity settings in Home
Assistant before using it.

## Watchdog timing

Parser timing:

- A 30-second grace period after component startup allows UART synchronization.
- No loss alarm occurs during that grace period.
- If no valid frame has ever arrived when the grace period expires, the parser
  becomes unhealthy and the warning pattern plays once.
- After at least one valid frame, 10 seconds without another accepted frame
  declares `FRAME_TIMEOUT` and plays the warning once.
- A continuing outage remains silent.
- The first accepted frame after a declared outage restores health, records the
  outage duration, and plays one recovery chirp.
- The first valid frame during a normal boot is `UART_STARTED`, not
  `UART_RESTORED`, so it does not play a recovery chirp.
- All elapsed-time calculations use wrap-safe unsigned millisecond arithmetic.

Wi-Fi timing:

- A 180-second initial grace period allows a normal first connection without a
  warning or recovery sound.
- If Wi-Fi has never connected after that grace period, one `WIFI_TIMEOUT`
  event and one Wi-Fi warning pattern are raised.
- After the first connection, a disconnect starts a pending timer immediately.
- A reconnect before 120 seconds clears the pending outage silently and does
  not record an outage duration.
- A disconnect lasting at least 120 seconds raises one `WIFI_TIMEOUT`; the
  warning never repeats during that outage.
- Recovery after a declared outage raises one `WIFI_RESTORED`, records the
  complete outage duration, and shows `RECOVERED` for five seconds.
- A normal first connection never produces a recovery sound.
- All elapsed-time calculations remain correct across `millis()` rollover.

## Home Assistant entity reference

Home Assistant may prepend the ESPHome device name to generated entity IDs.
Confirm the actual IDs in **Settings → Devices & services → ESPHome → SEM
Meter** before using the examples below.

| Displayed name | Likely entity ID | Type | Unit | Meaning | Normal value |
| --- | --- | --- | --- | --- | --- |
| SEM Parser Healthy | `binary_sensor.sem_meter_sem_parser_healthy` | Binary sensor | — | At least one accepted frame has arrived and the watchdog is not timed out | `on` |
| SEM Diagnostic Status | `text_sensor.sem_meter_sem_diagnostic_status` | Text sensor | — | User-facing parser watchdog state | `RECEIVING_DATA` |
| SEM Last Valid Frame Age | `sensor.sem_meter_sem_last_valid_frame_age` | Sensor | s | Seconds since the most recently accepted frame | Near `0` |
| SEM Last Parser Outage Duration | `sensor.sem_meter_sem_last_parser_outage_duration` | Sensor | s | Duration of the most recently recovered outage | Last completed duration |
| Simulate Parser Timeout | `switch.sem_meter_simulate_parser_timeout` | Switch | — | Diagnostic-only watchdog input suppression | `off` |
| SEM Meter Online | `binary_sensor.sem_meter_sem_meter_online` | Binary sensor | — | Standard ESPHome/API reachability used for real remote outage detection | `on` |
| SEM WiFi Healthy | `binary_sensor.sem_meter_sem_wifi_healthy` | Binary sensor | — | Firmware-declared Wi-Fi health; useful for simulation and post-reconnection diagnosis | `on` after first connection |
| SEM WiFi Diagnostic Status | `text_sensor.sem_meter_sem_wifi_diagnostic_status` | Text sensor | — | Wi-Fi state-machine status | `CONNECTED` |
| SEM Last WiFi Outage Duration | `sensor.sem_meter_sem_last_wifi_outage_duration` | Sensor | s | Duration of the most recently recovered declared Wi-Fi outage | Last completed duration |
| SEM WiFi Disconnect Age | `sensor.sem_meter_sem_wifi_disconnect_age` | Sensor | s | Current real or simulated disconnect age; zero while effectively connected | `0` |
| Simulate WiFi Timeout | `switch.sem_meter_simulate_wifi_timeout` | Switch | — | Diagnostic-only Wi-Fi state-machine input override | `off` |
| Run SEM Self-Test | `button.sem_meter_run_sem_self_test` | Button | — | Starts one safe, nonblocking diagnostic run | — |
| SEM Self-Test Status | `text_sensor.sem_meter_sem_self_test_status` | Text sensor | — | `NOT_RUN`, `RUNNING`, `PASS`, or `FAIL` | `NOT_RUN` until manually run |
| SEM Self-Test Summary | `text_sensor.sem_meter_sem_self_test_summary` | Text sensor | — | Concise dashboard/notification result | `Self-test has not run` |
| SEM Self-Test Failed Checks | `text_sensor.sem_meter_sem_self_test_failed_checks` | Text sensor | — | Stable comma-separated failure tokens | `NONE` |
| SEM Last Self-Test Duration | `sensor.sem_meter_sem_last_self_test_duration` | Sensor | s | Most recent completed test duration | Unavailable until completion |
| Last Event | `text_sensor.sem_meter_last_event` | Text sensor | — | Latest internal reliability event | Usually `UART_STARTED` or another recent event |
| WiFi Signal | `sensor.sem_meter_wifi_signal` | Sensor | dBm | Device Wi-Fi signal, independent of SEM UART health | Site dependent |

`SEM Parser Healthy` starts false and does not claim healthy operation until a
complete frame has been accepted. Before that first frame, `SEM Last Valid
Frame Age` is unavailable rather than reporting a misleading zero. `SEM Last
Parser Outage Duration` remains unavailable until the first outage recovery,
then retains the most recent completed duration.

The lost automation below intentionally reports loss only after the parser was
previously healthy. A device that never receives its first frame remains off;
its local warning still sounds after 30 seconds, and Home Assistant shows
`FRAME_TIMEOUT`.

`SEM Diagnostic Status` uses:

- `STARTING`
- `WAITING_FOR_FIRST_FRAME`
- `RECEIVING_DATA`
- `FRAME_TIMEOUT`
- `RECOVERED`

`RECOVERED` remains visible for one diagnostic update interval, then returns to
`RECEIVING_DATA`.

`SEM WiFi Diagnostic Status` uses:

- `STARTING`
- `WAITING_FOR_WIFI`
- `CONNECTED`
- `DISCONNECTED_PENDING`
- `WIFI_TIMEOUT`
- `RECOVERED`

`SEM Meter Online` and `SEM WiFi Healthy` are intentionally different. The
standard online sensor is the Home Assistant-visible indication that the
ESPHome node/API is reachable. `SEM WiFi Healthy` is firmware-owned diagnostic
state. During a real physical disconnection its new state cannot reach Home
Assistant until the connection returns, so it is not the correct source for
the immediate remote lost notification.

## Safe parser-timeout simulation

`Simulate Parser Timeout` exists for installed meters whose ESP32 and metering
controller cannot be powered or disconnected independently. It suppresses only
the accepted-frame notification sent to the watchdog. UART reception,
structural parsing, electrical validation, live sensor updates, and daily
energy processing continue normally.

This switch is diagnostic-only, disabled by default, and configured with
`restore_mode: ALWAYS_OFF`. It always returns to off after a reboot and cannot
produce a boot-time simulated outage.

To run the hardware test:

1. In Home Assistant, open the SEM Meter device and enable the disabled
   `Simulate Parser Timeout` entity.
2. Confirm `SEM Parser Healthy` is on, the diagnostic status is
   `RECEIVING_DATA`, and electrical readings are updating.
3. Turn `Simulate Parser Timeout` on.
4. Verify electrical measurements continue updating normally.
5. After the existing 10-second threshold, verify:
   - `SEM Parser Healthy` turns off.
   - `SEM Diagnostic Status` becomes `FRAME_TIMEOUT`.
   - The buzzer plays three warning beeps once.
   - Last-valid-frame age continues increasing.
   - The Home Assistant lost-communication automation runs, if configured.
6. Leave the switch on briefly and confirm the warning does not repeat.
7. Turn the switch off.
8. On the next accepted cycle, verify:
   - Parser health returns on.
   - One recovery chirp plays.
   - `RECOVERED` appears for five seconds.
   - The completed outage duration updates.
   - Normal readings remain uninterrupted.

Do not leave the simulation enabled after testing. Rebooting is also guaranteed
to clear it because the switch never restores its previous state.

## Safe Wi-Fi-timeout simulation

`Simulate WiFi Timeout` tests the Wi-Fi watchdog without disconnecting the
radio, API, or Home Assistant. It masks only the connectivity input seen by
the Wi-Fi health state machine. UART reception, parsing, validation, electrical
sensor publication, and energy calculation continue unchanged.

The switch is diagnostic-only, disabled by default, and uses
`restore_mode: ALWAYS_OFF`; both its Home Assistant state and internal boolean
start off after every reboot.

To run the hardware test:

1. In the SEM Meter device page, enable the disabled `Simulate WiFi Timeout`
   entity.
2. Confirm `SEM Meter Online` and `SEM WiFi Healthy` are on, Wi-Fi status is
   `CONNECTED`, disconnect age is zero, and electrical readings update.
3. Turn `Simulate WiFi Timeout` on. Confirm the device remains reachable and
   measurements continue updating.
4. Before 120 seconds, confirm the status is `DISCONNECTED_PENDING` and no
   sound has played.
5. At 120 seconds, confirm `SEM WiFi Healthy` turns off, status becomes
   `WIFI_TIMEOUT`, and the two descending warning tones play exactly once.
6. Leave the switch on long enough to confirm the warning does not repeat.
7. Turn the switch off. On the next evaluation, confirm one ascending recovery
   chirp, health on, `RECOVERED`, and a completed outage duration.
8. After five seconds, confirm status returns to `CONNECTED` and disconnect age
   returns to zero.

The simulation is diagnostic-only. Turn it off after testing; a reboot also
guarantees that it is cleared.

## Manual SEM self-test

Press `Run SEM Self-Test` from the SEM Meter device page. The test is manual
only: it does not run at boot or on a schedule. A second press while status is
`RUNNING` is ignored safely.

Execution takes about two seconds and does not block normal component loops.
UART reception, parser validation, power publication, energy integration,
Wi-Fi, API, and both watchdogs continue normally. The test never enables a
simulation, reboots, resets, updates, or disconnects anything.

The result checks:

- **Parser:** the parser watchdog is healthy, at least one valid frame has been
  accepted, and its age is below the configured parser timeout.
- **Wi-Fi:** the real Wi-Fi connection is active, its watchdog is healthy, and
  Wi-Fi-timeout simulation is off.
- **API:** ESPHome's official `api_is_connected()` reports at least one native
  API client.
- **Internal state:** conservative parser/Wi-Fi invariants are consistent.
- **Buzzer command path:** the local status transition dispatches a short
  start tone and one pass/fail pattern through RTTTL.

The buzzer portion verifies only firmware command dispatch. The device has no
microphone or electrical feedback capable of proving that a physical sound was
heard, so audible output must be confirmed by a person.

Expected healthy run:

1. Status becomes `RUNNING`; summary becomes `Self-test in progress`; failed
   checks becomes `NONE`; one neutral chirp is requested.
2. After about two seconds, status becomes `PASS`, summary becomes `All checks
   passed`, duration updates, and three ascending tones are requested.

On failure, status becomes `FAIL`, one failure pattern is requested, and failed
checks contains stable tokens in this order:

```text
PARSER,WIFI,API,INTERNAL_STATE
```

Only failing tokens are included. `SEM Last Self-Test Duration` retains the
latest completed duration. No device-time entity is added: Home Assistant
already records the result entity's state-change timestamp and supplies
timestamps for notifications.

## Telegram automation examples

Replace the placeholder Telegram config-entry ID, chat ID, and all example
entity IDs with values from your Home Assistant installation.

### Parser communication lost

```yaml
alias: "SEM Meter - Parser Communication Lost"
description: "Send a Telegram alert when accepted SEM frames time out."
mode: single
trigger:
  - platform: state
    entity_id: binary_sensor.sem_meter_sem_parser_healthy
    from: "on"
    to: "off"
action:
  - service: notify.telegram
    data:
      message: >-
        ⚠️ SEM Meter communication lost

        No valid SEM frame has been received for more than 10 seconds.

        Diagnostic status:
        {{ states('text_sensor.sem_meter_sem_diagnostic_status') }}
        Last valid frame age:
        {{ states('sensor.sem_meter_sem_last_valid_frame_age') }} seconds
        Wi-Fi signal: {{ states('sensor.sem_meter_wifi_signal') }}
        Time: {{ now().strftime('%Y-%m-%d %I:%M:%S %p') }}
```

### Parser communication restored

```yaml
alias: "SEM Meter - Parser Communication Restored"
description: "Send a Telegram notice when valid SEM frames resume."
mode: single
trigger:
  - platform: state
    entity_id: binary_sensor.sem_meter_sem_parser_healthy
    from: "off"
    to: "on"
condition:
  - condition: state
    entity_id: text_sensor.sem_meter_last_event
    state: "UART_RESTORED"
action:
  - service: notify.telegram
    data:
      message: >-
        ✅ SEM Meter communication restored

        Valid SEM frames are being received again.

        Outage duration:
        {{ states('sensor.sem_meter_sem_last_parser_outage_duration') }} seconds
        Diagnostic status:
        {{ states('text_sensor.sem_meter_sem_diagnostic_status') }}
        Time: {{ now().strftime('%Y-%m-%d %I:%M:%S %p') }}
```

The `Last Event` condition prevents an ordinary first valid frame after boot
from being reported as an outage recovery.

### Real Wi-Fi connection lost

A physically disconnected ESPHome device cannot publish its internal Wi-Fi
state. For a real remote outage, trigger from the standard `SEM Meter Online`
entity. Depending on Home Assistant integration behavior it can become `off`
or `unavailable`, so this automation handles either state and requires it to
persist for two minutes.

```yaml
alias: "Garage SEM Meter - WiFi Connection Lost"
description: "Alert when Home Assistant cannot reach the SEM Meter for two minutes."
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.sem_meter_sem_meter_online
    to: "off"
    for: "00:02:00"
  - trigger: state
    entity_id: binary_sensor.sem_meter_sem_meter_online
    to: "unavailable"
    for: "00:02:00"
actions:
  - action: telegram_bot.send_message
    data:
      config_entry_id: <telegram_config_entry_id>
      target: <chat_id>
      title: "⚠️ SEM Meter WiFi Connection Lost"
      message: >-
        Home Assistant can no longer reach the Garage SEM Meter.
        Parser and electrical values may be stale.
        If the meter is still operating, its local buzzer will sound after
        the firmware timeout.
        Time: {{ now().strftime('%Y-%m-%d %I:%M:%S %p') }}
```

### Real Wi-Fi connection restored

The five-second delay allows the reconnected firmware to publish its completed
outage duration before the message is rendered.

```yaml
alias: "Garage SEM Meter - WiFi Connection Restored"
description: "Report recovery after the SEM Meter returns online."
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.sem_meter_sem_meter_online
    to: "on"
actions:
  - delay: "00:00:05"
  - action: telegram_bot.send_message
    data:
      config_entry_id: <telegram_config_entry_id>
      target: <chat_id>
      title: "✅ SEM Meter WiFi Connection Restored"
      message: >-
        The Garage SEM Meter is reachable again.
        Outage duration:
        {{ states('sensor.sem_meter_sem_last_wifi_outage_duration')
           | float(0) | round(0) }} seconds.
        WiFi status:
        {{ states('text_sensor.sem_meter_sem_wifi_diagnostic_status')
           | replace('_', ' ') }}.
        Time: {{ now().strftime('%Y-%m-%d %I:%M:%S %p') }}
```

### Simulation-only Telegram test

Because simulation deliberately keeps the node online, use `SEM WiFi Healthy`
for optional end-to-end test messages. Do not use this sensor as the primary
real-outage trigger.

```yaml
alias: "Garage SEM Meter - Simulated WiFi Lost"
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.sem_meter_sem_wifi_healthy
    from: "on"
    to: "off"
actions:
  - action: telegram_bot.send_message
    data:
      config_entry_id: <telegram_config_entry_id>
      target: <chat_id>
      title: "TEST: SEM Meter WiFi Timeout"
      message: >-
        The safe WiFi-timeout simulation reached its 120-second threshold.
        The real WiFi/API connection and electrical measurements remain active.
```

```yaml
alias: "Garage SEM Meter - Simulated WiFi Restored"
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.sem_meter_sem_wifi_healthy
    from: "off"
    to: "on"
actions:
  - delay: "00:00:05"
  - action: telegram_bot.send_message
    data:
      config_entry_id: <telegram_config_entry_id>
      target: <chat_id>
      title: "TEST: SEM Meter WiFi Restored"
      message: >-
        The safe WiFi-timeout simulation recovered.
        Outage duration:
        {{ states('sensor.sem_meter_sem_last_wifi_outage_duration')
           | float(0) | round(0) }} seconds.
```

Telegram cannot be sent by the ESP32 during a real Wi-Fi loss. If Home
Assistant or the entire home internet connection is also down, the remote lost
message cannot be delivered until connectivity returns. The local GPIO41
buzzer still provides the on-site warning, and the recovery message can include
the firmware-recorded duration.

### Optional self-test result notification

This automation sends a message only after a user manually runs the self-test.
Use the actual generated entity IDs from your installation.

```yaml
alias: "Garage SEM Meter - Self-Test Result"
description: "Send the final result of a manually requested SEM self-test."
mode: single
triggers:
  - trigger: state
    entity_id: text_sensor.sem_meter_sem_self_test_status
    from: "RUNNING"
    to: "PASS"
  - trigger: state
    entity_id: text_sensor.sem_meter_sem_self_test_status
    from: "RUNNING"
    to: "FAIL"
actions:
  - action: telegram_bot.send_message
    data:
      config_entry_id: <telegram_config_entry_id>
      target: <chat_id>
      title: "🧪 SEM Meter Self-Test Result"
      message: >-
        Result:
        {{ states('text_sensor.sem_meter_sem_self_test_status') }}

        Summary:
        {{ states('text_sensor.sem_meter_sem_self_test_summary') }}

        Failed checks:
        {{ states('text_sensor.sem_meter_sem_self_test_failed_checks')
           | replace('_', ' ') }}

        Duration:
        {{ states('sensor.sem_meter_sem_last_self_test_duration')
           | float(0) | round(1) }} seconds

        Parser:
        {{ 'Healthy'
           if is_state('binary_sensor.sem_meter_sem_parser_healthy', 'on')
           else 'Unhealthy' }}

        WiFi:
        {{ 'Healthy'
           if is_state('binary_sensor.sem_meter_sem_wifi_healthy', 'on')
           else 'Unhealthy' }}

        Online:
        {{ states('binary_sensor.sem_meter_sem_meter_online') }}

        Time: {{ now().strftime('%m/%d/%Y %I:%M:%S %p') }}
```

The firmware never contacts Telegram. Home Assistant supplies the timestamp
and delivery. Replacing underscores avoids accidental Telegram Markdown
formatting. The test cannot independently verify home internet availability or
Telegram delivery.

## Home Assistant dashboard example

Replace entity IDs with those generated by your installation:

```yaml
type: entities
title: SEM Meter Diagnostics
entities:
  - button.sem_meter_run_sem_self_test
  - text_sensor.sem_meter_sem_self_test_status
  - text_sensor.sem_meter_sem_self_test_summary
  - text_sensor.sem_meter_sem_self_test_failed_checks
  - sensor.sem_meter_sem_last_self_test_duration
  - binary_sensor.sem_meter_sem_parser_healthy
  - binary_sensor.sem_meter_sem_wifi_healthy
  - binary_sensor.sem_meter_sem_meter_online
```

## Troubleshooting

- Enable the disabled `Buzzer Two Beeps` entity from Home Assistant's SEM Meter
  device page, then press it once to verify GPIO41, LEDC, RTTTL, and the passive
  buzzer.
- `SEM Parser Healthy` should be on and `SEM Diagnostic Status` should normally
  be `RECEIVING_DATA`.
- A steadily increasing last-valid-frame age means no new complete cycle is
  passing structural and electrical validation.
- `FRAME_TIMEOUT` means the parser watchdog has declared a communication
  outage. It does not necessarily mean Wi-Fi is unavailable.
- Last-good voltage and power values can remain visible during an outage. Use
  the parser-health entity to distinguish current data from stale data.
- Wi-Fi/API availability and SEM UART/parser health are separate conditions.
  A device can remain online while meter frames have stopped, or lose Wi-Fi
  while local UART parsing continues.
- For real Wi-Fi outage automation, use `SEM Meter Online`; for the safe
  simulation and post-reconnection diagnosis, use `SEM WiFi Healthy`.
- If two different alert patterns begin very close together, ESPHome's single
  RTTTL player may preempt the earlier sound. The watchdog events remain
  one-shot and parser/network state is unaffected.
- `NOT_RUN` is normal until the button is pressed.
- `RUNNING` should last about two seconds. If it remains stuck, inspect logs
  for component-loop or device stability problems.
- `PARSER` means no sufficiently recent accepted frame or an unhealthy parser
  watchdog.
- `WIFI` means real Wi-Fi is disconnected, the Wi-Fi watchdog is unhealthy,
  or Wi-Fi-timeout simulation is active.
- `API` means no native ESPHome API client was connected at evaluation time.
  Invoking the button from the local web server can therefore legitimately
  report `API`; a Home Assistant button press should normally pass it.
- `INTERNAL_STATE` indicates a conservative runtime-invariant contradiction.
  Capture logs before rebooting so the state can be investigated.

## Future diagnostic roadmap

Parser/Wi-Fi watchdogs, safe simulations, local sounds, and the manual self-test
are implemented. The following items are not implemented:

- Home Assistant API lost/restored events
- Abnormal voltage and frequency alerts
- Missing CT data detection
- Reboot/reset reason reporting
- Buzzer modes: Off, Critical Only, Normal, and Verbose
- Quiet hours
- Telegram escalation
- Persistent diagnostic counters across reboot
