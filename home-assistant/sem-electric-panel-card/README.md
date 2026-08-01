# Home Assistant Electric Panel Card

The Home Assistant Electric Panel Card now has its own dedicated repository:

**https://github.com/quky/ha-electric-panel-card**

<p align="center">
  <img
    src="images/sem-electric-panel-card.png"
    alt="Home Assistant Electric Panel Card showing main, single-pole, two-pole, tandem, monitored, unmonitored, and empty positions in a 24-position electrical panel"
    width="520"
  >
</p>

The standalone repository is now the official location for:

- HACS installation
- GitHub releases
- Current documentation
- Example dashboard configurations
- Card tests and validation
- Bug reports and feature requests
- Support for SEM Meter, Emporia ESPHome, and other Home Assistant entities

This directory remains the SEM Meter development copy of the card and contains the SEM-specific integration details used by the firmware project.

## Recommended installation through HACS

Install the card through HACS as a custom Dashboard repository.

1. Open **HACS**.
2. Open the three-dot menu.
3. Select **Custom repositories**.
4. Add:

   ```text
   https://github.com/quky/ha-electric-panel-card
   ```

5. Select the **Dashboard** category.
6. Install **Home Assistant Electric Panel Card**.
7. Refresh the browser or reload Home Assistant frontend resources if requested.

Use this card type for new dashboards:

```yaml
type: custom:ha-electric-panel-card
```

Existing dashboards using the original card type remain supported:

```yaml
type: custom:sem-electric-panel-card
```

Both card types use the same implementation and graphical editor.

For complete installation instructions, manual installation, current examples, and configuration documentation, visit:

**https://github.com/quky/ha-electric-panel-card**

## Overview

The Home Assistant Electric Panel Card models a residential electrical load center using Home Assistant entities.

It supports:

- Configurable panel sizes from 8 through 42 physical positions
- Single-pole breakers
- Same-side two-pole breakers
- Tandem, duplex, twin, or piggyback breakers
- Monitored and unmonitored breakers
- Breaker ratings
- Empty filler positions
- A two-pole main breaker
- Configurable numbering styles
- Measurement and energy decimal precision
- Friendly-name cleanup and two-line labels
- A graphical editor
- Device-aware grouped entity selectors
- Manual assignment from compatible Home Assistant entities
- SEM Meter automatic entity import

The card does not communicate directly with the ESPHome device. It displays entities already available in Home Assistant.

## Hardware-independent manual configuration

Manual entity assignment is not limited to the SEM Meter.

Compatible Home Assistant power, current, or energy entities may be assigned from:

- SEM Meter
- Emporia Vue running ESPHome
- IoTaWatt
- CircuitSetup
- Shelly energy monitors
- Template sensors
- Other compatible Home Assistant integrations

Automatic import is currently optimized for the SEM Meter. Other hardware can be configured manually through the graphical editor.

## SEM Meter hardware limit

The SEM Meter hardware supports a maximum of exactly 16 current-transformer clamps.

Clamp numbers outside 1 through 16 are ignored. Duplicate clamp numbers are discarded after the first valid entry.

The selected electrical panel size is independent of the clamp count.

For example:

- The SEM Meter may provide 16 measurement channels.
- The card may represent a 24-, 30-, 40-, or 42-position electrical panel.
- Physical positions without a measurement entity may still be displayed as unmonitored breakers.

A SEM clamp is a measurement channel. It is not necessarily the same as the physical breaker position.

For example:

```text
SEM Clamp 4
→ Physical Circuit 13
```

This separation allows the visual panel to match the actual electrical load center.

## SEM Meter automatic import

The graphical editor can automatically detect and import entities from a compatible SEM Meter device.

The importer supports:

- Main power
- Main current when available
- Line 1 or Phase A power
- Line 2 or Phase B power
- Clamp 1 through Clamp 16
- Existing renamed Home Assistant entity IDs
- Fill Empty Fields mode
- Replace Entity Assignments mode
- Ambiguous and invalid mapping protection

Automatic import never changes the physical panel topology automatically.

It does not guess:

- Panel size
- Breaker position
- Single-pole versus two-pole layout
- Tandem breaker layout
- Breaker ratings
- Manual physical-position entries

