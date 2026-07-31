"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.HTMLElement = class {};
const registeredElements = new Map();
global.customElements = {
  get: (name) => registeredElements.get(name),
  define: (name, constructor) => registeredElements.set(name, constructor),
};
global.window = { customCards: [] };

require(path.join(__dirname, "sem-electric-panel-card.js"));

const Card = registeredElements.get("sem-electric-panel-card");
const Editor = registeredElements.get("sem-electric-panel-card-editor");
assert.ok(Card, "card class was not registered");
assert.ok(Editor, "card editor class was not registered");

const DEVICE_ID = "sem-device";
const REAL_SOURCE_NAMES = [
  "laundry Power",
  "kitchen cooking Power",
  "master bedroom Power",
  "surge protector Power",
  "generator plug Power",
  "microwave Power",
  "air handler Power",
  "circuit 8 Power",
  "circuit 9 Power",
  "pool pump Power",
  "master bedroom light Power",
  "lights Ely mami bathroom Power",
  "A⁄C Power",
  "lights garage laundry kitchen Power",
  "receptacle below panel Power",
  "TP Link power strip Power",
];

function registryEntry(entityId, originalName, extra = {}) {
  return {
    entity_id: entityId,
    device_id: DEVICE_ID,
    original_name: originalName,
    unique_id: `aabbccddeeff/0/sensor/${originalName || entityId}`,
    disabled_by: null,
    ...extra,
  };
}

function stateObject(state, friendlyName, attributes = {}) {
  return {
    state,
    attributes: {
      friendly_name: friendlyName,
      ...attributes,
    },
  };
}

function addPowerSensor(entries, states, clamp, originalName, entityId) {
  entries.push(
    registryEntry(entityId, originalName, {
      original_device_class: "power",
    })
  );
  states[entityId] = stateObject("123.4", originalName, {
    device_class: "power",
    unit_of_measurement: "W",
  });
}

function addMappingSensor(
  entries,
  states,
  clamp,
  sourceState,
  overrides = {}
) {
  const entityId =
    overrides.entity_id ||
    `sensor.garage_sem_meter_sem_clamp_${clamp}_source`;
  entries.push(
    registryEntry(
      entityId,
      overrides.original_name === undefined
        ? `SEM Clamp ${clamp} Source`
        : overrides.original_name,
      {
        unique_id:
          overrides.unique_id ||
          `aabbccddeeff/0/text_sensor/SEM Clamp ${clamp} Source`,
      }
    )
  );
  states[entityId] = stateObject(
    sourceState,
    overrides.friendly_name || `Garage SEM Meter SEM Clamp ${clamp} Source`
  );
  return entityId;
}

function emptyConfig() {
  return {
    type: "custom:sem-electric-panel-card",
    title: "Electrical Panel",
    device_id: DEVICE_ID,
    main: {
      name: "Main Breaker",
      power_entity: "",
      current_entity: "",
      line_1_entity: "",
      line_2_entity: "",
    },
    clamps: [],
  };
}

function labelsInSummary(summary) {
  return {
    imported: new Set(summary.imported),
    preserved: new Set(summary.preserved),
    notFound: new Set(summary.notFound),
    ambiguous: new Set(summary.ambiguous.map((item) => item.label)),
    invalid: new Set(
      summary.invalidMappings.map((item) => item.split(":")[0])
    ),
  };
}

function run(name, test) {
  test();
  console.log(`[PASS] ${name}`);
}

run("all 16 explicit mappings resolve renamed target entity IDs", () => {
  const entries = [];
  const states = {};
  for (let clamp = 1; clamp <= 16; clamp += 1) {
    addMappingSensor(entries, states, clamp, REAL_SOURCE_NAMES[clamp - 1]);
    addPowerSensor(
      entries,
      states,
      clamp,
      REAL_SOURCE_NAMES[clamp - 1],
      `sensor.user_renamed_power_${clamp}`
    );
  }
  entries.reverse();

  const matches = Card._matchDeviceEntities(
    entries,
    { states },
    DEVICE_ID
  );
  for (let clamp = 1; clamp <= 16; clamp += 1) {
    assert.equal(
      matches[`clamp_${clamp}`].match.entity_id,
      `sensor.user_renamed_power_${clamp}`
    );
    assert.deepEqual(matches[`clamp_${clamp}`].ambiguous, []);
  }
});

run("mapping source detection accepts prefixed entity IDs", () => {
  const entries = [];
  const states = {};
  const mappingId = addMappingSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0]
  );
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.renamed_laundry"
  );
  assert.equal(
    mappingId,
    "sensor.garage_sem_meter_sem_clamp_1_source"
  );
  assert.equal(
    Card._matchDeviceEntities(entries, { states }, DEVICE_ID).clamp_1.match
      .entity_id,
    "sensor.renamed_laundry"
  );
});

run("unique ID and friendly-name mapping fallbacks are supported", () => {
  const entries = [];
  const states = {};
  addMappingSensor(entries, states, 1, REAL_SOURCE_NAMES[0], {
    original_name: "",
    entity_id: "sensor.unrelated_mapping_entity",
    unique_id: "device_sem_clamp_1_source",
  });
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.renamed_laundry"
  );
  assert.equal(
    Card._matchDeviceEntities(entries, { states }, DEVICE_ID).clamp_1.match
      .entity_id,
    "sensor.renamed_laundry"
  );

  const friendlyEntries = [];
  const friendlyStates = {};
  addMappingSensor(
    friendlyEntries,
    friendlyStates,
    1,
    REAL_SOURCE_NAMES[0],
    {
      original_name: "",
      entity_id: "sensor.unrelated_friendly_mapping",
      unique_id: "unrelated",
      friendly_name: "Garage SEM Meter SEM Clamp 1 Source",
    }
  );
  addPowerSensor(
    friendlyEntries,
    friendlyStates,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.friendly_laundry"
  );
  assert.equal(
    Card._matchDeviceEntities(
      friendlyEntries,
      { states: friendlyStates },
      DEVICE_ID
    ).clamp_1.match.entity_id,
    "sensor.friendly_laundry"
  );
});

run("missing mapping safely falls through without inventing a match", () => {
  const entries = [];
  const states = {};
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.laundry_without_mapping"
  );
  const result = Card._matchDeviceEntities(entries, { states }, DEVICE_ID)
    .clamp_1;
  assert.equal(result.match, null);
  assert.deepEqual(result.ambiguous, []);
  assert.equal(result.invalidMapping, "");
});

run("unavailable mapping state is ignored safely and reported", () => {
  const entries = [];
  const states = {};
  addMappingSensor(entries, states, 1, "unavailable");
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.laundry"
  );
  const result = Card._matchDeviceEntities(entries, { states }, DEVICE_ID)
    .clamp_1;
  assert.equal(result.match, null);
  assert.match(result.invalidMapping, /unavailable/);
});

run("mapping with no matching power sensor is invalid", () => {
  const entries = [];
  const states = {};
  addMappingSensor(entries, states, 1, "not installed Power");
  const result = Card._matchDeviceEntities(entries, { states }, DEVICE_ID)
    .clamp_1;
  assert.equal(result.match, null);
  assert.match(result.invalidMapping, /no power sensor named/);
});

run("target fallback is used only when original_name is absent", () => {
  const entries = [];
  const states = {};
  addMappingSensor(entries, states, 1, REAL_SOURCE_NAMES[0]);
  entries.push(
    registryEntry("sensor.renamed_laundry_power", "", {
      original_device_class: "power",
    })
  );
  states["sensor.renamed_laundry_power"] = stateObject(
    "12.3",
    "Garage SEM Meter laundry Power",
    {
      device_class: "power",
      unit_of_measurement: "W",
    }
  );
  assert.equal(
    Card._matchDeviceEntities(entries, { states }, DEVICE_ID).clamp_1.match
      .entity_id,
    "sensor.renamed_laundry_power"
  );

  entries[1].original_name = "Different Power";
  assert.equal(
    Card._matchDeviceEntities(entries, { states }, DEVICE_ID).clamp_1.match,
    null
  );
});

run("malformed and overly long mapping states are rejected safely", () => {
  for (const invalidState of ["laundry", `x${"a".repeat(255)} Power`]) {
    const entries = [];
    const states = {};
    addMappingSensor(entries, states, 1, invalidState);
    const result = Card._matchDeviceEntities(entries, { states }, DEVICE_ID)
      .clamp_1;
    assert.equal(result.match, null);
    assert.ok(result.invalidMapping);
  }
});

run("duplicate authoritative original names are ambiguous", () => {
  const entries = [];
  const states = {};
  addMappingSensor(entries, states, 1, REAL_SOURCE_NAMES[0]);
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.laundry_a"
  );
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.laundry_b"
  );
  const result = Card._matchDeviceEntities(entries, { states }, DEVICE_ID)
    .clamp_1;
  assert.equal(result.match, null);
  assert.deepEqual(result.ambiguous, [
    "sensor.laundry_a",
    "sensor.laundry_b",
  ]);
});

run("mapping source sensors are never power targets", () => {
  const entries = [];
  const states = {};
  const mappingId = addMappingSensor(
    entries,
    states,
    1,
    "SEM Clamp 1 Source Power"
  );
  const mappingEntry = entries.find(
    (entry) => entry.entity_id === mappingId
  );
  states[mappingId].attributes.device_class = "power";
  states[mappingId].attributes.unit_of_measurement = "W";
  assert.equal(Card._isClampPowerTarget(mappingEntry, { states }), false);
  assert.equal(
    Card._matchDeviceEntities(entries, { states }, DEVICE_ID).clamp_1.match,
    null
  );
});

run("firmware without mapping metadata retains Circuit 8 and 9 fallback", () => {
  const entries = [];
  const states = {};
  addPowerSensor(
    entries,
    states,
    8,
    "circuit 8 Power",
    "sensor.circuit_8_power"
  );
  addPowerSensor(
    entries,
    states,
    9,
    "circuit 9 Power",
    "sensor.circuit_9_power"
  );
  const matches = Card._matchDeviceEntities(
    entries,
    { states },
    DEVICE_ID
  );
  assert.equal(matches.clamp_8.match.entity_id, "sensor.circuit_8_power");
  assert.equal(matches.clamp_9.match.entity_id, "sensor.circuit_9_power");
});

run("stable clamp_1 token fallback precedes legacy matching", () => {
  const entries = [];
  const states = {};
  addPowerSensor(
    entries,
    states,
    1,
    "Laundry clamp_1 load",
    "sensor.user_named_laundry"
  );
  const result = Card._matchDeviceEntities(entries, { states }, DEVICE_ID)
    .clamp_1;
  assert.equal(result.match.entity_id, "sensor.user_named_laundry");
});

run("Fill mode preserves existing clamp assignments exclusively", () => {
  const entries = [];
  const states = {};
  addMappingSensor(entries, states, 1, REAL_SOURCE_NAMES[0]);
  addPowerSensor(
    entries,
    states,
    1,
    REAL_SOURCE_NAMES[0],
    "sensor.new_laundry"
  );
  const matches = Card._matchDeviceEntities(
    entries,
    { states },
    DEVICE_ID
  );
  const config = emptyConfig();
  config.clamps.push({
    clamp: 1,
    entity: "sensor.existing_laundry",
    name: "Laundry",
    circuit: "1",
    icon: "",
    unit: "auto",
    poles: 1,
  });
  const result = Card._applyEntityImport(config, matches, "fill", {
    states,
  });
  assert.equal(result.config.clamps[0].entity, "sensor.existing_laundry");
  assert.ok(result.summary.preserved.includes("Clamp 1"));
  assert.ok(!result.summary.imported.includes("Clamp 1"));
  assert.ok(!result.summary.notFound.includes("Clamp 1"));
});

run("Replace mode changes only uniquely matched assignments", () => {
  const config = emptyConfig();
  config.clamps.push({
    clamp: 1,
    entity: "sensor.existing_laundry",
    name: "Laundry",
    circuit: "1",
    icon: "mdi:washing-machine",
    unit: "W",
    poles: 1,
  });

  const invalidMatches = {
    clamp_1: {
      match: null,
      ambiguous: [],
      invalidMapping: "mapping state is unavailable",
    },
  };
  const preserved = Card._applyEntityImport(
    config,
    invalidMatches,
    "replace",
    { states: {} }
  );
  assert.equal(
    preserved.config.clamps[0].entity,
    "sensor.existing_laundry"
  );
  assert.equal(preserved.config.clamps[0].icon, "mdi:washing-machine");
  assert.ok(
    preserved.summary.invalidMappings.some((item) =>
      item.startsWith("Clamp 1:")
    )
  );

  const validMatches = {
    clamp_1: {
      match: { entity_id: "sensor.new_laundry" },
      ambiguous: [],
      invalidMapping: "",
    },
  };
  const replaced = Card._applyEntityImport(
    config,
    validMatches,
    "replace",
    {
      states: {
        "sensor.new_laundry": stateObject("10", "Laundry Power"),
      },
    }
  );
  assert.equal(replaced.config.clamps[0].entity, "sensor.new_laundry");
  assert.equal(replaced.config.clamps[0].icon, "mdi:washing-machine");
  assert.ok(replaced.summary.imported.includes("Clamp 1"));
});

