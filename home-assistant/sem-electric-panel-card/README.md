# SEM Electric Panel Card

Experimental Version 1 Home Assistant Lovelace card for the SEM Meter. It
renders one main electrical service and up to the hardware maximum of 16
current-transformer clamps as a residential two-column breaker panel.

> Screenshot placeholder: add a verified Home Assistant screenshot after
> manual installation and visual testing.

The card is plain JavaScript. It has no npm, bundler, CDN, or external runtime
dependency and does not communicate with the ESPHome device directly.

## Hardware limit

SEM Meter hardware supports no more than 16 clamps. Clamp numbers outside
1–16 are ignored, and duplicate clamp numbers are discarded after the first
valid entry. A double-pole row is visual metadata for one clamp; it does not
consume or create another clamp.

## Installation

1. Create this directory in the Home Assistant configuration folder:

   ```text
   /config/www/sem-electric-panel-card/
   ```

2. Copy `sem-electric-panel-card.js` into that directory.
3. In Home Assistant, open **Settings → Dashboards → Resources**.
4. Add this resource:

   ```text
   /local/sem-electric-panel-card/sem-electric-panel-card.js
   ```

5. Select resource type **JavaScript Module**.
6. Reload the browser. If the card does not appear, perform a hard refresh or
   clear the Home Assistant frontend cache.

The Lovelace card type is:

```yaml
type: custom:sem-electric-panel-card
```

This Version 1 release is not packaged for HACS.

## Graphical editor

After registering the resource:

1. Edit a dashboard.
2. Select **Add card**.
3. Find **SEM Electric Panel** in the card picker.
4. In **SEM Meter Device**, select the Home Assistant device that owns the
   ESPHome SEM Meter entities.
5. Choose an import mode and select **Import SEM Meter Entities**, or configure
   the entities manually.
6. Configure the General and Main Breaker sections.
7. Expand any of the 16 fixed Clamp sections to review or edit its sensor.

Entity fields use Home Assistant's sensor entity selector. A clamp with an
empty entity does not render as an active breaker row. The editor always shows
exactly Clamp 1 through Clamp 16 because those numbers correspond to physical
SEM Meter inputs.

Configured clamp sections show a friendly heading such as **Clamp 7 — Pool
Pump**. Home Assistant's entity selector continues to show the underlying
entity, and the raw entity ID is retained as secondary editor information
where the frontend supports it.

The built-in Home Assistant form stores the clamps as fixed indexed entries.
The runtime also accepts the concise YAML list shown below and in
[`example-dashboard.yaml`](example-dashboard.yaml).

## Import entities from a SEM Meter device

Device import is optional and editor-only. The rendered card never queries the
entity registry. The importer asks Home Assistant for sensor entities that
belong to the selected `device_id`, then matches Main power, Main current, Line
1, Line 2, and Clamp 1 through Clamp 16 using registry and state metadata.

The importer recognizes common forms such as `Main Power`, `Total Power`,
`Line 1 Power`, `L1 Power`, `Clamp 7 Power`, `CT 7 Power`, `Channel 7 Power`,
and `Circuit 7 Power`. It also recognizes SEM Meter Phase A and Phase B power
as Line 1 and Line 2. Matching is case-insensitive and treats spaces,
underscores, and hyphens consistently.

Two modes are available:

- **Fill Empty Fields** fills only empty Main entity fields and clamps with no
  assigned entity. Existing entity assignments and all clamp metadata remain
  unchanged.
- **Replace Entity Assignments** replaces Main and Clamp entity assignments
  after an explicit inline confirmation. Existing custom names, circuit
  labels, icons, units, and pole counts are preserved.

When the importer creates a missing clamp entry, it uses safe defaults and a
friendly display name derived from the entity. A trailing `Power` and a
recognizable SEM Meter device prefix are removed only for the card's display
name; the Home Assistant entity itself is never renamed.

After each attempt, the editor displays an inline summary of imported,
not-found, ambiguous, and preserved assignments. Equally ranked candidates
are reported as ambiguous and are not assigned automatically. If the registry
request fails, the existing configuration remains unchanged.

Manual entity selection remains fully supported. It is also the fallback for
older Home Assistant versions that do not provide the expected registry API.

## YAML example

```yaml
type: custom:sem-electric-panel-card
title: Electrical Panel
# Optional; normally selected through the graphical editor:
# device_id: replace_with_home_assistant_device_id

main:
  name: Main Breaker
  power_entity: sensor.example_total_power
  current_entity: sensor.example_total_current
  line_1_entity: sensor.example_line_1_power
  line_2_entity: sensor.example_line_2_power

clamps:
  - clamp: 1
    entity: sensor.example_clamp_1_power
    name: Kitchen
    circuit: "1"
    icon: mdi:countertop
    unit: W
    poles: 1

  - clamp: 2
    entity: sensor.example_clamp_2_power
    name: Pool Pump
    circuit: "2-4"
    icon: mdi:pool
    unit: W
    poles: 2
```

