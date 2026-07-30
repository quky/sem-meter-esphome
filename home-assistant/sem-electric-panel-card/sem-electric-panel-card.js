(() => {
  "use strict";

  const CARD_TAG = "sem-electric-panel-card";
  const EDITOR_TAG = "sem-electric-panel-card-editor";
  const CARD_TYPE = "custom:sem-electric-panel-card";
  const MAX_CLAMPS = 16;
  const VALID_UNITS = new Set(["auto", "W", "kW", "A"]);
  const IMPORT_FILL = "fill";
  const IMPORT_REPLACE = "replace";

  const STYLE = `
    :host {
      display: block;
      min-width: 260px;
    }

    ha-card {
      display: block;
      overflow: hidden;
      color: var(--primary-text-color);
      background: var(--ha-card-background, var(--card-background-color, #fff));
    }

    .card-title {
      padding: 16px 18px 4px;
      font-size: 1.25rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .content {
      padding: 12px 16px 18px;
    }

    .main-breaker {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      min-height: 132px;
      padding: 18px 16px;
      border: 1px solid var(--divider-color, #d5d5d5);
      border-left: 6px solid var(--primary-color, #03a9f4);
      border-radius: 12px;
      background: color-mix(
        in srgb,
        var(--primary-color, #03a9f4) 7%,
        var(--ha-card-background, var(--card-background-color, #fff))
      );
      text-align: center;
      outline: none;
    }

    .main-breaker.interactive,
    .breaker {
      cursor: pointer;
    }

    .main-breaker.interactive:hover,
    .breaker:hover {
      background: color-mix(
        in srgb,
        var(--primary-color, #03a9f4) 11%,
        var(--ha-card-background, var(--card-background-color, #fff))
      );
    }

    .main-breaker:focus-visible,
    .breaker:focus-visible {
      box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--primary-color, #03a9f4) 45%, transparent);
    }

    .main-heading {
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.11em;
      color: var(--secondary-text-color);
    }

    .main-name {
      margin-top: 3px;
      overflow: hidden;
      font-size: 1.05rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .main-total {
      margin-top: 12px;
      font-size: 1.45rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .main-lines {
      margin-top: 7px;
      color: var(--secondary-text-color);
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
    }

    .balance {
      margin-top: 9px;
      font-size: 0.86rem;
      font-weight: 600;
    }

    .balance.balanced {
      color: var(--primary-color, #03a9f4);
    }

    .balance.slight {
      color: var(--warning-color, #ff9800);
    }

    .balance.unbalanced {
      color: var(--error-color, #db4437);
    }

    .balance.unavailable {
      color: var(--secondary-text-color);
      font-weight: 400;
    }

    .panel {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
      grid-auto-rows: minmax(58px, auto);
      gap: 8px 4px;
      margin-top: 16px;
    }

    .panel::before {
      position: absolute;
      z-index: 0;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 4px;
      border-radius: 2px;
      background: var(--divider-color, #d5d5d5);
      content: "";
      transform: translateX(-50%);
    }

    .breaker {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) auto;
      align-items: center;
      box-sizing: border-box;
      min-width: 0;
      min-height: 58px;
      padding: 8px 10px;
      border: 1px solid var(--divider-color, #d5d5d5);
      border-radius: 8px;
      background: var(--ha-card-background, var(--card-background-color, #fff));
      outline: none;
      transition: background 120ms ease, box-shadow 120ms ease;
    }

    .breaker.left {
      grid-column: 1;
      border-right: 4px solid var(--primary-color, #03a9f4);
    }

    .breaker.right {
      grid-column: 3;
      border-left: 4px solid var(--primary-color, #03a9f4);
    }

    .breaker.double-pole {
      min-height: 72px;
    }

    .pole-link {
      position: absolute;
      top: 9px;
      bottom: 9px;
      width: 4px;
      border: 1px solid var(--secondary-text-color);
      border-radius: 3px;
      opacity: 0.7;
    }

    .left .pole-link {
      right: 5px;
    }

    .right .pole-link {
      left: 5px;
    }

    ha-icon {
      color: var(--secondary-text-color);
      --mdc-icon-size: 21px;
    }

    .breaker-copy {
      min-width: 0;
      padding-right: 6px;
    }

    .circuit {
      overflow: hidden;
      color: var(--secondary-text-color);
      font-size: 0.7rem;
      font-weight: 600;
      line-height: 1.2;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .breaker-name {
      overflow: hidden;
      margin-top: 2px;
      font-size: 0.88rem;
      font-weight: 500;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .breaker-state {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      min-width: 48px;
      font-size: 0.92rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .breaker-state.unavailable {
      color: var(--secondary-text-color);
      font-size: 0.76rem;
      font-weight: 400;
    }

    .unit {
      margin-left: 3px;
      color: var(--secondary-text-color);
      font-size: 0.72em;
      font-weight: 500;
    }

    .empty-panel {
      grid-column: 1 / 4;
      padding: 18px 8px 6px;
      color: var(--secondary-text-color);
      text-align: center;
    }

    @media (max-width: 480px) {
      .card-title {
        padding: 13px 12px 2px;
        font-size: 1.08rem;
      }

      .content {
        padding: 10px 9px 13px;
      }

      .main-breaker {
        min-height: 118px;
        padding: 14px 10px;
      }

      .main-total {
        font-size: 1.18rem;
      }

      .main-lines {
        font-size: 0.82rem;
      }

      .panel {
        grid-template-columns: minmax(0, 1fr) 8px minmax(0, 1fr);
        gap: 6px 2px;
      }

      .breaker {
        grid-template-columns: 22px minmax(0, 1fr) auto;
        min-height: 54px;
        padding: 6px 6px;
      }

      .breaker.double-pole {
        min-height: 66px;
      }

      .breaker-name {
        font-size: 0.78rem;
      }

      .circuit {
        font-size: 0.64rem;
      }

      .breaker-state {
        min-width: 40px;
        font-size: 0.79rem;
      }

      ha-icon {
        --mdc-icon-size: 18px;
      }
    }
  `;

  class SemElectricPanelCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = null;
      this._hass = null;
    }

    static getStubConfig() {
      return {
        title: "Electrical Panel",
        device_id: "",
        main: {
          name: "Main Breaker",
          power_entity: "",
          current_entity: "",
          line_1_entity: "",
          line_2_entity: "",
        },
        clamps: Array.from({ length: MAX_CLAMPS }, (_, index) => ({
          clamp: index + 1,
          entity: "",
          name: "",
          circuit: "",
          icon: "",
          unit: "auto",
          poles: 1,
        })),
      };
    }

    static getConfigForm() {
      return this._buildConfigForm(null, null, true);
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static _buildConfigForm(config, hass, includeDevice) {
      const entitySelector = {
        entity: {
          filter: {
            domain: "sensor",
          },
        },
      };

      const clampSections = Array.from(
        { length: MAX_CLAMPS },
        (_, index) => {
          const clampNumber = index + 1;
          const clamp = this._editorClamp(config, clampNumber);
          const friendlyName =
            this._cleanText(clamp?.name) ||
            this._friendlyEntityLabel(hass, this._cleanText(clamp?.entity));
          return {
            type: "expandable",
            name: String(index),
            title: friendlyName
              ? `Clamp ${clampNumber} — ${friendlyName}`
              : `Clamp ${clampNumber}`,
            icon: "mdi:current-ac",
            schema: [
              {
                name: "clamp",
                type: "integer",
                default: clampNumber,
                disabled: true,
              },
              { name: "entity", selector: entitySelector },
              { name: "name", selector: { text: {} } },
              { name: "circuit", selector: { text: {} } },
              {
                name: "icon",
                selector: { icon: {} },
                context: { icon_entity: "entity" },
              },
              {
                name: "unit",
                selector: {
                  select: {
                    mode: "dropdown",
                    options: [
                      { value: "auto", label: "Automatic" },
                      { value: "W", label: "Watts (W)" },
                      { value: "kW", label: "Kilowatts (kW)" },
                      { value: "A", label: "Amperes (A)" },
                    ],
                  },
                },
                default: "auto",
              },
              {
                name: "poles",
                selector: {
                  select: {
                    mode: "dropdown",
                    options: [
                      { value: 1, label: "Single-pole" },
                      { value: 2, label: "Double-pole" },
                    ],
                  },
                },
                default: 1,
              },
            ],
          };
        }
      );

      const labels = {
        device_id: "Home Assistant device",
        title: "Card title",
        name: "Display name",
        power_entity: "Total power entity",
        current_entity: "Total current entity",
        line_1_entity: "Line 1 power entity",
        line_2_entity: "Line 2 power entity",
        entity: "Entity",
        circuit: "Circuit number or label",
        icon: "Icon",
        unit: "Display unit",
        poles: "Pole count",
        clamp: "SEM clamp number",
      };

      const schema = [];
      if (includeDevice) {
        schema.push({
          type: "expandable",
          name: "",
          title: "SEM Meter Device",
          icon: "mdi:devices",
          flatten: true,
          schema: [{ name: "device_id", selector: { device: {} } }],
        });
      }
      schema.push(
        {
          type: "expandable",
          name: "",
          title: "General",
          icon: "mdi:view-dashboard-outline",
          flatten: true,
          schema: [{ name: "title", selector: { text: {} } }],
        },
        {
          type: "expandable",
          name: "main",
          title: "Main Breaker",
          icon: "mdi:electric-switch",
          schema: [
            { name: "name", selector: { text: {} } },
            { name: "power_entity", selector: entitySelector },
            { name: "current_entity", selector: entitySelector },
            { name: "line_1_entity", selector: entitySelector },
            { name: "line_2_entity", selector: entitySelector },
          ],
        },
        {
          type: "grid",
          name: "clamps",
          column_min_width: "100%",
          schema: clampSections,
        }
      );

      return {
        schema,
        computeLabel: (schema, _data, options) => {
          const mainFields = {
            power_entity: "Total power entity",
            current_entity: "Total current entity",
            line_1_entity: "Line 1 power entity",
            line_2_entity: "Line 2 power entity",
          };
          if (mainFields[schema.name]) {
            const entityId = this._cleanText(config?.main?.[schema.name]);
            const friendly = this._friendlyEntityLabel(hass, entityId);
            return friendly
              ? `${mainFields[schema.name]} — ${friendly}`
              : mainFields[schema.name];
          }
          if (schema.name === "entity") {
            const path = options?.path || [];
            const clampIndex = Number(path[path.length - 1]);
            const clamp = Number.isInteger(clampIndex)
              ? this._editorClamp(config, clampIndex + 1)
              : null;
            const friendly =
              this._cleanText(clamp?.name) ||
              this._friendlyEntityLabel(
                hass,
                this._cleanText(clamp?.entity)
              );
            return Number.isInteger(clampIndex) && friendly
              ? `Clamp ${clampIndex + 1} — ${friendly}`
              : labels.entity;
          }
          return labels[schema.name];
        },
        computeHelper: (schema, options) => {
          if (schema.name === "device_id") {
            return "Select the Home Assistant device that owns the SEM Meter sensor entities.";
          }
          if (
            [
              "power_entity",
              "current_entity",
              "line_1_entity",
              "line_2_entity",
            ].includes(schema.name)
          ) {
            return this._cleanText(config?.main?.[schema.name]) || undefined;
          }
          if (schema.name === "clamps") {
            return "Configure up to the 16 physical SEM Meter clamps.";
          }
          if (schema.name === "entity") {
            const path = options?.path || [];
            const clampIndex = Number(path[path.length - 1]);
            const clamp = Number.isInteger(clampIndex)
              ? this._editorClamp(config, clampIndex + 1)
              : null;
            return this._cleanText(clamp?.entity) || undefined;
          }
          if (schema.name === "poles") {
            return "Visual metadata only; a double-pole row still uses one clamp.";
          }
          return undefined;
        },
        assertConfig: (config) => {
          if (!config || typeof config !== "object") {
            throw new Error("Card configuration must be an object.");
          }
          if (
            config.clamps !== undefined &&
            !Array.isArray(config.clamps) &&
            (config.clamps === null || typeof config.clamps !== "object")
          ) {
            throw new Error("'clamps' must be a list or indexed object.");
          }
        },
      };
    }

    static _normalizeConfig(config) {
      if (!config || typeof config !== "object") {
        throw new Error("SEM Electric Panel Card requires a configuration.");
      }

      const sourceMain =
        config.main && typeof config.main === "object" ? config.main : {};
      const main = {
        name: this._cleanText(sourceMain.name) || "Main Breaker",
        power_entity: this._cleanText(sourceMain.power_entity),
        current_entity: this._cleanText(sourceMain.current_entity),
        line_1_entity: this._cleanText(sourceMain.line_1_entity),
        line_2_entity: this._cleanText(sourceMain.line_2_entity),
      };

      const sourceClamps =
        Array.isArray(config.clamps) ||
        (config.clamps && typeof config.clamps === "object")
          ? Object.entries(config.clamps)
          : [];
      const seen = new Set();
      const clamps = [];

      for (const [sourceIndex, sourceClamp] of sourceClamps) {
        if (!sourceClamp || typeof sourceClamp !== "object") {
          continue;
        }
        const fallbackNumber = Number(sourceIndex) + 1;
        const clampNumber = Number(
          sourceClamp.clamp === undefined
            ? fallbackNumber
            : sourceClamp.clamp
        );
        if (
          !Number.isInteger(clampNumber) ||
          clampNumber < 1 ||
          clampNumber > MAX_CLAMPS ||
          seen.has(clampNumber)
        ) {
          continue;
        }
        seen.add(clampNumber);

        const requestedUnit = this._cleanText(sourceClamp.unit);
        const poles = Number(sourceClamp.poles) === 2 ? 2 : 1;
        clamps.push({
          clamp: clampNumber,
          entity: this._cleanText(sourceClamp.entity),
          name: this._cleanText(sourceClamp.name),
          circuit: this._cleanText(sourceClamp.circuit),
          icon: this._cleanText(sourceClamp.icon),
          unit: VALID_UNITS.has(requestedUnit) ? requestedUnit : "auto",
          poles,
        });
      }

      clamps.sort((left, right) => left.clamp - right.clamp);
      return {
        type: CARD_TYPE,
        title: this._cleanText(config.title) || "Electrical Panel",
        device_id: this._cleanText(config.device_id),
        main,
        clamps,
      };
    }

    static _editorClamp(config, clampNumber) {
      if (!config || !config.clamps) {
        return null;
      }
      const entries =
        Array.isArray(config.clamps) ||
        (config.clamps && typeof config.clamps === "object")
          ? Object.entries(config.clamps)
          : [];
      for (const [index, clamp] of entries) {
        if (!clamp || typeof clamp !== "object") {
          continue;
        }
        const number = Number(
          clamp.clamp === undefined ? Number(index) + 1 : clamp.clamp
        );
        if (number === clampNumber) {
          return clamp;
        }
      }
      return null;
    }

    static _cleanText(value) {
      return typeof value === "string" ? value.trim() : "";
    }

    static _decimalPlaces(rawState) {
      const match = String(rawState).trim().match(/^[+-]?\d+\.(\d+)$/);
      return match ? Math.min(match[1].length, 2) : 0;
    }

    static _formatNumber(value, unit, rawState) {
      if (unit === "kW" || unit === "A") {
        return value.toFixed(2);
      }
      if (unit === "W") {
        if (Math.abs(value) < 1000 && !Number.isInteger(value)) {
          const decimals = Math.max(1, this._decimalPlaces(rawState));
          return value.toFixed(Math.min(decimals, 2));
        }
        return String(Math.round(value));
      }
      return Number.isInteger(value)
        ? String(value)
        : value.toFixed(2).replace(/\.?0+$/, "");
    }

    static _formatEntity(hass, entityId, requestedUnit = "auto") {
      const safeUnit = VALID_UNITS.has(requestedUnit)
        ? requestedUnit
        : "auto";
      const stateObject =
        hass && hass.states && entityId ? hass.states[entityId] : undefined;
      if (!stateObject || stateObject.state === null) {
        return {
          available: false,
          value: "Unavailable",
          unit: "",
          numeric: null,
        };
      }

      const rawState = String(stateObject.state);
      if (
        rawState.trim() === "" ||
        rawState.toLowerCase() === "unknown" ||
        rawState.toLowerCase() === "unavailable"
      ) {
        return {
          available: false,
          value: "Unavailable",
          unit: "",
          numeric: null,
        };
      }

      const sourceUnit = String(
        stateObject.attributes?.unit_of_measurement || ""
      );
      const numeric = Number(rawState);
      const outputUnit = safeUnit === "auto" ? sourceUnit : safeUnit;
      if (!Number.isFinite(numeric)) {
        return {
          available: true,
          value: rawState,
          unit: outputUnit,
          numeric: null,
        };
      }

      let converted = numeric;
      if (safeUnit === "W" && sourceUnit.toLowerCase() === "kw") {
        converted *= 1000;
      } else if (safeUnit === "kW" && sourceUnit.toLowerCase() === "w") {
        converted /= 1000;
      }

      const formatUnit =
        outputUnit.toLowerCase() === "kw"
          ? "kW"
          : outputUnit.toLowerCase() === "w"
          ? "W"
          : outputUnit.toLowerCase() === "a"
          ? "A"
          : outputUnit;
      return {
        available: true,
        value: this._formatNumber(converted, formatUnit, rawState),
        unit: outputUnit,
        numeric: converted,
      };
    }

    static _powerValue(hass, entityId) {
      const stateObject =
        hass && hass.states && entityId ? hass.states[entityId] : undefined;
      if (!stateObject) {
        return null;
      }
      const numeric = Number(stateObject.state);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      const unit = String(
        stateObject.attributes?.unit_of_measurement || ""
      ).toLowerCase();
      if (unit === "a") {
        return null;
      }
      return unit === "kw" ? numeric * 1000 : numeric;
    }

    static _calculateBalance(line1, line2) {
      if (!Number.isFinite(line1) || !Number.isFinite(line2)) {
        return {
          label: "Balance unavailable",
          percentage: null,
          level: "unavailable",
        };
      }
      const difference = Math.abs(line1 - line2);
      const average = (Math.abs(line1) + Math.abs(line2)) / 2;
      const percentage = average > 0 ? (difference / average) * 100 : 0;
      if (percentage < 15) {
        return { label: "Balanced", percentage, level: "balanced" };
      }
      if (percentage <= 30) {
        return {
          label: "Slightly Unbalanced",
          percentage,
          level: "slight",
        };
      }
      return { label: "Unbalanced", percentage, level: "unbalanced" };
    }

    static _friendlyEntityLabel(hass, entityId) {
      if (!entityId) {
        return "";
      }
      const stateObject = hass?.states?.[entityId];
      if (stateObject && typeof hass?.formatEntityName === "function") {
        try {
          const name = hass.formatEntityName(stateObject);
          if (name) {
            return String(name);
          }
        } catch (_error) {
          // Fall through to stable state and entity-ID labels.
        }
      }
      if (stateObject?.attributes?.friendly_name) {
        return String(stateObject.attributes.friendly_name);
      }
      const objectId = String(entityId).split(".").pop();
      return objectId
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    static _copyConfig(config) {
      const copy = { ...(config || {}) };
      copy.main = { ...(config?.main || {}) };
      if (Array.isArray(config?.clamps)) {
        copy.clamps = config.clamps.map((clamp) =>
          clamp && typeof clamp === "object" ? { ...clamp } : clamp
        );
      } else if (config?.clamps && typeof config.clamps === "object") {
        copy.clamps = Object.fromEntries(
          Object.entries(config.clamps).map(([key, clamp]) => [
            key,
            clamp && typeof clamp === "object" ? { ...clamp } : clamp,
          ])
        );
      } else {
        copy.clamps = [];
      }
      return copy;
    }

    static _normalizeMatchText(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/^sensor[._\s-]+/, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    static _matchStrength(text, pattern) {
      if (!text || !pattern) {
        return 0;
      }
      if (text === pattern) {
        return 300;
      }
      if (text.endsWith(` ${pattern}`)) {
        return 200;
      }
      if (` ${text} `.includes(` ${pattern} `)) {
        return 100;
      }
      return 0;
    }

    static _importRoles() {
      const roles = [
        {
          key: "main_power",
          label: "Main power",
          field: "power_entity",
          patterns: ["main power", "total power", "total main power"],
        },
        {
          key: "main_current",
          label: "Main current",
          field: "current_entity",
          patterns: ["main current", "total current", "total main current"],
        },
        {
          key: "line_1_power",
          label: "Line 1 power",
          field: "line_1_entity",
          patterns: [
            "line 1 power",
            "l1 power",
            "main phase a power",
            "phase a power",
          ],
        },
        {
          key: "line_2_power",
          label: "Line 2 power",
          field: "line_2_entity",
          patterns: [
            "line 2 power",
            "l2 power",
            "main phase b power",
            "phase b power",
          ],
        },
      ];
      for (let clamp = 1; clamp <= MAX_CLAMPS; clamp += 1) {
        roles.push({
          key: `clamp_${clamp}`,
          label: `Clamp ${clamp}`,
          clamp,
          patterns: [
            `clamp ${clamp} power`,
            `ct ${clamp} power`,
            `channel ${clamp} power`,
            `circuit ${clamp} power`,
          ],
        });
      }
      return roles;
    }

    static _scoreRegistryEntry(entry, hass, role) {
      const stateObject = hass?.states?.[entry.entity_id];
      const sources = [
        entry.original_name,
        entry.unique_id,
        stateObject?.attributes?.friendly_name,
        entry.entity_id,
      ];
      let bestScore = 0;
      for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
        const normalized = this._normalizeMatchText(sources[sourceIndex]);
        const sourceScore = (sources.length - sourceIndex) * 1000;
        for (const rawPattern of role.patterns) {
          const strength = this._matchStrength(
            normalized,
            this._normalizeMatchText(rawPattern)
          );
          if (strength > 0) {
            bestScore = Math.max(bestScore, sourceScore + strength);
          }
        }
      }
      return bestScore;
    }

    static _matchRole(entries, hass, role) {
      let candidates = entries
        .map((entry) => ({
          entry,
          score: this._scoreRegistryEntry(entry, hass, role),
        }))
        .filter((candidate) => candidate.score > 0);

      const enabled = candidates.filter(
        ({ entry }) => entry.disabled_by === null || entry.disabled_by === undefined
      );
      if (enabled.length > 0) {
        candidates = enabled;
      }
      const available = candidates.filter(({ entry }) => {
        const state = hass?.states?.[entry.entity_id]?.state;
        return (
          state !== undefined &&
          state !== null &&
          state !== "unknown" &&
          state !== "unavailable"
        );
      });
      if (available.length > 0) {
        candidates = available;
      }
      if (candidates.length === 0) {
        return { match: null, ambiguous: [] };
      }

      candidates.sort(
        (left, right) =>
          right.score - left.score ||
          left.entry.entity_id.localeCompare(right.entry.entity_id)
      );
      const strongest = candidates[0].score;
      const tied = candidates.filter(
        (candidate) => candidate.score === strongest
      );
      if (tied.length > 1) {
        return {
          match: null,
          ambiguous: tied.map(({ entry }) => entry.entity_id),
        };
      }
      return { match: candidates[0].entry, ambiguous: [] };
    }

    static _matchDeviceEntities(registryEntries, hass, deviceId) {
      const entries = (Array.isArray(registryEntries) ? registryEntries : [])
        .filter(
          (entry) =>
            entry &&
            entry.device_id === deviceId &&
            typeof entry.entity_id === "string" &&
            entry.entity_id.startsWith("sensor.")
        );
      const results = {};
      for (const role of this._importRoles()) {
        results[role.key] = this._matchRole(entries, hass, role);
      }
      return results;
    }

    static _isSemComponentVersion(entry, hass) {
      const stateObject = hass?.states?.[entry.entity_id];
      const sources = [
        entry.original_name,
        entry.unique_id,
        stateObject?.attributes?.friendly_name,
        entry.entity_id,
      ];
      return sources.some((source) => {
        const normalized = this._normalizeMatchText(source);
        return (
          normalized.includes("component version") &&
          (normalized.includes("sem meter") ||
            normalized.startsWith("sem ") ||
            normalized.includes(" sem "))
        );
      });
    }

    static _deviceFallbackName(entries, hass) {
      const suffix =
        /\s+(?:(?:total\s+)?main\s+(?:power|current)|total\s+(?:power|current)|(?:line\s*[12]|l[12]|(?:main\s+)?phase\s+[ab])\s+power|(?:clamp|ct|channel|circuit)\s+\d+\s+power|sem\s+component\s+version)$/i;
      for (const entry of entries) {
        const stateName =
          hass?.states?.[entry.entity_id]?.attributes?.friendly_name;
        const source = this._cleanText(stateName || entry.original_name);
        if (!source) {
          continue;
        }
        const trimmed = source.replace(suffix, "").trim();
        if (trimmed && trimmed !== source) {
          return trimmed;
        }
      }
      for (const entry of entries) {
        const fallback = this._friendlyEntityLabel(hass, entry.entity_id);
        if (fallback) {
          return fallback;
        }
      }
      return "";
    }

    static _candidateHint(roleMatches, clampCount) {
      const hasMain =
        roleMatches.main_power || roleMatches.main_current;
      const hasBothLines =
        roleMatches.line_1_power && roleMatches.line_2_power;
      if (hasMain && hasBothLines && clampCount > 0) {
        return `Main + L1/L2 + ${clampCount} clamp${
          clampCount === 1 ? "" : "s"
        }`;
      }
      if (clampCount > 0) {
        return `${clampCount} clamp${
          clampCount === 1 ? "" : "s"
        } detected`;
      }
      const details = [];
      if (hasMain) {
        details.push("Main");
      }
      if (roleMatches.line_1_power) {
        details.push("L1");
      }
      if (roleMatches.line_2_power) {
        details.push("L2");
      }
      return details.join(" + ") || "SEM Meter metadata";
    }

    static _discoverSemMeterCandidates(
      deviceRegistry,
      entityRegistry,
      hass
    ) {
      const devices = new Map();
      for (const device of Array.isArray(deviceRegistry)
        ? deviceRegistry
        : []) {
        if (device?.id && !devices.has(device.id)) {
          devices.set(device.id, device);
        }
      }

      const entitiesByDevice = new Map();
      for (const entry of Array.isArray(entityRegistry)
        ? entityRegistry
        : []) {
        if (!entry?.device_id || !devices.has(entry.device_id)) {
          continue;
        }
        if (!entitiesByDevice.has(entry.device_id)) {
          entitiesByDevice.set(entry.device_id, []);
        }
        entitiesByDevice.get(entry.device_id).push(entry);
      }

      const roles = this._importRoles();
      const candidates = [];
      for (const [deviceId, device] of devices) {
        const allEntries = entitiesByDevice.get(deviceId) || [];
        const sensorEntries = allEntries.filter(
          (entry) =>
            typeof entry.entity_id === "string" &&
            entry.entity_id.startsWith("sensor.")
        );
        const roleMatches = {};
        for (const role of roles) {
          const candidateRole = role.clamp
            ? {
                ...role,
                patterns: [
                  `clamp ${role.clamp} power`,
                  `ct ${role.clamp} power`,
                  `channel ${role.clamp} power`,
                ],
              }
            : role;
          roleMatches[role.key] = sensorEntries.some(
            (entry) =>
              this._scoreRegistryEntry(entry, hass, candidateRole) > 0
          );
        }

        let score = 0;
        if (roleMatches.main_power) {
          score += 4;
        }
        if (roleMatches.main_current) {
          score += 3;
        }
        if (roleMatches.line_1_power) {
          score += 2;
        }
        if (roleMatches.line_2_power) {
          score += 2;
        }
        let clampCount = 0;
        for (let clamp = 1; clamp <= MAX_CLAMPS; clamp += 1) {
          if (roleMatches[`clamp_${clamp}`]) {
            clampCount += 1;
            score += 1;
          }
        }
        const hasComponentVersion = allEntries.some((entry) =>
          this._isSemComponentVersion(entry, hass)
        );
        if (hasComponentVersion) {
          score += 3;
        }
        const hardwareIdentity = this._normalizeMatchText(
          `${device.manufacturer || ""} ${device.model || ""}`
        );
        const hasSemHardwareIdentity =
          hardwareIdentity.includes("sem meter");
        if (hasSemHardwareIdentity) {
          score += 5;
        }

        if (score < 6 && clampCount < 4) {
          continue;
        }
        const label =
          this._cleanText(device.name_by_user) ||
          this._cleanText(device.name) ||
          this._deviceFallbackName(allEntries, hass) ||
          deviceId;
        candidates.push({
          device_id: deviceId,
          label,
          hint: this._candidateHint(roleMatches, clampCount),
          score,
          clamp_count: clampCount,
          role_matches: roleMatches,
          component_version: hasComponentVersion,
          hardware_identity: hasSemHardwareIdentity,
        });
      }

      candidates.sort(
        (left, right) =>
          left.label.localeCompare(right.label) ||
          left.device_id.localeCompare(right.device_id)
      );
      return candidates;
    }

    static _importedClampName(hass, entityId, clampNumber) {
      let label = this._friendlyEntityLabel(hass, entityId).trim();
      label = label.replace(/^.*?\bSEM\s+Meter\b\s*/i, "").trim();
      const genericPattern = new RegExp(
        `^(clamp|ct|channel|circuit)\\s+${clampNumber}\\s+power$`,
        "i"
      );
      if (genericPattern.test(label)) {
        return label.replace(/\s+power$/i, "").trim();
      }
      const withoutPower = label.replace(/\s+power$/i, "").trim();
      return withoutPower.length >= 2 ? withoutPower : label;
    }

    static _configClampMap(config) {
      const map = new Map();
      const entries =
        Array.isArray(config?.clamps) ||
        (config?.clamps && typeof config.clamps === "object")
          ? Object.entries(config.clamps)
          : [];
      for (const [index, clamp] of entries) {
        if (!clamp || typeof clamp !== "object") {
          continue;
        }
        const number = Number(
          clamp.clamp === undefined ? Number(index) + 1 : clamp.clamp
        );
        if (
          Number.isInteger(number) &&
          number >= 1 &&
          number <= MAX_CLAMPS &&
          !map.has(number)
        ) {
          map.set(number, { ...clamp, clamp: number });
        }
      }
      return map;
    }

    static _configForEditor(config) {
      const editorConfig = this._copyConfig(config);
      const clampMap = this._configClampMap(config);
      editorConfig.clamps = Array.from(
        { length: MAX_CLAMPS },
        (_, index) => {
          const clamp = index + 1;
          return {
            clamp,
            entity: "",
            name: "",
            circuit: "",
            icon: "",
            unit: "auto",
            poles: 1,
            ...(clampMap.get(clamp) || {}),
            clamp,
          };
        }
      );
      return editorConfig;
    }

    static _applyEntityImport(config, matches, mode, hass) {
      const next = this._copyConfig(config);
      const summary = {
        imported: [],
        notFound: [],
        ambiguous: [],
        preserved: [],
      };
      const roles = this._importRoles();
      const main = { ...(next.main || {}) };
      const clampMap = this._configClampMap(next);

      for (const role of roles) {
        const result = matches[role.key] || { match: null, ambiguous: [] };
        if (result.ambiguous.length > 0) {
          summary.ambiguous.push({
            label: role.label,
            entities: [...result.ambiguous],
          });
        } else if (!result.match) {
          summary.notFound.push(role.label);
        }

        if (role.field) {
          if (mode === IMPORT_FILL && this._cleanText(main[role.field])) {
            summary.preserved.push(role.label);
          } else if (result.match) {
            main[role.field] = result.match.entity_id;
            summary.imported.push(role.label);
          } else if (mode === IMPORT_REPLACE) {
            main[role.field] = "";
          }
          continue;
        }

        const existing = clampMap.get(role.clamp);
        if (
          mode === IMPORT_FILL &&
          existing &&
          this._cleanText(existing.entity)
        ) {
          summary.preserved.push(role.label);
          continue;
        }
        if (result.match) {
          if (existing) {
            existing.entity = result.match.entity_id;
          } else {
            clampMap.set(role.clamp, {
              clamp: role.clamp,
              entity: result.match.entity_id,
              name: this._importedClampName(
                hass,
                result.match.entity_id,
                role.clamp
              ),
              circuit: "",
              icon: "",
              unit: "auto",
              poles: 1,
            });
          }
          summary.imported.push(role.label);
        } else if (mode === IMPORT_REPLACE && existing) {
          existing.entity = "";
        }
      }

      next.main = main;
      next.clamps = [...clampMap.values()].sort(
        (left, right) => left.clamp - right.clamp
      );
      return { config: next, summary };
    }

    setConfig(config) {
      this._config = SemElectricPanelCard._normalizeConfig(config);
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    get hass() {
      return this._hass;
    }

    getCardSize() {
      const activeClamps =
        this._config?.clamps.filter((clamp) => clamp.entity).length || 0;
      return 3 + Math.max(1, Math.ceil(activeClamps / 2));
    }

    _render() {
      if (!this.shadowRoot || !this._config) {
        return;
      }

      const style = document.createElement("style");
      style.textContent = STYLE;
      const card = document.createElement("ha-card");
      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = this._config.title;
      card.append(title);

      const content = document.createElement("div");
      content.className = "content";
      content.append(this._renderMain(), this._renderPanel());
      card.append(content);
      this.shadowRoot.replaceChildren(style, card);
    }

    _renderMain() {
      const main = this._config.main;
      const targetEntity = main.power_entity || main.current_entity;
      const section = document.createElement("div");
      section.className = "main-breaker";
      section.setAttribute(
        "aria-label",
        `${main.name}. Open main breaker measurements.`
      );

      if (targetEntity) {
        section.classList.add("interactive");
        this._makeInteractive(section, targetEntity);
      } else {
        section.setAttribute("role", "group");
      }

      const heading = document.createElement("div");
      heading.className = "main-heading";
      heading.textContent = "MAIN BREAKER";
      const name = document.createElement("div");
      name.className = "main-name";
      name.textContent = main.name;
      section.append(heading, name);

      const totalParts = [];
      if (main.power_entity) {
        totalParts.push(
          this._formattedText(
            SemElectricPanelCard._formatEntity(
              this._hass,
              main.power_entity,
              "auto"
            )
          )
        );
      }
      if (main.current_entity) {
        totalParts.push(
          this._formattedText(
            SemElectricPanelCard._formatEntity(
              this._hass,
              main.current_entity,
              "auto"
            )
          )
        );
      }
      const total = document.createElement("div");
      total.className = "main-total";
      total.textContent =
        totalParts.length > 0
          ? totalParts.join(" | ")
          : "No main entities configured";
      section.append(total);

      const lineParts = [];
      if (main.line_1_entity) {
        lineParts.push(
          `L1 ${this._formattedText(
            SemElectricPanelCard._formatEntity(
              this._hass,
              main.line_1_entity,
              "auto"
            )
          )}`
        );
      }
      if (main.line_2_entity) {
        lineParts.push(
          `L2 ${this._formattedText(
            SemElectricPanelCard._formatEntity(
              this._hass,
              main.line_2_entity,
              "auto"
            )
          )}`
        );
      }
      if (lineParts.length > 0) {
        const lines = document.createElement("div");
        lines.className = "main-lines";
        lines.textContent = lineParts.join(" | ");
        section.append(lines);
      }

      const line1 = SemElectricPanelCard._powerValue(
        this._hass,
        main.line_1_entity
      );
      const line2 = SemElectricPanelCard._powerValue(
        this._hass,
        main.line_2_entity
      );
      const balance = SemElectricPanelCard._calculateBalance(line1, line2);
      const balanceElement = document.createElement("div");
      balanceElement.className = `balance ${balance.level}`;
      balanceElement.textContent = balance.label;
      balanceElement.title =
        balance.percentage === null
          ? "Line balance cannot be calculated from the configured entities."
          : `${balance.percentage.toFixed(1)}% line imbalance`;
      section.append(balanceElement);
      return section;
    }

    _renderPanel() {
      const panel = document.createElement("div");
      panel.className = "panel";
      const activeClamps = this._config.clamps.filter(
        (clamp) => clamp.entity
      );
      if (activeClamps.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-panel";
        empty.textContent = "No SEM Meter clamps configured";
        panel.append(empty);
        return panel;
      }

      for (const clamp of activeClamps) {
        panel.append(this._renderClamp(clamp));
      }
      return panel;
    }

    _renderClamp(clamp) {
      const stateObject =
        this._hass?.states && this._hass.states[clamp.entity];
      const displayName =
        clamp.name || this._deriveEntityName(stateObject, clamp.entity);
      const formatted = SemElectricPanelCard._formatEntity(
        this._hass,
        clamp.entity,
        clamp.unit
      );
      const side = clamp.clamp % 2 === 1 ? "left" : "right";
      const row = Math.ceil(clamp.clamp / 2);
      const breaker = document.createElement("div");
      breaker.className = `breaker ${side}${
        clamp.poles === 2 ? " double-pole" : ""
      }`;
      breaker.style.gridRow = String(row);
      breaker.title =
        clamp.poles === 2
          ? `Clamp ${clamp.clamp}: 2-pole breaker`
          : `Clamp ${clamp.clamp}: single-pole breaker`;
      breaker.setAttribute(
        "aria-label",
        `Clamp ${clamp.clamp}, ${clamp.circuit || "circuit not specified"}, ${
          displayName
        }, ${formatted.value}${formatted.unit ? ` ${formatted.unit}` : ""}, ${
          clamp.poles
        }-pole`
      );
      this._makeInteractive(breaker, clamp.entity);

      const icon = document.createElement("ha-icon");
      icon.setAttribute(
        "icon",
        clamp.icon || stateObject?.attributes?.icon || "mdi:flash"
      );

      const copy = document.createElement("div");
      copy.className = "breaker-copy";
      const circuit = document.createElement("div");
      circuit.className = "circuit";
      circuit.textContent = clamp.circuit
        ? `Circuit ${clamp.circuit}`
        : `Clamp ${clamp.clamp}`;
      const name = document.createElement("div");
      name.className = "breaker-name";
      name.textContent = displayName;
      copy.append(circuit, name);

      const state = document.createElement("div");
      state.className = `breaker-state${
        formatted.available ? "" : " unavailable"
      }`;
      const value = document.createElement("span");
      value.textContent = formatted.value;
      state.append(value);
      if (formatted.unit) {
        const unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = formatted.unit;
        state.append(unit);
      }

      breaker.append(icon, copy, state);
      if (clamp.poles === 2) {
        const link = document.createElement("span");
        link.className = "pole-link";
        link.setAttribute("aria-hidden", "true");
        breaker.append(link);
      }
      return breaker;
    }

    _deriveEntityName(stateObject, entityId) {
      if (
        stateObject &&
        this._hass &&
        typeof this._hass.formatEntityName === "function"
      ) {
        try {
          const formattedName = this._hass.formatEntityName(stateObject);
          if (formattedName) {
            return formattedName;
          }
        } catch (_error) {
          // Continue through stable fallbacks for older Home Assistant versions.
        }
      }
      if (stateObject?.attributes?.friendly_name) {
        return String(stateObject.attributes.friendly_name);
      }
      const objectId = String(entityId || "Unnamed clamp").split(".").pop();
      return objectId
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    _formattedText(formatted) {
      return `${formatted.value}${formatted.unit ? ` ${formatted.unit}` : ""}`;
    }

    _makeInteractive(element, entityId) {
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.addEventListener("click", () => this._openMoreInfo(entityId));
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this._openMoreInfo(entityId);
        }
      });
    }

    _openMoreInfo(entityId) {
      if (!entityId) {
        return;
      }
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          bubbles: true,
          composed: true,
          detail: { entityId },
        })
      );
    }
  }

  class SemElectricPanelCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = null;
      this._hass = null;
      this._importMode = IMPORT_FILL;
      this._replaceConfirmationPending = false;
      this._importing = false;
      this._summary = null;
      this._registryCache = null;
      this._registryLoadPromise = null;
      this._deviceDiscoveryLoading = false;
      this._deviceCandidates = [];
      this._deviceDiscoveryAttempted = false;
      this._deviceDiscoveryMessage = "";
      this._deviceDiscoveryError = "";
      this._selectedMissingReloadFor = "";
    }

    setConfig(config) {
      this._config = SemElectricPanelCard._copyConfig(config);
      this._render();
      this._ensureDeviceCandidates();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this.shadowRoot?.hasChildNodes() && this._config) {
        this._render();
        this._ensureDeviceCandidates();
        return;
      }
      for (const form of this.shadowRoot?.querySelectorAll("ha-form") || []) {
        form.hass = hass;
      }
      this._ensureDeviceCandidates();
      const selected = SemElectricPanelCard._cleanText(
        this._config?.device_id
      );
      if (selected && hass?.devices?.[selected]) {
        this._selectedMissingReloadFor = "";
      }
      if (
        selected &&
        hass?.devices &&
        !hass.devices[selected] &&
        this._selectedMissingReloadFor !== selected &&
        !this._registryLoadPromise
      ) {
        this._selectedMissingReloadFor = selected;
        this._loadDeviceCandidates(true, false).catch(() => {});
      }
    }

    get hass() {
      return this._hass;
    }

    _ensureDeviceCandidates() {
      if (
        !this._config ||
        !this._hass ||
        this._deviceDiscoveryAttempted ||
        this._registryLoadPromise
      ) {
        return;
      }
      if (typeof this._hass.callWS !== "function") {
        this._deviceDiscoveryAttempted = true;
        this._deviceDiscoveryError =
          "Automatic SEM Meter detection is not available in this Home Assistant version.";
        this._render();
        return;
      }
      this._loadDeviceCandidates(false, false).catch(() => {});
    }

    static _registryArray(response, property, description) {
      const entries = Array.isArray(response) ? response : response?.[property];
      if (!Array.isArray(entries)) {
        throw new Error(`${description} returned an unsupported response`);
      }
      return entries;
    }

    async _loadDeviceCandidates(force = false, announce = true) {
      if (!force && this._registryCache) {
        return this._registryCache;
      }
      if (this._registryLoadPromise) {
        return this._registryLoadPromise;
      }
      if (!this._hass || typeof this._hass.callWS !== "function") {
        throw new Error(
          "Home Assistant does not expose the required registry API"
        );
      }

      this._deviceDiscoveryError = "";
      this._deviceDiscoveryMessage = "Scanning Home Assistant devices…";
      this._deviceDiscoveryLoading = true;
      this._render();
      const loadPromise = Promise.all([
        this._hass.callWS({ type: "config/device_registry/list" }),
        this._hass.callWS({ type: "config/entity_registry/list" }),
      ])
        .then(([deviceResponse, entityResponse]) => {
          const devices = SemElectricPanelCardEditor._registryArray(
            deviceResponse,
            "devices",
            "Device registry"
          );
          const entities = SemElectricPanelCardEditor._registryArray(
            entityResponse,
            "entities",
            "Entity registry"
          );
          this._registryCache = { devices, entities };
          this._deviceCandidates =
            SemElectricPanelCard._discoverSemMeterCandidates(
              devices,
              entities,
              this._hass
            );
          this._deviceDiscoveryAttempted = true;

          const selected = SemElectricPanelCard._cleanText(
            this._config?.device_id
          );
          this._selectedMissingReloadFor =
            selected &&
            ((this._hass?.devices &&
              !this._hass.devices[selected]) ||
              !devices.some((device) => device?.id === selected))
              ? selected
              : "";
          if (!selected && this._deviceCandidates.length === 1) {
            const candidate = this._deviceCandidates[0];
            this._emitConfig({
              ...this._config,
              device_id: candidate.device_id,
            });
            this._deviceDiscoveryMessage = `${candidate.label} detected`;
          } else if (this._deviceCandidates.length === 0) {
            this._deviceDiscoveryMessage =
              "No SEM Meter devices were detected automatically.";
          } else if (announce) {
            this._deviceDiscoveryMessage = `Found ${
              this._deviceCandidates.length
            } SEM Meter device${
              this._deviceCandidates.length === 1 ? "" : "s"
            }`;
          } else {
            this._deviceDiscoveryMessage = "";
          }
          return this._registryCache;
        })
        .catch((error) => {
          this._deviceDiscoveryAttempted = true;
          this._deviceDiscoveryError = `SEM Meter device detection failed: ${
            error instanceof Error ? error.message : String(error)
          }. Existing device selection was preserved.`;
          this._deviceDiscoveryMessage = "";
          throw error;
        })
        .finally(() => {
          this._registryLoadPromise = null;
          this._deviceDiscoveryLoading = false;
          this._render();
        });
      this._registryLoadPromise = loadPromise;
      return loadPromise;
    }

    async _refreshDeviceCandidates() {
      try {
        await this._loadDeviceCandidates(true, true);
      } catch (_error) {
        // The inline error from _loadDeviceCandidates is the user-facing result.
      }
    }

    _emitConfig(config) {
      this._config = SemElectricPanelCard._copyConfig(config);
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          bubbles: true,
          composed: true,
          detail: { config: this._config },
        })
      );
    }

    _handleFormChanged(event) {
      event.stopPropagation();
      const next = event.detail?.value;
      if (!next || typeof next !== "object") {
        return;
      }
      this._summary = null;
      this._replaceConfirmationPending = false;
      this._emitConfig(next);
      this._updateImportControls();
    }

    _createForm(schema, data = this._config) {
      const form = document.createElement("ha-form");
      form.hass = this._hass;
      form.data = data;
      form.schema = schema.schema;
      form.computeLabel = schema.computeLabel;
      form.computeHelper = schema.computeHelper;
      form.addEventListener("value-changed", (event) =>
        this._handleFormChanged(event)
      );
      return form;
    }

    _updateImportControls() {
      const importButton = this.shadowRoot?.querySelector("[data-import]");
      if (importButton) {
        importButton.disabled =
          this._importing ||
          !SemElectricPanelCard._cleanText(this._config?.device_id);
        importButton.textContent = this._importing
          ? "Importing…"
          : "Import SEM Meter Entities";
      }
      const confirm = this.shadowRoot?.querySelector("[data-confirmation]");
      if (confirm) {
        confirm.hidden = !this._replaceConfirmationPending;
      }
    }

    _setEditorMessage(message, type = "error") {
      this._summary = {
        error: message,
        type,
      };
      this._render();
    }

    async _startImport() {
      if (!SemElectricPanelCard._cleanText(this._config?.device_id)) {
        this._setEditorMessage("Select a SEM Meter device before importing.");
        return;
      }
      if (this._importMode === IMPORT_REPLACE) {
        this._replaceConfirmationPending = true;
        this._updateImportControls();
        return;
      }
      await this._executeImport();
    }

    async _executeImport() {
      if (
        !this._hass ||
        typeof this._hass.callWS !== "function" ||
        this._importing
      ) {
        this._setEditorMessage(
          "This Home Assistant version does not expose the entity registry to this editor. Manual entity selection remains available."
        );
        return;
      }

      this._replaceConfirmationPending = false;
      this._importing = true;
      this._summary = null;
      this._updateImportControls();
      const originalConfig = this._config;
      try {
        const registry = this._registryCache
          ? this._registryCache
          : await this._loadDeviceCandidates(false, false);
        const registryEntries = registry.entities;
        const matches = SemElectricPanelCard._matchDeviceEntities(
          registryEntries,
          this._hass,
          this._config.device_id
        );
        const result = SemElectricPanelCard._applyEntityImport(
          this._config,
          matches,
          this._importMode,
          this._hass
        );
        this._summary = result.summary;
        this._emitConfig(result.config);
      } catch (error) {
        this._config = originalConfig;
        this._summary = {
          error: `Entity import failed: ${
            error instanceof Error ? error.message : String(error)
          }. Existing assignments were not changed.`,
          type: "error",
        };
      } finally {
        this._importing = false;
        this._render();
      }
    }

    _appendSummary(container) {
      if (!this._summary) {
        return;
      }
      const box = document.createElement("div");
      box.className = `summary ${this._summary.type || "success"}`;
      box.setAttribute("role", this._summary.error ? "alert" : "status");

      if (this._summary.error) {
        box.textContent = this._summary.error;
        container.append(box);
        return;
      }

      const heading = document.createElement("strong");
      heading.textContent = "Import result";
      box.append(heading);
      const groups = [
        ["Imported", this._summary.imported],
        ["Not found", this._summary.notFound],
        [
          "Ambiguous",
          this._summary.ambiguous.map(
            (item) =>
              `${item.label}: ${item.entities.length} equally ranked entities (${item.entities.join(
                ", "
              )})`
          ),
        ],
        ["Preserved existing", this._summary.preserved],
      ];
      for (const [label, items] of groups) {
        if (!items || items.length === 0) {
          continue;
        }
        const groupHeading = document.createElement("div");
        groupHeading.className = "summary-heading";
        groupHeading.textContent = `${label}:`;
        const list = document.createElement("ul");
        for (const item of items) {
          const row = document.createElement("li");
          row.textContent = item;
          list.append(row);
        }
        box.append(groupHeading, list);
      }
      container.append(box);
    }

    _render() {
      if (!this.shadowRoot || !this._config) {
        return;
      }

      const style = document.createElement("style");
      style.textContent = `
        :host {
          display: block;
          color: var(--primary-text-color);
        }
        .device-section {
          margin-bottom: 16px;
          padding: 16px;
          border: 1px solid var(--divider-color, #d5d5d5);
          border-radius: var(--ha-border-radius-md, 12px);
        }
        h3 {
          margin: 0 0 6px;
          font-size: 1rem;
          font-weight: 600;
        }
        .explanation, .compatibility {
          margin: 0 0 16px;
          color: var(--secondary-text-color);
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .device-picker-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end;
          gap: 12px;
        }
        .device-message {
          margin: 12px 0 0;
          color: var(--secondary-text-color);
          font-size: 0.88rem;
          line-height: 1.4;
        }
        .device-message.error {
          color: var(--error-color, #db4437);
        }
        details {
          margin-top: 14px;
          border-top: 1px solid var(--divider-color, #d5d5d5);
          padding-top: 12px;
        }
        summary {
          cursor: pointer;
          color: var(--secondary-text-color);
          font-size: 0.88rem;
          font-weight: 600;
        }
        details ha-form {
          display: block;
          margin-top: 14px;
        }
        .controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end;
          gap: 12px;
          margin-top: 14px;
        }
        label {
          display: grid;
          gap: 5px;
          color: var(--secondary-text-color);
          font-size: 0.8rem;
        }
        select, button {
          box-sizing: border-box;
          min-height: 40px;
          border: 1px solid var(--divider-color, #bdbdbd);
          border-radius: 8px;
          color: var(--primary-text-color);
          background: var(--card-background-color, #fff);
          font: inherit;
        }
        select {
          width: 100%;
          padding: 8px 10px;
        }
        button {
          padding: 8px 14px;
          cursor: pointer;
          font-weight: 600;
        }
        button.primary {
          border-color: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
          background: var(--primary-color, #03a9f4);
        }
        button:disabled {
          cursor: default;
          opacity: 0.5;
        }
        .confirmation {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid var(--warning-color, #ff9800);
          border-radius: 8px;
        }
        .confirmation p {
          margin: 0 0 10px;
        }
        .confirmation-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .summary {
          margin-top: 14px;
          padding: 12px;
          border-left: 4px solid var(--primary-color, #03a9f4);
          border-radius: 6px;
          background: var(--secondary-background-color, #f5f5f5);
          line-height: 1.4;
        }
        .summary.error {
          border-left-color: var(--error-color, #db4437);
        }
        .summary-heading {
          margin-top: 8px;
          font-weight: 600;
        }
        .summary ul {
          margin: 3px 0 0;
          padding-left: 22px;
        }
        .manual-heading {
          margin: 18px 0 10px;
          color: var(--secondary-text-color);
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        @media (max-width: 520px) {
          .controls, .device-picker-row {
            grid-template-columns: 1fr;
          }
        }
      `;

      const deviceSection = document.createElement("section");
      deviceSection.className = "device-section";
      const heading = document.createElement("h3");
      heading.textContent = "SEM Meter Device";
      const explanation = document.createElement("p");
      explanation.className = "explanation";
      explanation.textContent =
        "Choose a detected SEM Meter, then explicitly import its Main and Clamp entity assignments.";
      deviceSection.append(heading, explanation);

      const selectedDevice = SemElectricPanelCard._cleanText(
        this._config.device_id
      );
      const candidateIds = new Set(
        this._deviceCandidates.map((candidate) => candidate.device_id)
      );
      const devicePickerRow = document.createElement("div");
      devicePickerRow.className = "device-picker-row";
      const candidateLabel = document.createElement("label");
      candidateLabel.textContent = "Detected SEM Meter device";
      const candidateSelect = document.createElement("select");
      candidateSelect.dataset.candidateDevice = "";
      candidateSelect.setAttribute(
        "aria-label",
        "Detected SEM Meter device"
      );
      candidateSelect.disabled = this._deviceDiscoveryLoading;
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = this._deviceDiscoveryLoading
        ? "Scanning devices…"
        : this._deviceCandidates.length > 0
        ? "Select a detected SEM Meter"
        : "No detected SEM Meter devices";
      placeholder.selected = !candidateIds.has(selectedDevice);
      candidateSelect.append(placeholder);
      for (const candidate of this._deviceCandidates) {
        const option = document.createElement("option");
        option.value = candidate.device_id;
        option.textContent = `${candidate.label} — ${candidate.hint}`;
        option.selected = candidate.device_id === selectedDevice;
        candidateSelect.append(option);
      }
      candidateSelect.addEventListener("change", () => {
        const deviceId = SemElectricPanelCard._cleanText(
          candidateSelect.value
        );
        if (!deviceId) {
          return;
        }
        this._summary = null;
        this._replaceConfirmationPending = false;
        this._emitConfig({ ...this._config, device_id: deviceId });
        const candidate = this._deviceCandidates.find(
          (item) => item.device_id === deviceId
        );
        this._deviceDiscoveryMessage = candidate
          ? `${candidate.label} selected`
          : "";
        this._render();
      });
      candidateLabel.append(candidateSelect);

      const refreshButton = document.createElement("button");
      refreshButton.type = "button";
      refreshButton.dataset.refreshDevices = "";
      refreshButton.textContent = "Refresh SEM Meter Devices";
      refreshButton.disabled = this._deviceDiscoveryLoading;
      refreshButton.addEventListener("click", () =>
        this._refreshDeviceCandidates()
      );
      devicePickerRow.append(candidateLabel, refreshButton);
      deviceSection.append(devicePickerRow);

      if (this._deviceDiscoveryError || this._deviceDiscoveryMessage) {
        const message = document.createElement("p");
        message.className = `device-message${
          this._deviceDiscoveryError ? " error" : ""
        }`;
        message.setAttribute(
          "role",
          this._deviceDiscoveryError ? "alert" : "status"
        );
        message.textContent =
          this._deviceDiscoveryError || this._deviceDiscoveryMessage;
        deviceSection.append(message);
      }

      const deviceFormSchema = {
        schema: [{ name: "device_id", selector: { device: {} } }],
        computeLabel: () => "Any Home Assistant device",
        computeHelper: () =>
          "Use this only when automatic SEM Meter detection cannot identify the device.",
      };
      const advanced = document.createElement("details");
      advanced.open =
        (this._deviceDiscoveryAttempted &&
          this._deviceCandidates.length === 0) ||
        Boolean(this._deviceDiscoveryError) ||
        Boolean(selectedDevice && !candidateIds.has(selectedDevice));
      const advancedSummary = document.createElement("summary");
      advancedSummary.textContent =
        "Advanced: Select Any Home Assistant Device";
      advanced.append(
        advancedSummary,
        this._createForm(deviceFormSchema)
      );
      deviceSection.append(advanced);

      const controls = document.createElement("div");
      controls.className = "controls";
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Import mode";
      const mode = document.createElement("select");
      mode.setAttribute("aria-label", "SEM Meter entity import mode");
      for (const [value, label] of [
        [IMPORT_FILL, "Fill Empty Fields"],
        [IMPORT_REPLACE, "Replace Entity Assignments"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = this._importMode === value;
        mode.append(option);
      }
      mode.addEventListener("change", () => {
        this._importMode =
          mode.value === IMPORT_REPLACE ? IMPORT_REPLACE : IMPORT_FILL;
        this._replaceConfirmationPending = false;
        this._updateImportControls();
      });
      modeLabel.append(mode);

      const importButton = document.createElement("button");
      importButton.type = "button";
      importButton.className = "primary";
      importButton.dataset.import = "";
      importButton.textContent = "Import SEM Meter Entities";
      importButton.addEventListener("click", () => this._startImport());
      controls.append(modeLabel, importButton);
      deviceSection.append(controls);

      const confirmation = document.createElement("div");
      confirmation.className = "confirmation";
      confirmation.dataset.confirmation = "";
      confirmation.hidden = !this._replaceConfirmationPending;
      const confirmationText = document.createElement("p");
      confirmationText.textContent =
        "Replace all Main and Clamp entity assignments with the detected entities? Custom names, circuit labels, icons, units, and pole counts will be preserved.";
      const confirmationActions = document.createElement("div");
      confirmationActions.className = "confirmation-actions";
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "primary";
      confirmButton.textContent = "Confirm Replace";
      confirmButton.addEventListener("click", () => this._executeImport());
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.textContent = "Cancel";
      cancelButton.addEventListener("click", () => {
        this._replaceConfirmationPending = false;
        this._updateImportControls();
      });
      confirmationActions.append(confirmButton, cancelButton);
      confirmation.append(confirmationText, confirmationActions);
      deviceSection.append(confirmation);
      this._appendSummary(deviceSection);

      const manualHeading = document.createElement("div");
      manualHeading.className = "manual-heading";
      manualHeading.textContent = "Panel configuration";
      const editorFormSchema = SemElectricPanelCard._buildConfigForm(
        this._config,
        this._hass,
        false
      );
      const editorForm = this._createForm(
        editorFormSchema,
        SemElectricPanelCard._configForEditor(this._config)
      );
      this.shadowRoot.replaceChildren(
        style,
        deviceSection,
        manualHeading,
        editorForm
      );
      this._updateImportControls();
    }
  }

  if (!customElements.get(EDITOR_TAG)) {
    customElements.define(EDITOR_TAG, SemElectricPanelCardEditor);
  }

  if (!customElements.get(CARD_TAG)) {
    customElements.define(CARD_TAG, SemElectricPanelCard);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === CARD_TAG)) {
    window.customCards.push({
      type: CARD_TAG,
      name: "SEM Electric Panel",
      description:
        "Displays one main electrical service and up to 16 SEM Meter clamps.",
      preview: true,
    });
  }
})();