run("each role appears in only one final report category", () => {
  const config = emptyConfig();
  config.clamps.push({
    clamp: 1,
    entity: "sensor.existing",
    name: "",
    circuit: "",
    icon: "",
    unit: "auto",
    poles: 1,
  });
  const result = Card._applyEntityImport(config, {}, "fill", {
    states: {},
  });
  const categories = labelsInSummary(result.summary);
  const allLabels = [
    ...categories.imported,
    ...categories.preserved,
    ...categories.notFound,
    ...categories.ambiguous,
    ...categories.invalid,
  ];
  assert.equal(allLabels.length, new Set(allLabels).size);
  assert.ok(categories.preserved.has("Clamp 1"));
  assert.ok(!categories.notFound.has("Clamp 1"));
  assert.ok(
    !result.summary.notFound.some((label) => label.startsWith("Clamp "))
  );
});

function selectorFixture() {
  const secondDevice = "second-sem-device";
  const solarDevice = "solar-device";
  const devices = [
    { id: DEVICE_ID, name: "Garage SEM Meter" },
    { id: secondDevice, name: "Workshop SEM Meter" },
    { id: solarDevice, name: "Solar Site" },
  ];
  const entries = [];
  const states = {};
  const add = (entityId, originalName, deviceId, deviceClass, unit, extra = {}) => {
    entries.push(
      registryEntry(entityId, originalName, {
        device_id: deviceId,
        original_device_class: deviceClass,
        ...extra,
      })
    );
    states[entityId] = stateObject("1", originalName, {
      device_class: deviceClass,
      unit_of_measurement: unit,
    });
  };

  add("sensor.garage_main_power", "Main Power", DEVICE_ID, "power", "W");
  add("sensor.garage_main_current", "Main Current", DEVICE_ID, "current", "A");
  add("sensor.garage_phase_a_power", "Phase A Power", DEVICE_ID, "power", "W");
  add("sensor.garage_circuit_10_power", "Circuit 10 Power", DEVICE_ID, "power", "W");
  add("sensor.garage_circuit_2_power", "Circuit 2 Power", DEVICE_ID, "power", "W");
  add("sensor.garage_auxiliary_power", "Auxiliary Power", DEVICE_ID, "power", "W");
  add("sensor.garage_mystery_power", "Mystery Power", DEVICE_ID, "power", "W");
  add("sensor.garage_daily_energy", "Daily Energy", DEVICE_ID, "energy", "kWh");
  add(
    "sensor.garage_parser_frames",
    "SEM Frames Processed",
    DEVICE_ID,
    "power",
    "W",
    { entity_category: "diagnostic" }
  );
  entries.push(
    registryEntry("switch.garage_circuit_1_enable", "Circuit 1 Enable"),
    registryEntry("switch.garage_circuit_1_multiplier", "Circuit 1 Multiplier")
  );
  states["switch.garage_circuit_1_enable"] = stateObject("on", "Circuit 1 Enable");
  states["switch.garage_circuit_1_multiplier"] = stateObject("off", "Circuit 1 Multiplier");

  addMappingSensor(entries, states, 1, "laundry Power");
  add("sensor.renamed_laundry", "laundry Power", DEVICE_ID, "power", "W");
  add("sensor.workshop_main_power", "Main Power", secondDevice, "power", "W");
  add("sensor.workshop_main_current", "Main Current", secondDevice, "current", "A");
  add("sensor.solar_inverter_power", "Inverter Power", solarDevice, "power", "W");
  add("sensor.solar_energy", "Solar Energy", solarDevice, "energy", "kWh");
  return { devices, entries, hass: { states }, secondDevice, solarDevice };
}

function choiceGroups(fixture, showAll, field, configured = "") {
  return Card._buildEntityChoiceGroups(
    fixture.entries,
    fixture.devices,
    fixture.hass,
    DEVICE_ID,
    showAll,
    field,
    configured
  );
}

function choiceValues(groups) {
  return groups.flatMap((group) => group.options.map((option) => option.value));
}

run("device-aware power choices hide other devices by default", () => {
  const fixture = selectorFixture();
  const groups = choiceGroups(fixture, false, "power_entity");
  const values = choiceValues(groups);
  assert.ok(values.includes("sensor.garage_main_power"));
  assert.ok(values.includes("sensor.renamed_laundry"));
  assert.ok(!values.includes("sensor.workshop_main_power"));
  assert.ok(!values.includes("sensor.solar_inverter_power"));
  assert.ok(!values.includes("sensor.garage_main_current"));
});

run("selector groups classify Main, Circuits, and Other deterministically", () => {
  const fixture = selectorFixture();
  const groups = choiceGroups(fixture, false, "power_entity");
  assert.deepEqual(groups.map((group) => group.label), [
    "Main",
    "Circuits",
    "Other compatible entities",
  ]);
  const byLabel = Object.fromEntries(
    groups.map((group) => [group.label, group.options.map((option) => option.value)])
  );
  assert.ok(byLabel.Main.includes("sensor.garage_main_power"));
  assert.ok(byLabel.Main.includes("sensor.garage_phase_a_power"));
  assert.ok(byLabel.Circuits.includes("sensor.renamed_laundry"));
  assert.deepEqual(
    byLabel.Circuits.filter((value) => value.includes("circuit_")),
    ["sensor.garage_circuit_2_power", "sensor.garage_circuit_10_power"]
  );
  assert.deepEqual(byLabel["Other compatible entities"], [
    "sensor.garage_auxiliary_power",
    "sensor.garage_mystery_power",
  ]);
});

run("measurement selectors exclude mapping, energy, diagnostics, and switches", () => {
  const fixture = selectorFixture();
  const values = choiceValues(choiceGroups(fixture, false, "power_entity"));
  assert.ok(!values.some((value) => value.includes("sem_clamp_1_source")));
  assert.ok(!values.includes("sensor.garage_daily_energy"));
  assert.ok(!values.includes("sensor.garage_parser_frames"));
  assert.ok(!values.some((value) => value.startsWith("switch.")));
});

run("show-all mode keeps selected device first and filters field type", () => {
  const fixture = selectorFixture();
  const powerGroups = choiceGroups(fixture, true, "power_entity");
  assert.deepEqual(powerGroups.slice(0, 3).map((group) => group.label), [
    "Main",
    "Circuits",
    "Other compatible entities",
  ]);
  assert.ok(powerGroups.some((group) => group.label === "Workshop SEM Meter"));
  assert.ok(powerGroups.some((group) => group.label === "Solar Site"));
  const powerValues = choiceValues(powerGroups);
  assert.ok(powerValues.includes("sensor.workshop_main_power"));
  assert.ok(!powerValues.includes("sensor.workshop_main_current"));
  assert.ok(!powerValues.includes("sensor.solar_energy"));

  const currentValues = choiceValues(
    choiceGroups(fixture, true, "current_entity")
  );
  assert.ok(currentValues.includes("sensor.garage_main_current"));
  assert.ok(currentValues.includes("sensor.workshop_main_current"));
  assert.ok(!currentValues.includes("sensor.garage_main_power"));
});

run("existing configured entity remains visible outside selected device", () => {
  const fixture = selectorFixture();
  const configured = "sensor.solar_inverter_power";
  const groups = choiceGroups(fixture, false, "power_entity", configured);
  assert.ok(choiceValues(groups).includes(configured));
});

run("group headings are metadata and can never be stored as entity IDs", () => {
  const fixture = selectorFixture();
  const groups = choiceGroups(fixture, true, "power_entity");
  const values = new Set(choiceValues(groups));
  for (const group of groups) {
    assert.ok(!values.has(group.label));
    assert.ok(group.options.every((option) => option.value.startsWith("sensor.")));
  }
});

run("manual assignment stores entity IDs and device changes preserve assignments", () => {
  const fixture = selectorFixture();
  const editor = Object.create(Editor.prototype);
  editor._config = emptyConfig();
  editor._entityChoiceCache = new Map();
  editor._summary = null;
  editor._replaceConfirmationPending = false;
  editor._emitConfig = function emitConfig(config) {
    this._config = Card._copyConfig(config);
  };
  editor._render = () => {};
  editor._updateImportControls = () => {};
  editor._refreshEntityChoices = () => Promise.resolve();
  editor._setManualEntity("entity", 1, "sensor.renamed_laundry");
  editor._setManualEntity("power_entity", 0, "sensor.garage_main_power");
  editor._setSelectedDevice(fixture.secondDevice);
  assert.equal(editor._config.device_id, fixture.secondDevice);
  assert.equal(editor._config.main.power_entity, "sensor.garage_main_power");
  assert.equal(editor._config.clamps[0].entity, "sensor.renamed_laundry");
  editor._handleFormChanged({
    stopPropagation() {},
    detail: { value: { device_id: DEVICE_ID } },
  });
  assert.equal(editor._config.device_id, DEVICE_ID);
  assert.equal(editor._config.main.power_entity, "sensor.garage_main_power");
  assert.equal(editor._config.clamps[0].entity, "sensor.renamed_laundry");
});