## Configuration reference

### Card

| Field | Purpose | Default |
| --- | --- | --- |
| `title` | Card heading | `Electrical Panel` |
| `device_id` | Optional Home Assistant device used by editor import | Empty |
| `main` | Main Breaker configuration | Empty main section |
| `clamps` | List or indexed collection of clamp configurations | Empty |

### Main Breaker

| Field | Purpose |
| --- | --- |
| `name` | Main-section display name |
| `power_entity` | Total power; primary more-info target |
| `current_entity` | Total current; fallback more-info target |
| `line_1_entity` | Line 1 power and balance input |
| `line_2_entity` | Line 2 power and balance input |

When both line power entities are numeric, the card calculates line imbalance:

- below 15%: **Balanced**
- 15% through 30%: **Slightly Unbalanced**
- above 30%: **Unbalanced**

If either input is missing or nonnumeric, the card displays **Balance
unavailable**.

### Clamp

| Field | Values | Purpose |
| --- | --- | --- |
| `clamp` | Integer 1–16 | Physical SEM Meter clamp number and panel position |
| `entity` | Home Assistant entity ID | Measurement displayed by the row |
| `name` | Text | Optional display name |
| `circuit` | Text | Breaker number or circuit label |
| `icon` | `mdi:` icon | Optional icon override |
| `unit` | `auto`, `W`, `kW`, `A` | Display and supported W/kW conversion |
| `poles` | `1` or `2` | Visual single-pole or double-pole presentation |

If `name` is empty, the card uses `hass.formatEntityName` when available,
followed by the entity's `friendly_name`, then a readable entity-ID fallback.

Odd clamp numbers occupy the left breaker column and even numbers occupy the
right. Double-pole rows are slightly taller and include a linked-breaker
indicator and accessibility label. They still represent exactly one physical
clamp.

## Units

- `auto` uses the entity's `unit_of_measurement`.
- `W` converts source kilowatts to watts.
- `kW` converts source watts to kilowatts and displays two decimals.
- `A` displays two decimals and does not infer current from power.

Missing, removed, `unknown`, or `unavailable` entities safely display
**Unavailable**. A different nonnumeric state is displayed as text without
causing a card error.

## Interaction and accessibility

Select the Main Breaker to open more-info for `power_entity`, or
`current_entity` when total power is not configured. Select a configured clamp
to open more-info for that measurement. The card dispatches Home Assistant's
standard `hass-more-info` event and never toggles an entity or calls a service.

Interactive sections are keyboard focusable. Enter and Space open more-info.
Double-pole rows include a 2-pole tooltip and accessible label.

## Troubleshooting

### Card does not appear

- Confirm the file is at
  `/config/www/sem-electric-panel-card/sem-electric-panel-card.js`.
- Confirm the resource URL begins with `/local/`, not `/config/www/`.
- Confirm the resource type is **JavaScript Module**.
- Hard-refresh the browser, clear the Home Assistant frontend cache, or open a
  private browser window.
- Check the browser console for a resource-loading error.

### Entity shows Unavailable

- Confirm the entity ID exists in **Developer Tools → States**.
- Confirm the selected entity is available.
- Reopen the graphical editor if an entity was renamed or removed.
- Ensure the dashboard user can access the entity.

### Device import does not detect an entity

- Confirm the selected Home Assistant device is the device that owns the
  sensor entity in **Settings → Devices & services → Devices**.
- Confirm the entity is in the `sensor` domain.
- Check the inline **Not found** and **Ambiguous** results. Ambiguous roles
  must be assigned manually.
- Enabled and currently available candidates are preferred over disabled or
  unavailable candidates.
- Entity names must identify a supported Main, Line, Clamp, CT, Channel, or
  Circuit role. Custom names that remove all clamp-number metadata may require
  manual selection.
- If the editor reports registry incompatibility or a request failure, use the
  existing manual entity selectors. No current assignments are changed by a
  failed request.

## Version 1 limitations

Version 1 is experimental and requires manual Home Assistant testing. It does
not provide HACS packaging, automatic SEM Meter discovery, energy history,
breaker control, service calls, warning thresholds, custom colors, diagnostics
dashboards, Telegram, MQTT-specific behavior, or support for more than 16
clamps. The editor and rendered panel remain intentionally limited to exactly
16 physical clamp positions. Device import is metadata-based and may require
manual correction when integrations or user-renamed entities do not retain
recognizable role names.