Those settings remain under user control.

## Stable SEM clamp source mappings

Current SEM Meter firmware exposes diagnostic mapping entities named:

```text
SEM Clamp 1 Source
SEM Clamp 2 Source
...
SEM Clamp 16 Source
```

Each mapping entity contains the native ESPHome name of the corresponding power sensor.

Example:

```text
SEM Clamp 1 Source
State: laundry Power
```

The card uses these mapping entities to identify the physical SEM measurement channel even when Home Assistant has renamed the entity ID.

The importer resolves the target primarily through the Home Assistant entity registry `original_name`.

This means an entity may be renamed in Home Assistant without breaking the clamp mapping.

## Import matching priority

Clamp matching uses the following priority:

1. Explicit `SEM Clamp N Source` mapping metadata
2. Stable `clamp_N`, `clamp-N`, or `clamp N` tokens
3. Legacy `Clamp N`, `CT N`, `Channel N`, or `Circuit N` naming

Firmware without the newer mapping entities remains compatible through the fallback methods.

The importer validates that a mapped target:

- Belongs to the selected device
- Is a sensor
- Represents a compatible power measurement
- Is not a mapping or diagnostic entity
- Is not a daily-energy sensor
- Is not a main, phase, or balance measurement
- Resolves uniquely

Ambiguous targets are not assigned automatically.

## Import modes

### Fill Empty Fields

Fills only empty Main and Clamp entity fields.

Existing assignments and custom display settings remain unchanged.

### Replace Entity Assignments

Replaces detected Main and Clamp entity assignments after explicit confirmation.

The following are preserved:

- Custom names
- Circuit labels
- Physical positions
- Icons
- Units
- Breaker types
- Breaker ratings
- Tandem configuration

If no unique replacement is found, the existing assignment remains unchanged.

## Device-aware selectors

When a SEM Meter device is selected, entity selectors default to compatible entities belonging to that device.

Choices are grouped as:

- Main
- Circuits
- Other compatible entities

The editor excludes inappropriate choices such as:

- `SEM Clamp N Source` mapping sensors
- Diagnostic entities
- Configuration entities
- Enable switches
- Multiplier switches
- Daily-energy sensors in power fields
- Incompatible measurement types

Enable **Show all Home Assistant entities** when a breaker measurement comes from another device or integration.

Existing configured entities remain visible even when they fall outside the current filter.

## Physical panel positions

Physical panel positions are separate from SEM clamps.

The card supports an optional `panel_positions` collection for manually configuring any physical position from 1 through 42.

A physical position may contain:

- A monitored single-pole breaker
- An unmonitored single-pole breaker
- A monitored or unmonitored two-pole breaker
- A tandem breaker with two independent entities
- A tandem breaker with one or both halves unmonitored
- An empty filler position

Auto Import never creates or modifies manual `panel_positions` entries.

Rendering priority is:

1. Explicit `panel_positions` entry
2. Clamp assigned through `circuit_position`
3. Backward-compatible Clamp N to Position N fallback
4. Empty filler position

If an explicit position and an active clamp assignment target the same location, the explicit position is rendered and both configurations are preserved.

## Two-pole breakers

A branch two-pole breaker occupies two vertically adjacent positions on the same panel side.

The paired physical position is:

```text
Starting position + 2
```

Examples:

```text
1 pairs with 3
2 pairs with 4
9 pairs with 11
10 pairs with 12
13 pairs with 15
14 pairs with 16
```

For a 24-position panel:

```text
16 pairs with 18
19 pairs with 21
22 pairs with 24
```

The two poles are rendered as one linked breaker with:

- Two breaker bodies
- Two linked handles
- One name
- One rating
- One value when monitored
- One click target when an entity exists

A two-pole breaker may also be displayed without an entity as an unmonitored breaker.

## Tandem breakers

A tandem breaker is also known as a:

- Duplex breaker
- Twin breaker
- Piggyback breaker

It contains two independent 120-volt circuits in one physical panel position.

Each half may have its own:

- Entity
- Name
- Icon
- Unit
- Breaker rating
- State
- Click target

Tandem headings use A and B suffixes.

Example:

```text
CIRCUIT 7A
CIRCUIT 7B
```

A tandem does not consume the next same-side panel position.