run("existing configurations default to selected-device-only mode", () => {
  const config = emptyConfig();
  assert.equal(config.show_all_entities, undefined);
  assert.equal(Card.getStubConfig().show_all_entities, undefined);
  assert.equal(config.show_all_entities === true, false);
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.value = "";
    this.parentElement = null;
    this.classList = {
      add: (...tokens) => {
        const classes = new Set(String(this.className || "").split(/\s+/u).filter(Boolean));
        for (const token of tokens) {
          classes.add(token);
        }
        this.className = [...classes].join(" ");
      },
    };
  }

  append(...children) {
    for (const child of children) {
      if (child && typeof child === "object") {
        child.parentElement = this;
      }
    }
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  dispatch(type, details = {}) {
    const event = {
      key: "",
      bubbles: true,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...details,
    };
    this._dispatchEvent(type, event);
    return event;
  }

  _dispatchEvent(type, event) {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
    if (event.bubbles !== false && this.parentElement?._dispatchEvent) {
      this.parentElement._dispatchEvent(type, event);
    }
  }
}

global.document = {
  createElement: (tagName) => new FakeElement(tagName),
  createTextNode: (text) => ({ textContent: text }),
};
global.CustomEvent = class {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

function findElements(root, predicate, matches = []) {
  if (root && predicate(root)) {
    matches.push(root);
  }
  for (const child of root?.children || []) {
    if (child && typeof child === "object") {
      findElements(child, predicate, matches);
    }
  }
  return matches;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function editorHarness(config = emptyConfig()) {
  const editor = Object.create(Editor.prototype);
  editor._config = Card._copyConfig(config);
  editor._hass = { states: {} };
  editor._registryCache = { devices: [], entities: [] };
  editor._registryLoadPromise = null;
  editor._deviceCandidates = [];
  editor._deviceDiscoveryAttempted = true;
  editor._deviceDiscoveryLoading = false;
  editor._deviceDiscoveryMessage = "";
  editor._deviceDiscoveryError = "";
  editor._selectedMissingReloadFor = "";
  editor._entityChoiceCache = new Map();
  editor._entityChoicesLoading = false;
  editor._entityRefreshGeneration = 0;
  editor._entityRefreshKey = "";
  editor._entityRefreshPromise = null;
  editor._entityRefreshDeferred = false;
  editor._configRenderDeferred = false;
  editor._textDrafts = new Map();
  editor._composingDrafts = new Set();
  editor._activeDraftKey = "";
  editor._lastEmittedConfigSignature = "";
  editor._renderStates = [];
  editor._render = function render() {
    this._renderStates.push({
      registry: this._deviceDiscoveryLoading,
      choices: this._entityChoicesLoading,
    });
  };
  editor.dispatchEvent = () => true;
  return editor;
}

async function runAsync(name, test) {
  await test();
  console.log(`[PASS] ${name}`);
}

(async () => {
  await runAsync("initial registry loading has visible bounded state", async () => {
    const editor = editorHarness();
    editor._registryCache = null;
    editor._deviceDiscoveryAttempted = false;
    editor._warmEntityChoiceCache = () => {};
    const devices = deferred();
    const entities = deferred();
    editor._hass = {
      states: {},
      devices: {},
      callWS: ({ type }) =>
        type === "config/device_registry/list"
          ? devices.promise
          : entities.promise,
    };
    const loading = editor._loadDeviceCandidates(false, false);
    assert.equal(editor._deviceDiscoveryLoading, true);
    assert.ok(editor._renderStates.some((state) => state.registry));
    devices.resolve([]);
    entities.resolve([]);
    await loading;
    assert.equal(editor._deviceDiscoveryLoading, false);
  });

  await runAsync("registry failure clears loading and keeps assignments", async () => {
    const config = emptyConfig();
    config.main.power_entity = "sensor.existing_main";
    const editor = editorHarness(config);
    editor._registryCache = null;
    editor._deviceDiscoveryAttempted = false;
    editor._hass = {
      states: {},
      callWS: () => Promise.reject(new Error("registry offline")),
    };
    await assert.rejects(editor._loadDeviceCandidates(false, false));
    assert.equal(editor._deviceDiscoveryLoading, false);
    assert.match(editor._deviceDiscoveryError, /registry offline/u);
    assert.equal(editor._config.main.power_entity, "sensor.existing_main");
  });

  await runAsync("loading region exposes status and busy accessibility", async () => {
    const editor = editorHarness();
    const region = editor._createEntityLoadingRegion();
    assert.equal(region.attributes.get("role"), "status");
    assert.equal(region.attributes.get("aria-live"), "polite");
    assert.equal(region.attributes.get("aria-busy"), "true");
    assert.match(region.className, /sticky-loading-banner/u);
    assert.match(region.children[1].textContent, /Loading SEM Meter entities/u);
    const section = new FakeElement("section");
    editor._setEntitySectionBusy(section, true);
    assert.equal(section.attributes.get("aria-busy"), "true");
  });

  await runAsync("loading banner is sticky and precedes normal editor content", async () => {
    const editor = editorHarness();
    editor._deviceDiscoveryLoading = true;
    editor.shadowRoot = {
      children: [],
      replaceChildren(...children) {
        this.children = children;
      },
      querySelector() {
        return null;
      },
    };
    editor._render = Editor.prototype._render.bind(editor);
    editor._render();
    assert.equal(editor.shadowRoot.children[1].attributes.get("role"), "status");
    assert.match(editor.shadowRoot.children[1].className, /sticky-loading-banner/u);
    assert.equal(editor.shadowRoot.children[2].className, "device-section");
    const entitySelects = findElements(
      editor.shadowRoot,
      (element) => element.dataset?.entityField
    );
    assert.ok(entitySelects.length > 0);
    assert.ok(entitySelects.every((select) => select.disabled === true));
    const source = fs.readFileSync(
      path.join(__dirname, "sem-electric-panel-card.js"),
      "utf8"
    );
    assert.match(source, /\.entity-loading\s*\{[\s\S]*?position:\s*sticky/u);
    assert.match(source, /\.entity-loading\s*\{[\s\S]*?top:\s*8px/u);
    assert.match(source, /\.entity-loading\s*\{[\s\S]*?z-index:\s*20/u);
  });

  await runAsync("loading banner disappears after registry failure and leaves error readable", async () => {
    const editor = editorHarness();
    editor._registryCache = null;
    editor._deviceDiscoveryAttempted = false;
    editor._hass = {
      states: {},
      callWS: () => Promise.reject(new Error("registry offline")),
    };
    editor.shadowRoot = {
      children: [],
      replaceChildren(...children) {
        this.children = children;
      },
      querySelector() {
        return null;
      },
    };
    editor._render = Editor.prototype._render.bind(editor);
    const loading = editor._loadDeviceCandidates(false, false);
    assert.ok(
      findElements(editor.shadowRoot, (element) =>
        String(element.className).includes("sticky-loading-banner")
      ).length === 1
    );
    await assert.rejects(loading);
    assert.equal(
      findElements(editor.shadowRoot, (element) =>
        String(element.className).includes("sticky-loading-banner")
      ).length,
      0
    );
    const errors = findElements(
      editor.shadowRoot,
      (element) => element.className === "device-message error"
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0].textContent, /registry offline/u);
  });

  await runAsync("loading banner remains through registry work and disappears after success", async () => {
    const editor = editorHarness();
    const devices = deferred();
    const entities = deferred();
    editor._registryCache = null;
    editor._deviceDiscoveryAttempted = false;
    editor._hass = {
      states: {},
      devices: {},
      callWS: ({ type }) =>
        type === "config/device_registry/list"
          ? devices.promise
          : entities.promise,
    };
    editor.shadowRoot = {
      children: [],
      replaceChildren(...children) {
        this.children = children;
      },
      querySelector() {
        return null;
      },
    };
    editor._render = Editor.prototype._render.bind(editor);
    const loading = editor._loadDeviceCandidates(false, false);
    const bannerCount = () =>
      findElements(editor.shadowRoot, (element) =>
        String(element.className).includes("sticky-loading-banner")
      ).length;
    assert.equal(bannerCount(), 1);
    devices.resolve([]);
    await Promise.resolve();
    assert.equal(bannerCount(), 1);
    entities.resolve([]);
    await loading;
    assert.equal(bannerCount(), 0);
  });

  await runAsync("choice refresh starts immediately and deduplicates toggles", async () => {
    const editor = editorHarness();
    const paint = deferred();
    let warmCount = 0;
    editor._yieldForEditorPaint = () => paint.promise;
    editor._warmEntityChoiceCache = () => {
      warmCount += 1;
    };
    const first = editor._setShowAllEntities(true);
    const duplicate = editor._setShowAllEntities(true);
    assert.equal(first, duplicate);
    assert.equal(editor._config.show_all_entities, true);
    assert.equal(editor._entityChoicesLoading, true);
    assert.ok(editor._renderStates.at(-1).choices);
    paint.resolve();
    await first;
    assert.equal(editor._entityChoicesLoading, false);
    assert.equal(warmCount, 1);
  });

  await runAsync("stale selector refresh cannot overwrite newer choices", async () => {
    const editor = editorHarness();
    const firstPaint = deferred();
    const secondPaint = deferred();
    const paints = [firstPaint, secondPaint];
    const warmedFor = [];
    editor._yieldForEditorPaint = () => paints.shift().promise;
    editor._warmEntityChoiceCache = () => {
      warmedFor.push(editor._config.device_id);
    };
    const first = editor._refreshEntityChoices("first device");
    editor._config.device_id = "newer-device";
    const second = editor._refreshEntityChoices("newer device");
    firstPaint.resolve();
    await first;
    assert.equal(editor._entityChoicesLoading, true);
    assert.deepEqual(warmedFor, []);
    secondPaint.resolve();
    await second;
    assert.deepEqual(warmedFor, ["newer-device"]);
    assert.equal(editor._entityChoicesLoading, false);
  });

  await runAsync("selected-device refresh preserves assignments", async () => {
    const config = emptyConfig();
    config.main.power_entity = "sensor.existing_main";
    config.clamps.push({ clamp: 1, entity: "sensor.existing_clamp" });
    const editor = editorHarness(config);
    const paint = deferred();
    editor._yieldForEditorPaint = () => paint.promise;
    editor._warmEntityChoiceCache = () => {};
    const refresh = editor._setSelectedDevice("new-device");
    assert.equal(editor._entityChoicesLoading, true);
    assert.equal(editor._config.main.power_entity, "sensor.existing_main");
    assert.equal(editor._config.clamps[0].entity, "sensor.existing_clamp");
    paint.resolve();
    await refresh;
    assert.equal(editor._entityChoicesLoading, false);
    assert.equal(editor._config.main.power_entity, "sensor.existing_main");
    assert.equal(editor._config.clamps[0].entity, "sensor.existing_clamp");
  });

  await runAsync("draft text input types continuously and commits once", async () => {
    const editor = editorHarness();
    let renderCount = 0;
    const emitted = [];
    editor._render = () => {
      renderCount += 1;
    };
    editor._emitConfig = function emitConfig(config) {
      this._config = Card._copyConfig(config);
      emitted.push(Card._copyConfig(config));
    };
    const label = editor._createDraftTextInput("Label", 1, "name", "");
    const input = label.children[0];
    input.dispatch("focus");
    for (const value of ["L", "La", "Lau", "Laundry"]) {
      input.value = value;
      input.dispatch("input");
      assert.equal(editor._activeDraftKey, "clamp:1:name");
    }
    input.selectionStart = 3;
    input.selectionEnd = 3;
    input.value = "Laudry";
    input.dispatch("input");
    input.value = "Laundry";
    input.dispatch("input");
    assert.equal(renderCount, 0);
    assert.equal(emitted.length, 0);
    input.dispatch("change");
    input.dispatch("blur");
    assert.equal(emitted.length, 1);
    assert.equal(editor._config.clamps[0].name, "Laundry");
  });

  await runAsync("multi-digit circuit, paste, Enter, and blur preserve input", async () => {
    const editor = editorHarness();
    const emitted = [];
    editor._emitConfig = function emitConfig(config) {
      this._config = Card._copyConfig(config);
      emitted.push(Card._copyConfig(config));
    };
    const label = editor._createDraftTextInput("Circuit", 1, "circuit", "");
    const input = label.children[0];
    input.dispatch("focus");
    input.value = "1";
    input.dispatch("input");
    input.value = "10";
    input.dispatch("input");
    assert.equal(emitted.length, 0);
    input.dispatch("keydown", { key: "Enter" });
    assert.equal(emitted.length, 1);
    assert.equal(editor._config.clamps[0].circuit, "10");
    input.value = "10-12 pasted";
    input.dispatch("input");
    input.dispatch("blur");
    assert.equal(emitted.length, 2);
    assert.equal(editor._config.clamps[0].circuit, "10-12 pasted");
  });

  await runAsync("IME composition and external config preserve active draft", async () => {
    const editor = editorHarness();
    const emitted = [];
    let renderCount = 0;
    editor._render = () => {
      renderCount += 1;
    };
    editor._ensureDeviceCandidates = () => {};
    editor._emitConfig = function emitConfig(config) {
      this._config = Card._copyConfig(config);
      emitted.push(Card._copyConfig(config));
    };
    const label = editor._createDraftTextInput("Label", 1, "name", "Kitchen");
    const input = label.children[0];
    assert.equal(input.value, "Kitchen");
    input.dispatch("focus");
    input.dispatch("compositionstart");
    input.value = "台所";
    input.dispatch("input");
    input.dispatch("change");
    assert.equal(emitted.length, 0);
    editor.setConfig({ ...editor._config, title: "Externally updated" });
    assert.equal(renderCount, 0);
    assert.equal(editor._textDrafts.get("clamp:1:name"), "台所");
    input.dispatch("compositionend");
    input.dispatch("blur");
    assert.equal(emitted.length, 1);
    assert.equal(editor._config.title, "Externally updated");
    assert.equal(editor._config.clamps[0].name, "台所");
  });

  await runAsync("unrelated form changes preserve committed clamp text", async () => {
    const config = emptyConfig();
    config.clamps.push({
      clamp: 1,
      entity: "sensor.laundry_power",
      name: "Laundry",
      circuit: "10",
      icon: "",
      unit: "auto",
      poles: 1,
    });
    const editor = editorHarness(config);
    editor._handleFormChanged({
      stopPropagation() {},
      detail: {
        value: {
          clamps: [{ clamp: 1, icon: "mdi:washing-machine", poles: 1 }],
        },
      },
    });
    assert.equal(editor._config.clamps[0].entity, "sensor.laundry_power");
    assert.equal(editor._config.clamps[0].name, "Laundry");
    assert.equal(editor._config.clamps[0].circuit, "10");
    assert.equal(editor._config.clamps[0].icon, "mdi:washing-machine");
  });

  await runAsync("circuit display names are cleaned conservatively", async () => {
    assert.equal(
      Card._cleanCircuitDisplayName("SEM Meter Laundry Power"),
      "Laundry"
    );
    assert.equal(
      Card._cleanCircuitDisplayName(
        "Garage SEM Meter Kitchen Cooking Power",
        "Garage SEM Meter"
      ),
      "Kitchen Cooking"
    );
    assert.equal(
      Card._cleanCircuitDisplayName("SEM Meter TP Link Power Strip Power"),
      "TP Link Power Strip"
    );
    assert.equal(Card._cleanCircuitDisplayName("A⁄C Power"), "A⁄C");
    assert.equal(
      Card._cleanCircuitDisplayName("Workshop receptacles"),
      "Workshop receptacles"
    );
    assert.equal(Card._cleanCircuitDisplayName(""), "Unnamed circuit");
    assert.equal(Card._cleanCircuitDisplayName("Power"), "Power");
  });

  await runAsync("rendered clamp keeps identity, tooltip, and details behavior", async () => {
    const entityId = "sensor.garage_sem_meter_kitchen_cooking_power";
    const card = Object.create(Card.prototype);
    card._config = {
      device_id: DEVICE_ID,
      numbering_style: "circuit",
      measurement_decimals: 1,
      energy_decimals: 2,
    };
    card._hass = {
      devices: { [DEVICE_ID]: { name: "Garage SEM Meter" } },
      states: {
        [entityId]: stateObject(
          "245.5",
          "Garage SEM Meter Kitchen Cooking Power",
          { device_class: "power", unit_of_measurement: "W" }
        ),
      },
    };
    let openedEntity = "";
    card._openMoreInfo = (opened) => {
      openedEntity = opened;
    };
    const clamp = {
      clamp: 2,
      entity: entityId,
      name: "",
      circuit: "CKT 10",
      icon: "",
      unit: "auto",
      poles: 1,
    };
    const tile = card._renderClamp(clamp);
    const findClass = (element, className) => {
      if (element.className === className) {
        return element;
      }
      for (const child of element.children || []) {
        if (child && typeof child === "object") {
          const found = findClass(child, className);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    const name = findClass(tile, "breaker-name");
    const state = findClass(tile, "breaker-state");
    const circuit = findClass(tile, "circuit");
    assert.ok(name);
    assert.ok(state);
    assert.ok(circuit);
    assert.equal(name.textContent, "Kitchen Cooking");
    assert.equal(name.title, "Kitchen Cooking");
    assert.equal(circuit.textContent, "CIRCUIT 10");
    assert.equal(clamp.entity, entityId);
    tile.dispatch("click");
    assert.equal(openedEntity, entityId);
  });

  await runAsync("circuit tile CSS supports two lines and fixed value area", async () => {
    const source = fs.readFileSync(
      path.join(__dirname, "sem-electric-panel-card.js"),
      "utf8"
    );
    const nameRule = source.match(/\.breaker-name\s*\{([\s\S]*?)\}/u)?.[1] || "";
    const stateRule = source.match(/\.breaker-state\s*\{([\s\S]*?)\}/u)?.[1] || "";
    assert.match(nameRule, /-webkit-line-clamp:\s*2/u);
    assert.match(nameRule, /white-space:\s*normal/u);
    assert.match(nameRule, /overflow-wrap:\s*anywhere/u);
    assert.match(stateRule, /flex-shrink:\s*0/u);
    assert.match(stateRule, /align-self:\s*start/u);
    assert.match(
      source,
      /grid-template-columns:\s*24px\s+minmax\(0,\s*1fr\)\s+max-content/u
    );
  });

  await runAsync("numbering styles format physical and custom circuit numbers", async () => {
    assert.equal(Card._formatCircuitHeading(1, "", undefined), "CLAMP 1");
    assert.equal(Card._formatCircuitHeading(14, "", "clamp"), "CLAMP 14");
    assert.equal(
      Card._formatCircuitHeading(14, "", "circuit"),
      "CIRCUIT 14"
    );
    assert.equal(Card._formatCircuitHeading(14, "", "number"), "#14");
    assert.equal(Card._formatCircuitHeading(14, "7", "clamp"), "CLAMP 7");
    assert.equal(
      Card._formatCircuitHeading(14, "Circuit 7", "circuit"),
      "CIRCUIT 7"
    );
    assert.equal(Card._formatCircuitHeading(1, "CKT 1", "circuit"), "CIRCUIT 1");
    assert.equal(Card._formatCircuitHeading(1, "Clamp 1", "clamp"), "CLAMP 1");
    assert.equal(
      Card._formatCircuitHeading(4, "Kitchen Feed", "number"),
      "Kitchen Feed"
    );
    assert.equal(Card._formatCircuitHeading(3, "", "invalid"), "CLAMP 3");
    for (let clamp = 1; clamp <= 16; clamp += 1) {
      assert.equal(
        Card._formatCircuitHeading(clamp, "", "number"),
        `#${clamp}`
      );
    }
  });

  await runAsync("new display settings default without migrating old configs", async () => {
    const legacy = emptyConfig();
    legacy.clamps.push({
      clamp: 1,
      entity: "sensor.laundry_power",
      name: "Laundry",
      circuit: "7",
      unit: "auto",
      poles: 1,
    });
    const normalized = Card._normalizeConfig(legacy);
    assert.equal(normalized.numbering_style, "clamp");
    assert.equal(normalized.measurement_decimals, 1);
    assert.equal(normalized.energy_decimals, 2);
    assert.equal(normalized.clamps[0].entity, "sensor.laundry_power");
    assert.equal(normalized.clamps[0].name, "Laundry");
    assert.equal(normalized.clamps[0].circuit, "7");

    const invalid = Card._normalizeConfig({
      ...legacy,
      numbering_style: "unexpected",
      measurement_decimals: 9,
      energy_decimals: -1,
    });
    assert.equal(invalid.numbering_style, "clamp");
    assert.equal(invalid.measurement_decimals, 1);
    assert.equal(invalid.energy_decimals, 2);
  });

  await runAsync("editor exposes display settings without changing assignments", async () => {
    const schema = Card._buildConfigForm(emptyConfig(), { states: {} }, true);
    const general = schema.schema.find((section) => section.title === "General");
    assert.ok(general);
    assert.deepEqual(
      general.schema.map((field) => field.name),
      [
        "title",
        "numbering_style",
        "panel_size",
        "show_empty_positions",
        "measurement_decimals",
        "energy_decimals",
      ]
    );
    const config = emptyConfig();
    config.clamps.push({ clamp: 1, entity: "sensor.laundry_power" });
    const changed = Card._copyConfig({
      ...config,
      numbering_style: "number",
      measurement_decimals: 2,
      energy_decimals: 3,
    });
    assert.equal(changed.clamps[0].entity, "sensor.laundry_power");
  });

  await runAsync("measurement and energy rounding is numeric and locale aware", async () => {
    const format = (rawState, unit, measurement = 1, energy = 2) =>
      Card._formatEntity(
        {
          locale: { language: "en-US" },
          states: {
            "sensor.value": stateObject(rawState, "Value", {
              unit_of_measurement: unit,
            }),
          },
        },
        "sensor.value",
        "auto",
        measurement,
        energy
      );
    assert.equal(format("786.61", "W").value, "786.6");
    assert.equal(format("341.73", "W").value, "341.7");
    assert.equal(format("439.06", "W").value, "439.1");
    assert.equal(format("2.09", "W").value, "2.1");
    assert.equal(format("0", "W").value, "0");
    assert.equal(format("-0.04", "W").value, "0");
    assert.equal(format("1128", "W").value, "1,128");
    assert.equal(format("0.45", "kWh").value, "0.45");
    assert.equal(format("9.1234", "kWh").value, "9.12");
    assert.equal(format("9.9", "kWh", 1, 0).value, "10");
    assert.equal(format("unavailable", "W").value, "Unavailable");
    assert.equal(format("unknown", "W").value, "Unknown");
  });

  await runAsync("conversion precedes precision and raw balance inputs stay intact", async () => {
    const hass = {
      locale: { language: "en-US" },
      states: {
        "sensor.converted": stateObject("0.78661", "Converted", {
          unit_of_measurement: "kW",
        }),
        "sensor.line_1": stateObject("100.04", "Line 1", {
          unit_of_measurement: "W",
        }),
        "sensor.line_2": stateObject("74.99", "Line 2", {
          unit_of_measurement: "W",
        }),
      },
    };
    const converted = Card._formatEntity(
      hass,
      "sensor.converted",
      "W",
      1,
      2
    );
    assert.equal(converted.value, "786.6");
    assert.equal(converted.numeric, 786.61);
    const line1 = Card._powerValue(hass, "sensor.line_1");
    const line2 = Card._powerValue(hass, "sensor.line_2");
    assert.equal(line1, 100.04);
    assert.equal(line2, 74.99);
    assert.deepEqual(
      Card._calculateBalance(line1, line2),
      Card._calculateBalance(100.04, 74.99)
    );
  });

  await runAsync("main phase and circuit paths share configured precision", async () => {
    const card = Object.create(Card.prototype);
    card._config = { measurement_decimals: 1, energy_decimals: 2 };
    card._hass = {
      locale: { language: "en-US" },
      states: {
        "sensor.main": stateObject("1128", "Main", {
          unit_of_measurement: "W",
        }),
        "sensor.phase": stateObject("341.73", "Phase", {
          unit_of_measurement: "W",
        }),
        "sensor.circuit": stateObject("2.09", "Circuit", {
          unit_of_measurement: "W",
        }),
        "sensor.energy": stateObject("9.1234", "Energy", {
          unit_of_measurement: "kWh",
        }),
      },
    };
    assert.equal(card._formatConfiguredEntity("sensor.main", "auto").value, "1,128");
    assert.equal(card._formatConfiguredEntity("sensor.phase", "auto").value, "341.7");
    assert.equal(card._formatConfiguredEntity("sensor.circuit", "auto").value, "2.1");
    assert.equal(card._formatConfiguredEntity("sensor.energy", "auto").value, "9.12");
  });

  await runAsync("live editor DOM shows all display controls uncollapsed", async () => {
    const editor = editorHarness();
    editor._config.numbering_style = undefined;
    editor._config.measurement_decimals = undefined;
    editor._config.energy_decimals = undefined;
    editor._registryCache = { devices: [], entities: [] };
    editor._deviceCandidates = [];
    editor.shadowRoot = {
      children: [],
      replaceChildren(...children) {
        this.children = children;
      },
      querySelector() {
        return null;
      },
    };
    editor._render = Editor.prototype._render.bind(editor);
    editor._render();
    const displaySections = findElements(
      editor.shadowRoot,
      (element) => element.className === "display-settings"
    );
    assert.equal(displaySections.length, 1);
    assert.equal(displaySections[0].tagName, "section");
    assert.equal(
      findElements(displaySections[0], (element) => element.tagName === "details")
        .length,
      0
    );
    const labels = findElements(
      displaySections[0],
      (element) => element.className === "display-setting-label"
    ).map((element) => element.textContent);
    assert.deepEqual(labels, [
      "Panel size",
      "Show unused breaker positions",
      "Circuit numbering style",
      "Power/current decimals",
      "Energy decimals",
    ]);
    const selects = findElements(
      displaySections[0],
      (element) => Boolean(element.dataset?.displaySetting)
    );
    assert.deepEqual(
      selects.map((select) => [select.dataset.displaySetting, select.value]),
      [
        ["panel_size", "16"],
        ["show_empty_positions", "true"],
        ["numbering_style", "clamp"],
        ["measurement_decimals", "1"],
        ["energy_decimals", "2"],
      ]
    );
    assert.deepEqual(
      selects[3].children.map((option) => option.textContent),
      ["0 decimals", "1 decimal", "2 decimals"]
    );
    assert.deepEqual(
      selects[4].children.map((option) => option.textContent),
      ["0 decimals", "1 decimal", "2 decimals", "3 decimals"]
    );
  });

  await runAsync("display controls show configured and safe fallback values", async () => {
    const editor = editorHarness({
      ...emptyConfig(),
      numbering_style: "circuit",
      measurement_decimals: 0,
      energy_decimals: 3,
    });
    const section = editor._renderDisplaySettings();
    const values = Object.fromEntries(
      findElements(section, (element) => Boolean(element.dataset?.displaySetting)).map(
        (select) => [select.dataset.displaySetting, select.value]
      )
    );
    assert.deepEqual(values, {
      panel_size: "16",
      show_empty_positions: "true",
      numbering_style: "circuit",
      measurement_decimals: "0",
      energy_decimals: "3",
    });

    editor._config.numbering_style = "invalid";
    editor._config.measurement_decimals = 99;
    editor._config.energy_decimals = -1;
    const fallback = editor._renderDisplaySettings();
    const fallbackValues = Object.fromEntries(
      findElements(fallback, (element) => Boolean(element.dataset?.displaySetting)).map(
        (select) => [select.dataset.displaySetting, select.value]
      )
    );
    assert.deepEqual(fallbackValues, {
      panel_size: "16",
      show_empty_positions: "true",
      numbering_style: "clamp",
      measurement_decimals: "1",
      energy_decimals: "2",
    });
    assert.equal(editor._config.measurement_decimals, 99);
    assert.equal(editor._config.energy_decimals, -1);
  });

  await runAsync("decimal controls emit numeric config without registry work", async () => {
    const config = {
      ...emptyConfig(),
      device_id: DEVICE_ID,
      numbering_style: "number",
      show_all_entities: true,
      clamps: [{ clamp: 1, entity: "sensor.laundry_power", name: "Laundry" }],
    };
    const editor = editorHarness(config);
    let registryLoads = 0;
    let choiceRefreshes = 0;
    const events = [];
    editor._loadDeviceCandidates = () => {
      registryLoads += 1;
      return Promise.resolve();
    };
    editor._refreshEntityChoices = () => {
      choiceRefreshes += 1;
      return Promise.resolve();
    };
    editor.dispatchEvent = (event) => {
      events.push(event);
      return true;
    };
    const section = editor._renderDisplaySettings();
    const selects = Object.fromEntries(
      findElements(section, (element) => Boolean(element.dataset?.displaySetting)).map(
        (select) => [select.dataset.displaySetting, select]
      )
    );
    selects.measurement_decimals.value = "2";
    selects.measurement_decimals.dispatch("change");
    selects.energy_decimals.value = "3";
    selects.energy_decimals.dispatch("change");
    assert.equal(editor._config.measurement_decimals, 2);
    assert.equal(typeof editor._config.measurement_decimals, "number");
    assert.equal(editor._config.energy_decimals, 3);
    assert.equal(typeof editor._config.energy_decimals, "number");
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event.type === "config-changed"));
    assert.equal(registryLoads, 0);
    assert.equal(choiceRefreshes, 0);
    assert.equal(editor._config.device_id, DEVICE_ID);
    assert.equal(editor._config.numbering_style, "number");
    assert.equal(editor._config.show_all_entities, true);
    assert.equal(editor._config.clamps[0].entity, "sensor.laundry_power");
    assert.equal(editor._config.clamps[0].name, "Laundry");
    assert.equal(editor._setDisplaySetting("measurement_decimals", ""), false);
    assert.equal(editor._setDisplaySetting("energy_decimals", 9), false);
    assert.equal(events.length, 2);
  });

  await runAsync("preview rerenders with newly selected precision", async () => {
    const card = Object.create(Card.prototype);
    let renders = 0;
    card._render = () => {
      renders += 1;
    };
    card.setConfig({
      ...emptyConfig(),
      measurement_decimals: 2,
      energy_decimals: 3,
    });
    assert.equal(renders, 1);
    assert.equal(card._config.measurement_decimals, 2);
    assert.equal(card._config.energy_decimals, 3);
  });

  await runAsync("main breaker renders two linked poles as one control", async () => {
    const card = Object.create(Card.prototype);
    card._config = {
      measurement_decimals: 1,
      energy_decimals: 2,
      main: {
        name: "Main 200 A",
        power_entity: "sensor.main_power",
        current_entity: "sensor.main_current",
        line_1_entity: "sensor.phase_a_power",
        line_2_entity: "sensor.phase_b_power",
      },
    };
    card._hass = {
      locale: { language: "en-US" },
      states: {
        "sensor.main_power": stateObject("1128", "Main Power", {
          unit_of_measurement: "W",
        }),
        "sensor.main_current": stateObject("42.34", "Main Current", {
          unit_of_measurement: "A",
        }),
        "sensor.phase_a_power": stateObject("560.12", "Phase A Power", {
          unit_of_measurement: "W",
        }),
        "sensor.phase_b_power": stateObject("567.88", "Phase B Power", {
          unit_of_measurement: "W",
        }),
      },
    };
    const opened = [];
    card._openMoreInfo = (entityId) => opened.push(entityId);
    const main = card._renderMain();
    const poles = findElements(
      main,
      (element) => element.className === "main-breaker-poles"
    );
    const poleBodies = findElements(
      main,
      (element) => String(element.className || "").includes("main-breaker-pole ")
    );
    const handles = findElements(
      main,
      (element) => element.className === "main-pole-handle"
    );
    const ties = findElements(
      main,
      (element) => element.className === "main-handle-tie"
    );
    assert.equal(poles.length, 1);
    assert.equal(poleBodies.length, 2);
    assert.equal(handles.length, 2);
    assert.equal(ties.length, 1);
    assert.equal(poles[0].attributes.get("aria-hidden"), "true");

    const clickTargets = findElements(
      main,
      (element) => element.attributes?.get("role") === "button"
    );
    assert.equal(clickTargets.length, 1);
    assert.equal(clickTargets[0], main);
    poleBodies[0].dispatch("click");
    poleBodies[1].dispatch("click");
    main.dispatch("keydown", { key: "Enter" });
    main.dispatch("keydown", { key: " " });
    assert.deepEqual(opened, [
      "sensor.main_power",
      "sensor.main_power",
      "sensor.main_power",
      "sensor.main_power",
    ]);

    const totals = findElements(
      main,
      (element) => element.className === "main-total"
    );
    assert.equal(totals.length, 1);
    assert.equal(totals[0].textContent, "1,128 W | 42.3 A");
    const phaseLines = findElements(
      main,
      (element) => element.className === "main-lines"
    );
    assert.equal(phaseLines.length, 1);
    assert.equal(phaseLines[0].textContent, "L1 560.1 W | L2 567.9 W");
  });

  await runAsync("main breaker preserves unknown and unavailable values", async () => {
    const card = Object.create(Card.prototype);
    card._config = {
      measurement_decimals: 1,
      energy_decimals: 2,
      main: {
        name: "Main Breaker",
        power_entity: "sensor.main_power",
        current_entity: "sensor.main_current",
        line_1_entity: "",
        line_2_entity: "",
      },
    };
    card._hass = {
      states: {
        "sensor.main_power": stateObject("unknown", "Main Power", {
          unit_of_measurement: "W",
        }),
        "sensor.main_current": stateObject("unavailable", "Main Current", {
          unit_of_measurement: "A",
        }),
      },
    };
    card._openMoreInfo = () => {};
    const main = card._renderMain();
    const total = findElements(
      main,
      (element) => element.className === "main-total"
    );
    assert.equal(total.length, 1);
    assert.equal(total[0].textContent, "Unknown");
  });

  await runAsync("main headline omits unusable optional current values", async () => {
    const renderHeadline = (powerState, currentState, configureCurrent = true) => {
      const card = Object.create(Card.prototype);
      card._config = {
        measurement_decimals: 1,
        energy_decimals: 2,
        main: {
          name: "Main Breaker",
          power_entity: powerState === undefined ? "" : "sensor.main_power",
          current_entity: configureCurrent ? "sensor.main_current" : "",
          line_1_entity: "",
          line_2_entity: "",
        },
      };
      card._hass = { locale: { language: "en-US" }, states: {} };
      if (powerState !== undefined) {
        card._hass.states["sensor.main_power"] = stateObject(
          powerState,
          "Main Power",
          { unit_of_measurement: "W" }
        );
      }
      if (configureCurrent && currentState !== undefined) {
        card._hass.states["sensor.main_current"] = stateObject(
          currentState,
          "Main Current",
          { unit_of_measurement: "A" }
        );
      }
      card._openMoreInfo = () => {};
      return findElements(
        card._renderMain(),
        (element) => element.className === "main-total"
      )[0].textContent;
    };

    assert.equal(renderHeadline("4257", "36.5"), "4,257 W | 36.5 A");
    assert.equal(renderHeadline("4257", undefined, false), "4,257 W");
    assert.equal(renderHeadline("4257", "unavailable"), "4,257 W");
    assert.equal(renderHeadline("4257", "unknown"), "4,257 W");
    assert.equal(renderHeadline("4257", "not numeric"), "4,257 W");
    assert.equal(renderHeadline("unavailable", "36.5"), "Unavailable | 36.5 A");
    assert.equal(renderHeadline("unavailable", "unavailable"), "Unavailable");
    assert.equal(renderHeadline(undefined, undefined, false), "No main entities configured");
  });

  await runAsync("main breaker CSS defines balanced poles seam handles and tie", async () => {
    const source = fs.readFileSync(
      path.join(__dirname, "sem-electric-panel-card.js"),
      "utf8"
    );
    assert.match(
      source,
      /\.main-breaker-poles\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/u
    );
    assert.match(
      source,
      /\.main-breaker-pole\.right\s*\{[\s\S]*?border-left:\s*1px/u
    );
    assert.match(source, /\.main-pole-handle\s*\{/u);
    assert.match(source, /\.main-handle-tie\s*\{/u);
    assert.doesNotMatch(source, /overflow-x:\s*(?:auto|scroll)/u);
  });

  await runAsync("branch breakers default to single and legacy pole metadata remains compatible", async () => {
    const stub = Card.getStubConfig();
    assert.equal(stub.clamps.length, 16);
    assert.ok(stub.clamps.every((clamp) => clamp.breaker_type === "single"));
    const normalized = Card._normalizeConfig({
      ...emptyConfig(),
      clamps: [
        { clamp: 1, entity: "sensor.one", poles: 1 },
        { clamp: 3, entity: "sensor.three", poles: 2 },
        {
          clamp: 5,
          entity: "sensor.five",
          poles: 2,
          breaker_type: "single",
        },
      ],
    });
    assert.equal(normalized.clamps[0].breaker_type, "single");
    assert.equal(normalized.clamps[1].breaker_type, "double");
    assert.equal(normalized.clamps[2].breaker_type, "single");
  });

  await runAsync("branch pair planning preserves ordering and fails invalid starts safely", async () => {
    assert.equal(Card._pairedCircuit(1), 3);
    assert.equal(Card._pairedCircuit(2), 4);
    assert.equal(Card._pairedCircuit(9), 11);
    assert.equal(Card._pairedCircuit(10), 12);
    assert.equal(Card._pairedCircuit(14), 16);
    assert.equal(Card._pairedCircuit(15), null);
    assert.equal(Card._pairedCircuit(16), null);
    const plan = Card._branchPairPlan([
      { clamp: 9, entity: "sensor.nine", breaker_type: "double" },
      { clamp: 10, entity: "sensor.ten", breaker_type: "double" },
      { clamp: 15, entity: "sensor.fifteen", breaker_type: "double" },
      { clamp: 16, entity: "sensor.sixteen", breaker_type: "double" },
    ]);
    assert.deepEqual(
      { kind: plan.get(9).kind, paired: plan.get(9).paired },
      { kind: "owner", paired: 11 }
    );
    assert.deepEqual(
      { kind: plan.get(10).kind, paired: plan.get(10).paired },
      { kind: "owner", paired: 12 }
    );
    assert.equal(plan.get(11).kind, "consumed");
    assert.equal(plan.get(11).owner, 9);
    assert.equal(plan.get(12).kind, "consumed");
    assert.equal(plan.get(12).owner, 10);
    assert.equal(plan.get(15).kind, "single");
    assert.match(plan.get(15).warning, /cannot start/u);
    assert.equal(plan.get(16).kind, "single");
    assert.match(plan.get(16).warning, /cannot start/u);

    const overlap = Card._branchPairPlan([
      { clamp: 7, entity: "sensor.seven", breaker_type: "double" },
      { clamp: 9, entity: "sensor.nine", breaker_type: "double" },
    ]);
    assert.equal(overlap.get(7).paired, 9);
    assert.equal(overlap.get(9).kind, "consumed");
    assert.equal(overlap.get(9).owner, 7);
    assert.match(overlap.get(9).warning, /already used/u);
  });

  await runAsync("configured branch double renders linked poles as one primary control", async () => {
    const primary = "sensor.ac_primary_power";
    const secondary = "sensor.ac_secondary_power";
    const oppositeTop = "sensor.opposite_top_power";
    const oppositeBottom = "sensor.opposite_bottom_power";
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig({
      ...emptyConfig(),
      numbering_style: "circuit",
      clamps: [
        {
          clamp: 9,
          entity: primary,
          name: "A⁄C",
          circuit: "9",
          unit: "auto",
          breaker_type: "double",
          breaker_rating: 30,
        },
        {
          clamp: 10,
          entity: oppositeTop,
          name: "Opposite top",
          circuit: "10",
          unit: "auto",
          breaker_type: "single",
        },
        {
          clamp: 11,
          entity: secondary,
          name: "Preserved second clamp",
          circuit: "11",
          unit: "auto",
          breaker_type: "single",
        },
        {
          clamp: 12,
          entity: oppositeBottom,
          name: "Opposite bottom",
          circuit: "12",
          unit: "auto",
          breaker_type: "single",
        },
      ],
    });
    card._hass = {
      locale: { language: "en-US" },
      states: {
        [primary]: stateObject("2838.4", "A⁄C Power", {
          unit_of_measurement: "W",
        }),
        [secondary]: stateObject("999.9", "Second Power", {
          unit_of_measurement: "W",
        }),
        [oppositeTop]: stateObject("10", "Opposite Top", {
          unit_of_measurement: "W",
        }),
        [oppositeBottom]: stateObject("12", "Opposite Bottom", {
          unit_of_measurement: "W",
        }),
      },
    };
    const opened = [];
    card._openMoreInfo = (entityId) => opened.push(entityId);
    const panel = card._renderPanel();
    const combined = findElements(
      panel,
      (element) => element.className === "breaker left branch-double"
    );
    assert.equal(combined.length, 1);
    assert.equal(combined[0].style.gridRow, "5 / span 2");
    assert.equal(combined[0].style.gridColumn, undefined);
    assert.equal(
      findElements(combined[0], (element) =>
        String(element.className || "").includes("branch-double-pole ")
      ).length,
      2
    );
    const handles = findElements(
      combined[0],
      (element) => element.className === "branch-pole-handle"
    );
    assert.equal(handles.length, 2);
    assert.equal(
      findElements(
        combined[0],
        (element) => element.className === "branch-handle-tie"
      ).length,
      1
    );
    assert.equal(
      findElements(combined[0], (element) => element.className === "circuit")[0]
        .textContent,
      "CIRCUIT 9–11"
    );
    assert.equal(
      findElements(combined[0], (element) => element.className === "breaker-name")[0]
        .textContent,
      "A⁄C"
    );
    assert.equal(
      findElements(combined[0], (element) => element.className === "breaker-state")
        .length,
      1
    );
    assert.equal(
      findElements(combined[0], (element) => element.className === "breaker-rating")[0]
        .textContent,
      "30 A"
    );
    assert.equal(
      findElements(combined[0], (element) => element.attributes?.get("role") === "button")
        .length,
      1
    );
    handles[0].dispatch("click");
    handles[1].dispatch("click");
    combined[0].dispatch("keydown", { key: "Enter" });
    combined[0].dispatch("keydown", { key: " " });
    assert.deepEqual(opened, [primary, primary, primary, primary]);
    assert.equal(card._config.clamps[2].entity, secondary);
    assert.equal(card._config.clamps[2].name, "Preserved second clamp");
    const renderedBreakers = findElements(
      panel,
      (element) => String(element.className || "").startsWith("breaker ")
    );
    assert.equal(renderedBreakers.length, 3);
    assert.ok(renderedBreakers.some((element) => element.className === "breaker right"));
    assert.ok(
      renderedBreakers.some((element) => element.style.gridRow === "6")
    );

    const rightDouble = card._renderDoubleClamp(
      {
        clamp: 10,
        entity: oppositeTop,
        name: "Right-side pair",
        circuit: "10",
        icon: "",
        unit: "auto",
        breaker_type: "double",
        breaker_rating: 20,
      },
      10,
      12
    );
    assert.equal(rightDouble.className, "breaker right branch-double");
    assert.equal(rightDouble.style.gridRow, "5 / span 2");
    assert.equal(rightDouble.style.gridColumn, undefined);
  });

  await runAsync("branch double headings support clamp and number-only styles", async () => {
    assert.equal(Card._formatCircuitHeading(9, "", "circuit", 11), "CIRCUIT 9–11");
    assert.equal(Card._formatCircuitHeading(9, "", "clamp", 11), "CLAMP 9–11");
    assert.equal(Card._formatCircuitHeading(9, "", "number", 11), "#9–11");
    assert.equal(Card._formatCircuitHeading(9, "Circuit 7", "circuit", 11), "CIRCUIT 7–9");
    assert.equal(Card._formatCircuitHeading(9, "Kitchen Feed", "number", 11), "Kitchen Feed");
  });

  await runAsync("reverting a branch pair restores both configured tiles", async () => {
    const config = {
      ...emptyConfig(),
      clamps: [
        { clamp: 9, entity: "sensor.nine", breaker_type: "double" },
        {
          clamp: 11,
          entity: "sensor.eleven",
          name: "Still here",
          circuit: "11",
        },
      ],
    };
    const editor = editorHarness(config);
    editor._setClampBreakerSetting(9, "breaker_type", "single");
    assert.equal(editor._config.clamps[0].breaker_type, "single");
    assert.equal(editor._config.clamps[1].entity, "sensor.eleven");
    assert.equal(editor._config.clamps[1].name, "Still here");
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig(editor._config);
    card._hass = {
      states: {
        "sensor.nine": stateObject("9", "Nine", { unit_of_measurement: "W" }),
        "sensor.eleven": stateObject("11", "Eleven", { unit_of_measurement: "W" }),
      },
    };
    card._openMoreInfo = () => {};
    const panel = card._renderPanel();
    assert.equal(
      findElements(panel, (element) => String(element.className).startsWith("breaker "))
        .length,
      2
    );
    assert.equal(
      findElements(
        panel,
        (element) => element.className === "breaker left branch-double"
      )
        .length,
      0
    );
  });

  await runAsync("editor marks consumed positions without deleting their configuration", async () => {
    const config = {
      ...emptyConfig(),
      clamps: [
        { clamp: 9, entity: "sensor.nine", breaker_type: "double" },
        { clamp: 11, entity: "sensor.eleven", name: "Second", circuit: "11" },
      ],
    };
    const editor = editorHarness(config);
    editor._entityChoiceGroups = () => [];
    const section = editor._renderManualEntitySelectors();
    const consumed = findElements(
      section,
      (element) => element.className === "clamp-assignment consumed"
    );
    assert.equal(consumed.length, 1);
    const status = findElements(
      consumed[0],
      (element) => String(element.className).startsWith("pairing-status")
    )[0];
    assert.match(status.textContent, /Used by Clamp 9/u);
    const allStatuses = findElements(
      section,
      (element) => String(element.className).startsWith("pairing-status")
    );
    assert.ok(
      allStatuses.some((element) =>
        /Pairs Clamp 9 with Clamp 11/u.test(element.textContent)
      )
    );
    assert.equal(editor._config.clamps[1].entity, "sensor.eleven");
    assert.equal(editor._config.clamps[1].name, "Second");
  });

  await runAsync("auto import creates only single-pole branch breakers", async () => {
    const matches = {
      clamp_1: {
        match: { entity_id: "sensor.imported_one" },
        ambiguous: [],
      },
    };
    const result = Card._applyEntityImport(emptyConfig(), matches, "fill", {
      states: {
        "sensor.imported_one": stateObject("1", "Imported One Power"),
      },
    });
    assert.equal(result.config.clamps[0].breaker_type, "single");
    assert.equal(result.config.clamps[0].poles, 1);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        result.config.clamps[0],
        "circuit_position"
      ),
      false
    );
  });

  await runAsync("panel sizes accept every even value from 8 through 42", async () => {
    const supported = Array.from({ length: 18 }, (_, index) => 8 + index * 2);
    const stub = Card.getStubConfig();
    assert.equal(stub.panel_size, 16);
    assert.equal(stub.show_empty_positions, true);
    assert.equal(stub.clamps.length, 16);
    for (const panelSize of supported) {
      assert.equal(
        Card._normalizeConfig({ ...emptyConfig(), panel_size: panelSize })
          .panel_size,
        panelSize
      );
    }
    for (const invalid of [0, 7, 9, 17, 43, "invalid", null]) {
      assert.equal(
        Card._normalizeConfig({ ...emptyConfig(), panel_size: invalid })
          .panel_size,
        16
      );
    }
  });

  await runAsync("24 and 42 position panels render deterministic odd and even slots", async () => {
    const renderEmptyPanel = (panelSize) => {
      const card = Object.create(Card.prototype);
      card._config = Card._normalizeConfig({
        ...emptyConfig(),
        panel_size: panelSize,
        show_empty_positions: true,
      });
      card._hass = { states: {} };
      return card._renderPanel();
    };
    const panel24 = renderEmptyPanel(24);
    assert.equal(
      findElements(panel24, (element) => element.className === "empty-slot left")
        .length,
      12
    );
    assert.equal(
      findElements(panel24, (element) => element.className === "empty-slot right")
        .length,
      12
    );
    const panel42 = renderEmptyPanel(42);
    assert.equal(
      findElements(panel42, (element) => element.className === "empty-slot left")
        .length,
      21
    );
    assert.equal(
      findElements(panel42, (element) => element.className === "empty-slot right")
        .length,
      21
    );
    const slots = findElements(
      panel42,
      (element) => String(element.className || "").startsWith("empty-slot ")
    );
    assert.ok(slots.every((slot) => !slot.attributes.has("role")));
  });

  await runAsync("clamp identity and physical circuit placement remain independent", async () => {
    const entity = "sensor.clamp_4_ac_power";
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig({
      ...emptyConfig(),
      panel_size: 24,
      show_empty_positions: false,
      numbering_style: "circuit",
      clamps: [
        {
          clamp: 4,
          entity,
          name: "A⁄C",
          circuit: "4",
          circuit_position: 13,
          breaker_type: "single",
        },
      ],
    });
    card._hass = {
      states: {
        [entity]: stateObject("800", "A⁄C Power", {
          unit_of_measurement: "W",
        }),
      },
    };
    card._openMoreInfo = () => {};
    const panel = card._renderPanel();
    const breaker = findElements(
      panel,
      (element) => element.className === "breaker left"
    )[0];
    assert.ok(breaker);
    assert.equal(card._config.clamps[0].clamp, 4);
    assert.equal(card._config.clamps[0].circuit_position, 13);
    assert.equal(breaker.style.gridRow, "7");
    assert.equal(
      findElements(breaker, (element) => element.className === "circuit")[0]
        .textContent,
      "CIRCUIT 13"
    );
  });

  await runAsync("panel-aware two-pole pairing uses physical positions", async () => {
    const plan = Card._branchPairPlan(
      [
        { clamp: 1, circuit_position: 13, breaker_type: "double" },
        { clamp: 2, circuit_position: 22, breaker_type: "double" },
        { clamp: 3, circuit_position: 23, breaker_type: "double" },
      ],
      24
    );
    assert.equal(plan.byClamp.get(1).position, 13);
    assert.equal(plan.byClamp.get(1).paired, 15);
    assert.equal(plan.byClamp.get(2).position, 22);
    assert.equal(plan.byClamp.get(2).paired, 24);
    assert.equal(plan.byClamp.get(3).kind, "single");
    assert.match(plan.byClamp.get(3).warning, /no following same-side/u);
    assert.equal(Card._pairedCircuit(21, 24), 23);
    assert.equal(Card._pairedCircuit(22, 24), 24);
    assert.equal(Card._pairedCircuit(23, 24), null);
  });

  await runAsync("duplicate physical positions are preserved and rendered as a conflict", async () => {
    const clamps = [
      { clamp: 4, entity: "sensor.four", circuit_position: 13 },
      { clamp: 8, entity: "sensor.eight", circuit_position: 13 },
    ];
    const plan = Card._branchPairPlan(clamps, 24, true);
    assert.equal(plan.get(13).kind, "conflict");
    assert.equal(plan.byClamp.get(4).kind, "conflict");
    assert.equal(plan.byClamp.get(8).kind, "conflict");
    assert.match(plan.byClamp.get(4).warning, /multiple clamps/u);

    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig({
      ...emptyConfig(),
      panel_size: 24,
      show_empty_positions: false,
      clamps,
    });
    card._hass = { states: {} };
    const panel = card._renderPanel();
    assert.equal(
      findElements(
        panel,
        (element) => element.className === "empty-slot left conflict"
      ).length,
      1
    );
    assert.equal(
      findElements(panel, (element) => String(element.className).startsWith("breaker "))
        .length,
      0
    );
    const editor = editorHarness({
      ...emptyConfig(),
      panel_size: 24,
      clamps,
    });
    editor._entityChoiceGroups = () => [];
    const editorSection = editor._renderManualEntitySelectors();
    assert.equal(
      findElements(
        editorSection,
        (element) => element.className === "pairing-status warning"
      ).filter((element) => /multiple clamps/u.test(element.textContent)).length,
      2
    );
  });

  await runAsync("consumed physical positions preserve configuration and restore on single", async () => {
    const owner = "sensor.owner";
    const consumed = "sensor.consumed";
    const config = {
      ...emptyConfig(),
      panel_size: 24,
      show_empty_positions: false,
      clamps: [
        {
          clamp: 4,
          entity: owner,
          circuit_position: 13,
          breaker_type: "double",
        },
        {
          clamp: 7,
          entity: consumed,
          name: "Preserved slot",
          circuit_position: 15,
        },
      ],
    };
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig(config);
    card._hass = {
      states: {
        [owner]: stateObject("100", "Owner", { unit_of_measurement: "W" }),
        [consumed]: stateObject("50", "Consumed", { unit_of_measurement: "W" }),
      },
    };
    card._openMoreInfo = () => {};
    let panel = card._renderPanel();
    assert.equal(
      findElements(
        panel,
        (element) => element.className === "breaker left branch-double"
      ).length,
      1
    );
    assert.equal(card._config.clamps[1].entity, consumed);

    const editor = editorHarness(config);
    editor._setClampBreakerSetting(4, "breaker_type", "single");
    card._config = Card._normalizeConfig(editor._config);
    panel = card._renderPanel();
    assert.equal(
      findElements(panel, (element) => String(element.className).startsWith("breaker "))
        .length,
      2
    );
    assert.equal(editor._config.clamps[1].circuit_position, 15);
    assert.equal(editor._config.clamps[1].name, "Preserved slot");
  });

  await runAsync("panel reduction preserves out-of-range placement and editor warning", async () => {
    const config = {
      ...emptyConfig(),
      panel_size: 24,
      clamps: [
        {
          clamp: 4,
          entity: "sensor.four",
          circuit_position: 23,
        },
      ],
    };
    const editor = editorHarness(config);
    assert.equal(editor._setDisplaySetting("panel_size", "16"), true);
    assert.equal(editor._config.clamps[0].circuit_position, 23);
    const reduced = Card._branchPairPlan(editor._config.clamps, 16);
    assert.equal(reduced.byClamp.get(4).kind, "invalid");
    assert.match(reduced.byClamp.get(4).warning, /outside the selected/u);
    editor._entityChoiceGroups = () => [];
    const reducedEditor = editor._renderManualEntitySelectors();
    assert.ok(
      findElements(
        reducedEditor,
        (element) => element.className === "pairing-status warning"
      ).some((element) => /outside the selected/u.test(element.textContent))
    );
    const select = editor._createCircuitPositionSelect(
      4,
      editor._config.clamps[0]
    ).children[0];
    assert.equal(select.value, "23");
    assert.match(
      select.children.find((option) => option.value === "23").textContent,
      /outside panel/u
    );
    assert.equal(editor._setDisplaySetting("panel_size", "24"), true);
    const expanded = editor._createCircuitPositionSelect(
      4,
      editor._config.clamps[0]
    ).children[0];
    assert.equal(expanded.children.length, 24);
    assert.equal(expanded.value, "23");
  });

  await runAsync("filler visibility does not change physical breaker ordering", async () => {
    const entity = "sensor.position_13";
    const makeCard = (showEmpty) => {
      const card = Object.create(Card.prototype);
      card._config = Card._normalizeConfig({
        ...emptyConfig(),
        panel_size: 24,
        show_empty_positions: showEmpty,
        clamps: [
          { clamp: 1, entity, circuit_position: 13, breaker_type: "single" },
        ],
      });
      card._hass = {
        states: {
          [entity]: stateObject("13", "Position 13", {
            unit_of_measurement: "W",
          }),
        },
      };
      card._openMoreInfo = () => {};
      return card;
    };
    const shown = makeCard(true)._renderPanel();
    assert.equal(
      findElements(shown, (element) => String(element.className).startsWith("empty-slot "))
        .length,
      23
    );
    const hidden = makeCard(false)._renderPanel();
    assert.equal(
      findElements(hidden, (element) => String(element.className).startsWith("empty-slot "))
        .length,
      0
    );
    const breaker = findElements(
      hidden,
      (element) => element.className === "breaker left"
    )[0];
    assert.equal(breaker.style.gridRow, "7");
  });

  await runAsync("tandem breaker type is normalized without changing the 16-clamp limit", async () => {
    const normalized = Card._normalizeConfig({
      ...emptyConfig(),
      clamps: [
        {
          clamp: 4,
          entity: "sensor.primary",
          breaker_type: "tandem",
          tandem_entity: "sensor.secondary",
        },
      ],
    });
    assert.equal(normalized.clamps[0].breaker_type, "tandem");
    assert.equal(normalized.clamps[0].tandem_entity, "sensor.secondary");
    assert.equal(Card.getStubConfig().clamps.length, 16);
    assert.ok(
      Card.getStubConfig().clamps.every(
        (clamp) => clamp.breaker_type === "single"
      )
    );
  });

  await runAsync("tandem occupies one position and remains valid at either final slot", async () => {
    const plan = Card._branchPairPlan(
      [
        {
          clamp: 4,
          circuit_position: 7,
          breaker_type: "tandem",
          entity: "sensor.seven_a",
          tandem_entity: "sensor.seven_b",
        },
        {
          clamp: 5,
          circuit_position: 9,
          entity: "sensor.nine",
        },
        {
          clamp: 6,
          circuit_position: 23,
          breaker_type: "tandem",
          entity: "sensor.twenty_three_a",
          tandem_entity: "sensor.twenty_three_b",
        },
        {
          clamp: 7,
          circuit_position: 24,
          breaker_type: "tandem",
          entity: "sensor.twenty_four_a",
          tandem_entity: "sensor.twenty_four_b",
        },
      ],
      24
    );
    assert.equal(plan.get(7).kind, "single");
    assert.equal(plan.get(9).kind, "single");
    assert.equal(plan.get(23).kind, "single");
    assert.equal(plan.get(24).kind, "single");
    assert.equal(plan.panelSize, 24);
  });

  await runAsync("tandem renders independent A and B halves, values, ratings, and controls", async () => {
    const primary = "sensor.bathroom_power";
    const secondary = "sensor.entry_lights_power";
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig({
      ...emptyConfig(),
      panel_size: 24,
      show_empty_positions: false,
      numbering_style: "circuit",
      measurement_decimals: 1,
      clamps: [
        {
          clamp: 4,
          circuit_position: 7,
          breaker_type: "tandem",
          entity: primary,
          name: "Bathroom",
          icon: "mdi:shower",
          breaker_rating: 15,
          tandem_entity: secondary,
          tandem_name: "Entry Lights",
          tandem_icon: "mdi:lightbulb",
          tandem_unit: "auto",
          tandem_breaker_rating: 20,
        },
      ],
    });
    card._hass = {
      states: {
        [primary]: stateObject("120.04", "Bathroom Power", {
          unit_of_measurement: "W",
        }),
        [secondary]: stateObject("35.06", "Entry Lights Power", {
          unit_of_measurement: "W",
        }),
      },
    };
    const opened = [];
    card._openMoreInfo = (entityId) => opened.push(entityId);
    const panel = card._renderPanel();
    const shell = findElements(
      panel,
      (element) => element.className === "breaker left tandem-shell"
    )[0];
    assert.ok(shell);
    assert.equal(shell.style.gridRow, "4");
    const halves = findElements(
      shell,
      (element) => String(element.className).startsWith("tandem-half ")
    );
    assert.equal(halves.length, 2);
    const divider = findElements(
      shell,
      (element) => element.className === "tandem-divider"
    );
    assert.equal(divider.length, 1);
    assert.equal(divider[0].attributes.has("role"), false);
    assert.equal(
      findElements(shell, (element) => element.className === "tandem-handle")
        .length,
      2
    );
    assert.equal(
      findElements(shell, (element) => element.className === "branch-handle-tie")
        .length,
      0
    );
    assert.deepEqual(
      findElements(shell, (element) => element.className === "tandem-heading").map(
        (element) => element.textContent
      ),
      ["CIRCUIT 7A", "CIRCUIT 7B"]
    );
    assert.deepEqual(
      findElements(shell, (element) => String(element.className).startsWith("tandem-state")).map(
        (element) => element.children[0].textContent
      ),
      ["120", "35.1"]
    );
    assert.deepEqual(
      findElements(shell, (element) => element.className === "tandem-rating").map(
        (element) => element.textContent
      ),
      ["15 A", "20 A"]
    );
    assert.equal(
      findElements(shell, (element) => element.attributes?.get("role") === "button")
        .length,
      2
    );
    halves[0].dispatch("click", { bubbles: false });
    halves[1].dispatch("click", { bubbles: false });
    halves[0].dispatch("keydown", { key: "Enter", bubbles: false });
    halves[1].dispatch("keydown", { key: " ", bubbles: false });
    assert.deepEqual(opened, [primary, secondary, primary, secondary]);
  });

  await runAsync("tandem headings support all numbering styles", async () => {
    assert.equal(Card._formatTandemHeading(7, "A", "circuit"), "CIRCUIT 7A");
    assert.equal(Card._formatTandemHeading(7, "B", "circuit"), "CIRCUIT 7B");
    assert.equal(Card._formatTandemHeading(7, "A", "clamp"), "CLAMP 7A");
    assert.equal(Card._formatTandemHeading(7, "B", "clamp"), "CLAMP 7B");
    assert.equal(Card._formatTandemHeading(7, "A", "number"), "#7A");
    assert.equal(Card._formatTandemHeading(7, "B", "number"), "#7B");
  });

  await runAsync("missing tandem secondary renders a noninteractive warning half", async () => {
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig({
      ...emptyConfig(),
      show_empty_positions: false,
      clamps: [
        {
          clamp: 3,
          entity: "sensor.upper",
          breaker_type: "tandem",
        },
      ],
    });
    card._hass = {
      states: {
        "sensor.upper": stateObject("10", "Upper Power", {
          unit_of_measurement: "W",
        }),
      },
    };
    card._openMoreInfo = () => {};
    const shell = findElements(
      card._renderPanel(),
      (element) => String(element.className).includes("tandem-shell")
    )[0];
    assert.ok(shell);
    assert.equal(
      findElements(shell, (element) => element.attributes?.get("role") === "button")
        .length,
      1
    );
    assert.ok(
      findElements(shell, (element) => element.textContent === "Not configured")
        .length >= 2
    );
    const plan = Card._branchPairPlan(card._config.clamps, 16);
    assert.match(plan.get(3).warning, /second circuit is not configured/u);
  });

  await runAsync("breaker type changes preserve hidden tandem fields and release paired slots", async () => {
    const config = {
      ...emptyConfig(),
      clamps: [
        {
          clamp: 7,
          entity: "sensor.primary",
          breaker_type: "tandem",
          tandem_entity: "sensor.secondary",
          tandem_name: "Second",
          tandem_icon: "mdi:lamp",
          tandem_unit: "kW",
          tandem_breaker_rating: 20,
        },
        { clamp: 9, entity: "sensor.position_nine", name: "Preserved" },
      ],
    };
    const editor = editorHarness(config);
    for (const type of ["single", "double", "tandem"]) {
      editor._setClampBreakerSetting(7, "breaker_type", type);
      const owner = editor._config.clamps.find((clamp) => clamp.clamp === 7);
      assert.equal(owner.tandem_entity, "sensor.secondary");
      assert.equal(owner.tandem_name, "Second");
      assert.equal(owner.tandem_icon, "mdi:lamp");
      assert.equal(owner.tandem_unit, "kW");
      assert.equal(owner.tandem_breaker_rating, 20);
      const plan = Card._branchPairPlan(editor._config.clamps);
      assert.equal(
        plan.get(9).kind,
        type === "double" ? "consumed" : "single"
      );
    }
    assert.equal(editor._config.clamps[1].entity, "sensor.position_nine");
    assert.equal(editor._config.clamps[1].name, "Preserved");
  });

  await runAsync("editor shows device-aware tandem controls only for tandem breakers", async () => {
    const config = {
      ...emptyConfig(),
      clamps: [
        {
          clamp: 4,
          entity: "sensor.primary",
          breaker_type: "tandem",
          tandem_entity: "sensor.external_secondary",
          tandem_name: "Second",
          tandem_icon: "mdi:lamp",
          tandem_unit: "W",
          tandem_breaker_rating: 15,
        },
        { clamp: 5, entity: "sensor.single", breaker_type: "single" },
      ],
    };
    const editor = editorHarness(config);
    const calls = [];
    editor._entityChoiceGroups = (field, configured) => {
      calls.push([field, configured]);
      return [];
    };
    const section = editor._renderManualEntitySelectors();
    const tandemSections = findElements(
      section,
      (element) => element.className === "tandem-secondary"
    );
    assert.equal(tandemSections.length, 1);
    assert.equal(
      findElements(
        tandemSections[0],
        (element) => element.dataset?.entityField === "tandem_entity"
      ).length,
      1
    );
    assert.ok(
      calls.some(
        ([field, configured]) =>
          field === "tandem_entity" && configured === "sensor.external_secondary"
      )
    );
    assert.equal(
      findElements(
        tandemSections[0],
        (element) => element.dataset?.breakerField === "tandem_unit"
      ).length,
      1
    );
    assert.equal(
      findElements(
        tandemSections[0],
        (element) => element.dataset?.breakerField === "tandem_breaker_rating"
      ).length,
      1
    );
    assert.equal(
      editor._commitTextDraft(4, "tandem_name", "Entry Lighting"),
      true
    );
    assert.equal(editor._config.clamps[0].tandem_name, "Entry Lighting");

    calls.length = 0;
    editor._warmEntityChoiceCache();
    assert.ok(
      calls.some(
        ([field, configured]) =>
          field === "tandem_entity" && configured === "sensor.external_secondary"
      )
    );
  });

  await runAsync("tandem selector reuses selected-device and show-all filtering", async () => {
    const entries = [
      registryEntry("sensor.selected_power", "Selected Power", {
        device_id: DEVICE_ID,
        original_device_class: "power",
      }),
      registryEntry("sensor.other_power", "Other Power", {
        device_id: "other-device",
        original_device_class: "power",
      }),
      registryEntry("sensor.diagnostic_power", "Diagnostic Power", {
        device_id: DEVICE_ID,
        original_device_class: "power",
        entity_category: "diagnostic",
      }),
    ];
    const hass = {
      states: {
        "sensor.selected_power": stateObject("1", "Selected Power", {
          device_class: "power",
          unit_of_measurement: "W",
        }),
        "sensor.other_power": stateObject("2", "Other Power", {
          device_class: "power",
          unit_of_measurement: "W",
        }),
        "sensor.diagnostic_power": stateObject("3", "Diagnostic Power", {
          device_class: "power",
          unit_of_measurement: "W",
          entity_category: "diagnostic",
        }),
      },
    };
    const selectedOnly = Card._buildEntityChoiceGroups(
      entries,
      [{ id: "other-device", name: "Other" }],
      hass,
      DEVICE_ID,
      false,
      "tandem_entity"
    ).flatMap((group) => group.options.map((option) => option.value));
    assert.deepEqual(selectedOnly, ["sensor.selected_power"]);
    const showAll = Card._buildEntityChoiceGroups(
      entries,
      [{ id: "other-device", name: "Other" }],
      hass,
      DEVICE_ID,
      true,
      "tandem_entity"
    ).flatMap((group) => group.options.map((option) => option.value));
    assert.ok(showAll.includes("sensor.selected_power"));
    assert.ok(showAll.includes("sensor.other_power"));
    assert.ok(!showAll.includes("sensor.diagnostic_power"));
  });

  await runAsync("duplicate tandem entities warn without erasing assignments", async () => {
    const plan = Card._branchPairPlan([
      {
        clamp: 4,
        entity: "sensor.same",
        tandem_entity: "sensor.same",
        breaker_type: "tandem",
      },
    ]);
    assert.match(plan.get(4).warning, /same entity/u);
    assert.equal(plan.get(4).clamp.entity, "sensor.same");
    assert.equal(plan.get(4).clamp.tandem_entity, "sensor.same");
  });

  await runAsync("tandem CSS provides a divided compact tile with unlinked handles", async () => {
    const source = fs.readFileSync(
      path.join(__dirname, "sem-electric-panel-card.js"),
      "utf8"
    );
    assert.match(source, /\.breaker\.tandem-shell\s*\{/u);
    assert.match(source, /\.tandem-divider\s*\{[\s\S]*?height:\s*1px/u);
    assert.match(source, /\.tandem-divider\s*\{[\s\S]*?pointer-events:\s*none/u);
    assert.match(source, /\.tandem-handle\s*\{/u);
    assert.doesNotMatch(source, /tandem-handle-tie/u);
    assert.doesNotMatch(source, /overflow-x:\s*(?:auto|scroll)/u);
  });

  await runAsync("branch double CSS remains compact responsive and non-scrolling", async () => {
    const source = fs.readFileSync(
      path.join(__dirname, "sem-electric-panel-card.js"),
      "utf8"
    );
    assert.doesNotMatch(source, /\.breaker\.branch-double\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1/u);
    assert.match(source, /breaker\.style\.gridRow\s*=\s*`\$\{row\}\s*\/\s*span\s*2`/u);
    assert.match(source, /\.branch-double-pole\.bottom\s*\{[\s\S]*?border-top:\s*1px/u);
    assert.match(source, /\.branch-pole-handle\s*\{/u);
    assert.match(source, /\.branch-handle-tie\s*\{/u);
    assert.doesNotMatch(source, /overflow-x:\s*(?:auto|scroll)/u);
  });

  await runAsync("panel positions normalize independently through position 42", async () => {
    const source = {
      ...emptyConfig(),
      panel_size: 42,
      panel_positions: [
        { position: 17, entity: "sensor.garage", future_field: "kept" },
        { position: 24, entity: "sensor.last_even" },
        { position: 42, entity: "sensor.last" },
        { position: 42, entity: "sensor.duplicate" },
        { position: 43, entity: "sensor.invalid" },
      ],
    };
    const normalized = Card._normalizeConfig(source);
    assert.deepEqual(
      normalized.panel_positions.map((entry) => entry.position),
      [17, 24, 42]
    );
    assert.equal(normalized.panel_positions[0].future_field, "kept");
    assert.equal(normalized.clamps.length, 0);
    assert.equal(source.panel_positions.length, 5);
  });

  await runAsync("configurations without panel positions retain legacy clamp placement", async () => {
    const clamps = [
      { clamp: 1, entity: "sensor.one", breaker_type: "double" },
      { clamp: 3, entity: "sensor.three" },
      { clamp: 6, entity: "sensor.six" },
    ];
    const legacy = Card._branchPairPlan(clamps, 24, true);
    const combined = Card._physicalPositionPlan(clamps, [], 24, true);
    assert.deepEqual([...combined.keys()], [...legacy.keys()]);
    for (const position of legacy.keys()) {
      assert.equal(combined.get(position).kind, legacy.get(position).kind);
      assert.equal(combined.get(position).owner, legacy.get(position).owner);
    }
  });

  await runAsync("explicit positions win clamp conflicts without deleting either source", async () => {
    const clamp = {
      clamp: 4,
      circuit_position: 17,
      entity: "sensor.clamp_four",
      name: "Clamp-backed",
    };
    const explicit = {
      position: 17,
      entity: "sensor.explicit",
      name: "Garage Lights",
    };
    const plan = Card._physicalPositionPlan([clamp], [explicit], 24);
    assert.equal(plan.get(17).source, "panel_position");
    assert.equal(plan.get(17).item.entity, "sensor.explicit");
    assert.equal(plan.get(17).assignedClamps[0].entity, "sensor.clamp_four");
    assert.equal(plan.get(17).conflict, true);
    assert.match(plan.get(17).warning, /explicit override.*Clamp 4/iu);
    assert.equal(Card._physicalPositionStatus(plan, 17), "Conflict");
  });

  await runAsync("combined placement handles two-pole and tandem positions above 16", async () => {
    for (const start of [17, 18]) {
      const plan = Card._physicalPositionPlan(
        [],
        [{ position: start, entity: `sensor.double_${start}`, breaker_type: "double" }],
        24
      );
      assert.equal(plan.get(start).kind, "owner");
      assert.equal(plan.get(start).paired, start + 2);
      assert.equal(plan.get(start + 2).kind, "consumed");
      assert.equal(
        Card._physicalPositionStatus(plan, start + 2),
        `Used as second pole by Position ${start}`
      );
    }
    const tandem = Card._physicalPositionPlan(
      [],
      [{ position: 24, entity: "sensor.upper", tandem_entity: "sensor.lower", breaker_type: "tandem" }],
      24
    );
    assert.equal(tandem.get(24).kind, "single");
    assert.equal(Card._physicalPositionStatus(tandem, 24), "Tandem");
  });

  await runAsync("card renders explicit, clamp-backed, and filler positions by priority", async () => {
    const card = Object.create(Card.prototype);
    card._config = Card._normalizeConfig({
      ...emptyConfig(),
      panel_size: 24,
      clamps: [{ clamp: 4, circuit_position: 13, entity: "sensor.clamp" }],
      panel_positions: [{ position: 17, entity: "sensor.position" }],
    });
    card._hass = {
      states: {
        "sensor.clamp": stateObject("4", "Clamp Power", { unit_of_measurement: "W" }),
        "sensor.position": stateObject("17", "Position Power", { unit_of_measurement: "W" }),
      },
    };
    card._openMoreInfo = () => {};
    const panel = card._renderPanel();
    assert.ok(findElements(panel, (element) => element.attributes?.get("aria-label")?.includes("Circuit 13")).length);
    assert.ok(findElements(panel, (element) => element.attributes?.get("aria-label")?.includes("Circuit 17")).length);
    assert.ok(findElements(panel, (element) => element.className === "empty-slot right" && element.textContent === "24").length);
  });

  await runAsync("editor position model lists panel size, preserves out-of-range entries, and clears empty entries", async () => {
    const editor = editorHarness({
      ...emptyConfig(),
      panel_size: 24,
      panel_positions: [{ position: 30, entity: "sensor.saved" }],
    });
    editor._selectedPanelPosition = 17;
    editor._entityChoiceGroups = () => [];
    let section = editor._renderPhysicalPanelPositions();
    let picker = findElements(section, (element) => element.dataset?.physicalPositionPicker !== undefined)[0];
    assert.ok(picker);
    assert.equal(picker.children.length, 25);
    assert.equal(picker.children[16].textContent, "17 — Empty");
    assert.equal(picker.children.at(-1).textContent, "30 — Out of range");

    editor._setPanelPositionField(17, "entity", "sensor.independent");
    assert.equal(editor._config.panel_positions.find((entry) => entry.position === 17).entity, "sensor.independent");
    assert.equal(editor._config.clamps.length, 0);
    editor._setPanelPositionField(17, "entity", "");
    assert.equal(editor._config.panel_positions.some((entry) => entry.position === 17), false);

    editor._config.panel_size = 42;
    section = editor._renderPhysicalPanelPositions();
    picker = findElements(section, (element) => element.dataset?.physicalPositionPicker !== undefined)[0];
    assert.equal(picker.children.length, 42);
  });

  await runAsync("physical position editor reuses entity groups and exposes tandem fields", async () => {
    const editor = editorHarness({
      ...emptyConfig(),
      panel_size: 24,
      panel_positions: [{
        position: 23,
        entity: "sensor.primary",
        breaker_type: "tandem",
        tandem_entity: "sensor.external_secondary",
      }],
    });
    editor._selectedPanelPosition = 23;
    const calls = [];
    editor._entityChoiceGroups = (field, configured) => {
      calls.push([field, configured]);
      return [];
    };
    const section = editor._renderPhysicalPanelPositions();
    assert.ok(calls.some(([field, value]) => field === "entity" && value === "sensor.primary"));
    assert.ok(calls.some(([field, value]) => field === "tandem_entity" && value === "sensor.external_secondary"));
    assert.equal(findElements(section, (element) => element.dataset?.panelField === "tandem_entity").length, 0);
    assert.equal(findElements(section, (element) => element.dataset?.entityField === "tandem_entity" && element.dataset?.panelPosition === "23").length, 1);
  });

  await runAsync("auto import never creates or changes panel position entries", async () => {
    const config = {
      ...emptyConfig(),
      panel_positions: [{ position: 17, entity: "sensor.manual" }],
    };
    const result = Card._applyEntityImport(config, {}, "fill", { states: {} });
    assert.deepEqual(result.config.panel_positions, config.panel_positions);
    assert.ok(result.config.clamps.length <= 16);
  });

  console.log("[PASS] all SEM Electric Panel Card importer/editor tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
