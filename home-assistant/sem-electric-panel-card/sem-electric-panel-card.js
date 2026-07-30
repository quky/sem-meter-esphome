(() => {
  "use strict";

  const CARD_TAG = "sem-electric-panel-card";
  const CARD_TYPE = "custom:sem-electric-panel-card";
  const MAX_CLAMPS = 16;
  const VALID_UNITS = new Set(["auto", "W", "kW", "A"]);

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
      const entitySelector = {
        entity: {
          filter: {
            domain: "sensor",
          },
        },
      };

      const clampSections = Array.from(
        { length: MAX_CLAMPS },
        (_, index) => ({
          type: "expandable",
          name: String(index),
          title: `Clamp ${index + 1}`,
          icon: "mdi:current-ac",
          schema: [
            {
              name: "clamp",
              type: "integer",
              default: index + 1,
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
        })
      );

      const labels = {
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

      return {
        schema: [
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
          },
        ],
        computeLabel: (schema) => labels[schema.name],
        computeHelper: (schema) => {
          if (schema.name === "clamps") {
            return "Configure up to the 16 physical SEM Meter clamps.";
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
        main,
        clamps,
      };
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