The card is a visualization tool. It does not determine whether a real electrical panel is listed or designed to accept tandem breakers. Follow the panel manufacturer’s labeling, applicable electrical codes, and qualified-electrician guidance.

## Monitored and unmonitored breakers

An entity is optional for manual physical-panel positions.

A monitored breaker may display:

```text
Garage Lights
148 W
15 A
```

An unmonitored breaker may display:

```text
Garage Lights
Not monitored
15 A
```

An unmonitored breaker does not display a fake zero, unavailable state, or unknown value.

Breakers without entities are not clickable measurement targets.

This allows the card to represent the complete electrical panel even when only 16 circuits are monitored by the SEM Meter.

## Graphical editor workflow

After installing the card:

1. Edit a Home Assistant dashboard.
2. Select **Add card**.
3. Choose **Home Assistant Electric Panel Card**.
4. Select the SEM Meter device when using automatic import.
5. Choose **Fill Empty Fields** or **Replace Entity Assignments**.
6. Select **Import SEM Meter Entities**.
7. Configure the main breaker.
8. Review Clamp 1 through Clamp 16.
9. Assign physical circuit positions as needed.
10. Open **Physical Panel Positions**.
11. Choose the position to edit.
12. Configure breaker type, name, rating, entity, or tandem fields.
13. Adjust panel size and display settings.

The Physical Panel Positions editor shows one selected position at a time so panels with up to 42 positions remain manageable.

## Example

```yaml
type: custom:ha-electric-panel-card
title: Electrical Panel
panel_size: 24
show_empty_positions: true
numbering_style: circuit
measurement_decimals: 1
energy_decimals: 2

main:
  name: Main Breaker
  main_breaker_rating: 200 A
  power_entity: sensor.example_total_power
  line_1_entity: sensor.example_line_1_power
  line_2_entity: sensor.example_line_2_power

clamps:
  - clamp: 1
    entity: sensor.example_kitchen_power
    name: Kitchen
    circuit_position: 1
    breaker_type: single
    breaker_rating: 20
    unit: W

  - clamp: 4
    entity: sensor.example_air_conditioner_power
    name: A/C
    circuit_position: 13
    breaker_type: double
    breaker_rating: 30
    unit: W

panel_positions:
  - position: 17
    name: Garage Lights
    breaker_type: single
    breaker_rating: 15

  - position: 19
    name: Water Heater
    breaker_type: double
    breaker_rating: 30

  - position: 23
    name: Workshop Upper
    breaker_type: tandem
    breaker_rating: 15
    tandem_name: Workshop Lower
    tandem_breaker_rating: 20
```

The example intentionally includes breakers without entities to demonstrate unmonitored physical positions.

For the complete configuration reference and current example file, visit:

**https://github.com/quky/ha-electric-panel-card**

## Development and testing

This directory remains the SEM Meter development/source copy of the card.

The card test harness may be run from the `sem-meter-esphome` repository root:

```powershell
node .\home-assistant\sem-electric-panel-card\sem-electric-panel-card.test.js
```

The test suite covers:

- SEM clamp mappings
- Automatic import
- Renamed Home Assistant entities
- Device-aware selectors
- Fill and Replace behavior
- Panel sizes
- Physical positions
- Single-pole breakers
- Two-pole breakers
- Tandem breakers
- Monitored and unmonitored breakers
- Loading behavior
- Text-entry behavior
- Number formatting
- Accessibility
- Legacy card compatibility

The standalone HACS distributable and current public releases are maintained at:

**https://github.com/quky/ha-electric-panel-card**

## Project separation

The two repositories now have separate responsibilities.

### SEM Meter firmware and integration

**https://github.com/quky/sem-meter-esphome**

Contains:

- ESPHome firmware
- UART parser
- SEM Meter custom component
- Diagnostics
- Stable clamp-source mapping entities
- Hardware-specific tests and documentation

### Home Assistant Electric Panel Card

**https://github.com/quky/ha-electric-panel-card**

Contains:

- HACS installation
- Card releases
- Standalone JavaScript
- Graphical editor
- Card tests
- General hardware-independent documentation
- Issues and feature requests

For installation, releases, support, current examples, and card-specific documentation, use the standalone card repository.
