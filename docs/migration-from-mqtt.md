# Migrating From MQTT Entity IDs

If you previously used the stock or MQTT-based firmware, your Home Assistant
dashboards and automations may reference old MQTT entity IDs. You can keep those
dashboards mostly intact by renaming the ESPHome entities after adopting this
firmware.

## Recommended Process

1. Add the ESPHome device to Home Assistant and let all entities appear.
2. Open **Settings** > **Devices & services** > **Entities**.
3. Search for `SEM Meter`.
4. For each ESPHome entity, open the entity settings.
5. Rename the entity ID to match the old MQTT entity ID used by your dashboards
   and automations.
6. Keep a small mapping note until everything has been checked.

## Example Mapping

If an old dashboard card used:

```yaml
entity: sensor.sem_meter_pool_pump_power
```

Rename the new ESPHome pool pump power entity to:

```text
sensor.sem_meter_pool_pump_power
```

Home Assistant will preserve the friendly name separately from the entity ID, so
you can keep readable names while matching old automation references.

## Tips

- Rename entities in Home Assistant instead of editing generated registry files.
- Check automations, scripts, dashboards, helpers, and energy dashboard inputs.
- The per-circuit enabled and 240 V multiplier switches are new ESPHome control
  entities; old MQTT firmware may not have direct equivalents.
