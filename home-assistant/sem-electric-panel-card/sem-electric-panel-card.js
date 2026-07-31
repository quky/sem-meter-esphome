(() => {
  "use strict";

  const CARD_TAG = "sem-electric-panel-card";
  const EDITOR_TAG = "sem-electric-panel-card-editor";
  const CARD_TYPE = "custom:sem-electric-panel-card";
  const MAX_CLAMPS = 16;
  const MAX_PANEL_POSITIONS = 42;
  const VALID_UNITS = new Set(["auto", "W", "kW", "A"]);
  const IMPORT_FILL = "fill";
  const IMPORT_REPLACE = "replace";
  const NUMBERING_STYLES = new Set(["clamp", "circuit", "number"]);
  const MEASUREMENT_DECIMALS = new Set([0, 1, 2]);
  const ENERGY_DECIMALS = new Set([0, 1, 2, 3]);
  const BREAKER_TYPES = new Set(["single", "double", "tandem"]);
  const BREAKER_RATINGS = new Set([15, 20, 25, 30, 40, 50, 60]);
  const PANEL_SIZES = new Set(
    Array.from({ length: 18 }, (_, index) => 8 + index * 2)
  );
  const DEFAULT_PANEL_SIZE = 16;

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
      min-height: 168px;
      padding: 0;
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
      overflow: hidden;
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

    .main-breaker-poles {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      min-height: 72px;
      border-bottom: 1px solid var(--divider-color, #d5d5d5);
      background: color-mix(
        in srgb,
        var(--primary-color, #03a9f4) 4%,
        var(--secondary-background-color, #f5f5f5)
      );
    }

    .main-breaker-pole {
      display: grid;
      grid-template-rows: auto 1fr;
      align-items: start;
      min-width: 0;
      padding: 8px 10px 9px;
    }

    .main-breaker-pole.right {
      border-left: 1px solid var(--divider-color, #d5d5d5);
      box-shadow: inset 1px 0 0
        color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    }

    .main-pole-label {
      justify-self: center;
      color: var(--secondary-text-color);
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.1em;
    }

    .main-pole-handle {
      box-sizing: border-box;
      width: 23px;
      height: 31px;
      margin-top: 5px;
      border: 1px solid
        color-mix(in srgb, var(--primary-text-color) 38%, transparent);
      border-radius: 5px;
      background: color-mix(
        in srgb,
        var(--primary-text-color) 15%,
        var(--card-background-color, #fff)
      );
      box-shadow:
        inset 0 2px 0 color-mix(in srgb, #fff 35%, transparent),
        0 1px 2px color-mix(in srgb, #000 20%, transparent);
    }

    .main-breaker-pole.left .main-pole-handle {
      justify-self: end;
      margin-right: 10px;
    }

    .main-breaker-pole.right .main-pole-handle {
      justify-self: start;
      margin-left: 10px;
    }

    .main-handle-tie {
      position: absolute;
      z-index: 2;
      top: 40px;
      left: 50%;
      box-sizing: border-box;
      width: 44px;
      height: 8px;
      border: 1px solid
        color-mix(in srgb, var(--primary-text-color) 45%, transparent);
      border-radius: 4px;
      background: color-mix(
        in srgb,
        var(--primary-text-color) 22%,
        var(--card-background-color, #fff)
      );
      box-shadow: 0 1px 2px color-mix(in srgb, #000 18%, transparent);
      transform: translateX(-50%);
    }

    .main-breaker-shared-info {
      padding: 12px 16px 14px;
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
      grid-template-columns: 24px minmax(0, 1fr) max-content;
      align-items: start;
      column-gap: 4px;
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

    .breaker.branch-double {
      grid-template-columns: 24px minmax(0, 1fr) max-content;
      min-height: 124px;
      padding-bottom: 66px;
      overflow: hidden;
    }

    .breaker.tandem-shell {
      display: block;
      min-height: 86px;
      padding: 0;
      cursor: default;
      overflow: hidden;
    }

    .tandem-half {
      position: relative;
      display: grid;
      grid-template-columns: 14px 18px minmax(0, 1fr) max-content;
      align-items: start;
      min-height: 42px;
      gap: 4px;
      box-sizing: border-box;
      padding: 4px 7px;
      outline: none;
    }

    .tandem-divider {
      height: 1px;
      background: var(--divider-color, #d5d5d5);
      pointer-events: none;
    }

    .tandem-half[role="button"] {
      cursor: pointer;
    }

    .tandem-half[role="button"]:hover {
      background: color-mix(
        in srgb,
        var(--primary-color, #03a9f4) 9%,
        transparent
      );
    }

    .tandem-half:focus-visible {
      box-shadow: inset 0 0 0 2px
        color-mix(in srgb, var(--primary-color, #03a9f4) 55%, transparent);
    }

    .tandem-handle {
      box-sizing: border-box;
      width: 10px;
      height: 18px;
      margin: 4px auto 0;
      border: 1px solid
        color-mix(in srgb, var(--primary-text-color) 42%, transparent);
      border-radius: 3px;
      background: color-mix(
        in srgb,
        var(--primary-text-color) 17%,
        var(--card-background-color, #fff)
      );
    }

    .tandem-half ha-icon {
      width: 16px;
      height: 16px;
      margin-top: 3px;
      color: var(--secondary-text-color);
    }

    .tandem-copy {
      min-width: 0;
    }

    .tandem-heading {
      overflow: hidden;
      color: var(--secondary-text-color);
      font-size: 0.62rem;
      font-weight: 700;
      line-height: 1.15;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tandem-name {
      display: -webkit-box;
      overflow: hidden;
      margin-top: 1px;
      max-height: 2.15em;
      font-size: 0.74rem;
      font-weight: 500;
      line-height: 1.08;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }

    .tandem-metrics {
      display: grid;
      justify-items: end;
      gap: 1px;
      min-width: 42px;
    }

    .tandem-state {
      font-size: 0.77rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .tandem-state.unavailable {
      color: var(--secondary-text-color);
      font-size: 0.66rem;
      font-weight: 400;
    }

    .tandem-rating {
      color: var(--secondary-text-color);
      font-size: 0.61rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .branch-double-metrics {
      display: grid;
      justify-items: end;
      gap: 2px;
    }

    .breaker-rating {
      color: var(--secondary-text-color);
      font-size: 0.68rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .branch-double-poles {
      position: absolute;
      right: 10px;
      bottom: 7px;
      left: 38px;
      top: 55px;
      display: grid;
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 18%, transparent);
      border-radius: 4px;
      background: color-mix(
        in srgb,
        var(--primary-color, #03a9f4) 4%,
        var(--secondary-background-color, #f5f5f5)
      );
      pointer-events: none;
    }

    .branch-double-pole {
      position: relative;
      min-width: 0;
    }

    .branch-double-pole.bottom {
      border-top: 1px solid var(--divider-color, #d5d5d5);
    }

    .branch-pole-handle {
      position: absolute;
      top: 50%;
      left: 50%;
      box-sizing: border-box;
      width: 12px;
      height: 16px;
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 42%, transparent);
      border-radius: 3px;
      background: color-mix(
        in srgb,
        var(--primary-text-color) 17%,
        var(--card-background-color, #fff)
      );
      transform: translate(-50%, -50%);
    }

    .branch-handle-tie {
      position: absolute;
      z-index: 2;
      top: 50%;
      left: 50%;
      width: 6px;
      height: 28px;
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 40%, transparent);
      border-radius: 3px;
      background: color-mix(
        in srgb,
        var(--primary-text-color) 22%,
        var(--card-background-color, #fff)
      );
      transform: translate(-50%, -50%);
    }

    ha-icon {
      margin-top: 1px;
      color: var(--secondary-text-color);
      --mdc-icon-size: 21px;
    }

    .breaker-copy {
      min-width: 0;
      padding-right: 2px;
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
      display: -webkit-box;
      overflow: hidden;
      margin-top: 2px;
      max-height: 2.3em;
      font-size: 0.88rem;
      font-weight: 500;
      line-height: 1.15;
      overflow-wrap: anywhere;
      text-overflow: ellipsis;
      white-space: normal;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }

    .breaker-state {
      display: flex;
      flex-shrink: 0;
      align-items: baseline;
      align-self: start;
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

    .empty-slot {
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      min-height: 58px;
      padding: 8px 10px;
      border: 1px dashed color-mix(in srgb, var(--divider-color, #d5d5d5) 78%, transparent);
      border-radius: 8px;
      color: color-mix(in srgb, var(--secondary-text-color) 65%, transparent);
      background: color-mix(
        in srgb,
        var(--secondary-background-color, #f5f5f5) 45%,
        transparent
      );
      font-size: 0.66rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .empty-slot.left {
      grid-column: 1;
    }

    .empty-slot.right {
      grid-column: 3;
    }

    .empty-slot.conflict {
      border-color: color-mix(in srgb, var(--error-color, #db4437) 55%, transparent);
      color: var(--error-color, #db4437);
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
        min-height: 154px;
      }

      .main-breaker-poles {
        min-height: 66px;
      }

      .main-breaker-pole {
        padding: 7px 7px 8px;
      }

      .main-pole-handle {
        height: 28px;
      }

      .main-handle-tie {
        top: 37px;
        width: 40px;
      }

      .main-breaker-shared-info {
        padding: 10px 10px 12px;
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
        grid-template-columns: 20px minmax(0, 1fr) max-content;
        min-height: 54px;
        padding: 6px 6px;
      }

      .empty-slot {
        min-height: 54px;
        padding: 6px;
      }

      .breaker.branch-double {
        grid-template-columns: 20px minmax(0, 1fr) max-content;
        min-height: 114px;
        padding-bottom: 61px;
      }

      .breaker.tandem-shell {
        min-height: 82px;
      }

      .tandem-half {
        grid-template-columns: 12px 16px minmax(0, 1fr) max-content;
        min-height: 40px;
        padding: 4px;
      }

      .tandem-handle {
        width: 8px;
        height: 15px;
      }

      .branch-double-poles {
        right: 6px;
        left: 30px;
        top: 51px;
      }

      .branch-pole-handle {
        width: 10px;
        height: 14px;
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
        numbering_style: "clamp",
        panel_size: DEFAULT_PANEL_SIZE,
        show_empty_positions: true,
        measurement_decimals: 1,
        energy_decimals: 2,
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
          circuit_position: index + 1,
          icon: "",
          unit: "auto",
          poles: 1,
          breaker_type: "single",
          breaker_rating: "",
          tandem_entity: "",
          tandem_name: "",
          tandem_icon: "",
          tandem_unit: "auto",
          tandem_breaker_rating: "",
        })),
      };
    }

    static getConfigForm() {
      return this._buildConfigForm(null, null, true);
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static _buildConfigForm(
      config,
      hass,
      includeDevice,
      includeEntitySelectors = true,
      includeClampTextFields = true,
      includeDisplaySettings = true,
      includeBreakerSettings = true
    ) {
      const entitySelector = {
        entity: {
          filter: {
            domain: "sensor",
          },
        },
      };
      const displaySettings = this._effectiveDisplaySettings(config);

      const clampSections = Array.from(
        { length: MAX_CLAMPS },
        (_, index) => {
          const clampNumber = index + 1;
          const clamp = this._editorClamp(config, clampNumber);
          const friendlyName =
            this._cleanText(clamp?.name) ||
            this._friendlyEntityLabel(hass, this._cleanText(clamp?.entity));
          const breakerRating = this._breakerRating(clamp?.breaker_rating);
          const breakerType = this._breakerType(clamp);
          const tandemRating = this._breakerRating(
            clamp?.tandem_breaker_rating
          );
          const circuitPosition = this._circuitPosition(
            clamp || { clamp: clampNumber }
          );
          const circuitPositionOptions = Array.from(
            { length: displaySettings.panel_size },
            (_, position) => ({
              value: position + 1,
              label: `Circuit ${position + 1}`,
            })
          );
          if (circuitPosition > displaySettings.panel_size) {
            circuitPositionOptions.push({
              value: circuitPosition,
              label: `Circuit ${circuitPosition} (outside panel)`,
            });
          }
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
              ...(includeEntitySelectors
                ? [{ name: "entity", selector: entitySelector }]
                : []),
              ...(includeClampTextFields
                ? [
                    { name: "name", selector: { text: {} } },
                    { name: "circuit", selector: { text: {} } },
                    {
                      name: "circuit_position",
                      selector: {
                        select: {
                          mode: "dropdown",
                          options: circuitPositionOptions,
                        },
                      },
                      default: circuitPosition,
                    },
                  ]
                : []),
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
              ...(includeBreakerSettings
                ? [
                    {
                      name: "breaker_type",
                      selector: {
                        select: {
                          mode: "dropdown",
                          options: [
                            { value: "single", label: "Single pole" },
                            {
                              value: "double",
                              label: "Two pole — paired with next same-side position",
                            },
                            {
                              value: "tandem",
                              label: "Tandem — two independent circuits in one position",
                            },
                          ],
                        },
                      },
                      default: "single",
                    },
                    {
                      name: "breaker_rating",
                      selector: {
                        select: {
                          mode: "dropdown",
                          options: [
                            { value: "", label: "Not shown" },
                            ...[...BREAKER_RATINGS].map((rating) => ({
                              value: rating,
                              label: `${rating} A`,
                            })),
                            ...(breakerRating && !BREAKER_RATINGS.has(breakerRating)
                              ? [
                                  {
                                    value: breakerRating,
                                    label: `${breakerRating} A (custom)`,
                                  },
                                ]
                              : []),
                          ],
                        },
                      },
                      default: "",
                    },
                    ...(breakerType === "tandem"
                      ? [
                          { name: "tandem_entity", selector: entitySelector },
                          { name: "tandem_name", selector: { text: {} } },
                          {
                            name: "tandem_icon",
                            selector: { icon: {} },
                            context: { icon_entity: "tandem_entity" },
                          },
                          {
                            name: "tandem_unit",
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
                            name: "tandem_breaker_rating",
                            selector: {
                              select: {
                                mode: "dropdown",
                                options: [
                                  { value: "", label: "Not shown" },
                                  ...[...BREAKER_RATINGS].map((rating) => ({
                                    value: rating,
                                    label: `${rating} A`,
                                  })),
                                  ...(tandemRating &&
                                  !BREAKER_RATINGS.has(tandemRating)
                                    ? [
                                        {
                                          value: tandemRating,
                                          label: `${tandemRating} A (custom)`,
                                        },
                                      ]
                                    : []),
                                ],
                              },
                            },
                            default: "",
                          },
                        ]
                      : []),
                  ]
                : []),
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
        circuit_position: "Physical circuit position",
        icon: "Icon",
        unit: "Display unit",
        breaker_type: "Breaker type",
        breaker_rating: "Breaker rating",
        tandem_entity: "Tandem second circuit entity",
        tandem_name: "Tandem second circuit display name",
        tandem_icon: "Tandem second circuit icon",
        tandem_unit: "Tandem second circuit display unit",
        tandem_breaker_rating: "Tandem second circuit breaker rating",
        clamp: "SEM clamp number",
        numbering_style: "Circuit numbering style",
        panel_size: "Panel size",
        show_empty_positions: "Show unused breaker positions",
        measurement_decimals: "Power/current decimals",
        energy_decimals: "Energy decimals",
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
          schema: [
            { name: "title", selector: { text: {} } },
            ...(includeDisplaySettings
              ? [
                  {
                    name: "numbering_style",
                    selector: {
                      select: {
                        mode: "dropdown",
                        options: [
                          { value: "clamp", label: "Clamp" },
                          { value: "circuit", label: "Circuit" },
                          { value: "number", label: "Number only" },
                        ],
                      },
                    },
                    default: "clamp",
                  },
                  {
                    name: "panel_size",
                    selector: {
                      select: {
                        mode: "dropdown",
                        options: [...PANEL_SIZES].map((size) => ({
                          value: size,
                          label: `${size} positions`,
                        })),
                      },
                    },
                    default: DEFAULT_PANEL_SIZE,
                  },
                  {
                    name: "show_empty_positions",
                    selector: { boolean: {} },
                    default: true,
                  },
                  {
                    name: "measurement_decimals",
                    selector: {
                      select: {
                        mode: "dropdown",
                        options: [
                          { value: 0, label: "0 decimals" },
                          { value: 1, label: "1 decimal" },
                          { value: 2, label: "2 decimals" },
                        ],
                      },
                    },
                    default: 1,
                  },
                  {
                    name: "energy_decimals",
                    selector: {
                      select: {
                        mode: "dropdown",
                        options: [
                          { value: 0, label: "0 decimals" },
                          { value: 1, label: "1 decimal" },
                          { value: 2, label: "2 decimals" },
                          { value: 3, label: "3 decimals" },
                        ],
                      },
                    },
                    default: 2,
                  },
                ]
              : []),
          ],
        },
        {
          type: "expandable",
          name: "main",
          title: "Main Breaker",
          icon: "mdi:electric-switch",
          schema: [
            { name: "name", selector: { text: {} } },
            ...(includeEntitySelectors
              ? [
                  { name: "power_entity", selector: entitySelector },
                  { name: "current_entity", selector: entitySelector },
                  { name: "line_1_entity", selector: entitySelector },
                  { name: "line_2_entity", selector: entitySelector },
                ]
              : []),
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
          if (schema.name === "breaker_type") {
            return "A two-pole breaker consumes the next same-side position, two circuit numbers later.";
          }
          if (schema.name === "breaker_rating") {
            return "Display-only breaker rating; it does not affect measurements or safety logic.";
          }
          if (schema.name === "tandem_entity") {
            return "Independent measurement for the lower tandem half; it is never assigned automatically.";
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
          if (
            config.panel_positions !== undefined &&
            !Array.isArray(config.panel_positions) &&
            (config.panel_positions === null ||
              typeof config.panel_positions !== "object")
          ) {
            throw new Error("'panel_positions' must be a list or indexed object.");
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
        const breakerType = this._breakerType(sourceClamp);
        const breakerRating = this._breakerRating(sourceClamp.breaker_rating);
        clamps.push({
          clamp: clampNumber,
          entity: this._cleanText(sourceClamp.entity),
          name: this._cleanText(sourceClamp.name),
          circuit: this._cleanText(sourceClamp.circuit),
          circuit_position: this._explicitCircuitPosition(
            sourceClamp.circuit_position
          ),
          icon: this._cleanText(sourceClamp.icon),
          unit: VALID_UNITS.has(requestedUnit) ? requestedUnit : "auto",
          poles: breakerType === "double" ? 2 : 1,
          breaker_type: breakerType,
          breaker_rating: breakerRating,
          tandem_entity: this._cleanText(sourceClamp.tandem_entity),
          tandem_name: this._cleanText(sourceClamp.tandem_name),
          tandem_icon: this._cleanText(sourceClamp.tandem_icon),
          tandem_unit: VALID_UNITS.has(
            this._cleanText(sourceClamp.tandem_unit)
          )
            ? this._cleanText(sourceClamp.tandem_unit)
            : "auto",
          tandem_breaker_rating: this._breakerRating(
            sourceClamp.tandem_breaker_rating
          ),
        });
      }

      clamps.sort((left, right) => left.clamp - right.clamp);
      const panelPositions = this._normalizePanelPositions(
        config.panel_positions
      );
      const requestedNumberingStyle = this._cleanText(
        config.numbering_style
      ).toLowerCase();
      const requestedPanelSize = Number(config.panel_size);
      const requestedMeasurementDecimals =
        config.measurement_decimals === null ||
        config.measurement_decimals === ""
          ? Number.NaN
          : Number(config.measurement_decimals);
      const requestedEnergyDecimals =
        config.energy_decimals === null || config.energy_decimals === ""
          ? Number.NaN
          : Number(config.energy_decimals);
      return {
        type: CARD_TYPE,
        title: this._cleanText(config.title) || "Electrical Panel",
        device_id: this._cleanText(config.device_id),
        numbering_style: NUMBERING_STYLES.has(requestedNumberingStyle)
          ? requestedNumberingStyle
          : "clamp",
        panel_size: PANEL_SIZES.has(requestedPanelSize)
          ? requestedPanelSize
          : DEFAULT_PANEL_SIZE,
        show_empty_positions:
          config.show_empty_positions === undefined
            ? true
            : config.show_empty_positions === true,
        measurement_decimals: MEASUREMENT_DECIMALS.has(
          requestedMeasurementDecimals
        )
          ? requestedMeasurementDecimals
          : 1,
        energy_decimals: ENERGY_DECIMALS.has(requestedEnergyDecimals)
          ? requestedEnergyDecimals
          : 2,
        main,
        clamps,
        panel_positions: panelPositions,
      };
    }

    static _normalizePanelPositions(source) {
      const entries =
        Array.isArray(source) || (source && typeof source === "object")
          ? Object.entries(source)
          : [];
      const seen = new Set();
      const positions = [];
      for (const [, candidate] of entries) {
        if (!candidate || typeof candidate !== "object") {
          continue;
        }
        const position = Number(candidate.position);
        if (
          !Number.isSafeInteger(position) ||
          position < 1 ||
          position > MAX_PANEL_POSITIONS ||
          seen.has(position)
        ) {
          continue;
        }
        seen.add(position);
        const breakerType = this._breakerType(candidate);
        const unit = this._cleanText(candidate.unit);
        const tandemUnit = this._cleanText(candidate.tandem_unit);
        positions.push({
          ...candidate,
          position,
          entity: this._cleanText(candidate.entity),
          name: this._cleanText(candidate.name),
          circuit: this._cleanText(candidate.circuit),
          icon: this._cleanText(candidate.icon),
          unit: VALID_UNITS.has(unit) ? unit : "auto",
          poles: breakerType === "double" ? 2 : 1,
          breaker_type: breakerType,
          breaker_rating: this._breakerRating(candidate.breaker_rating),
          tandem_entity: this._cleanText(candidate.tandem_entity),
          tandem_name: this._cleanText(candidate.tandem_name),
          tandem_icon: this._cleanText(candidate.tandem_icon),
          tandem_unit: VALID_UNITS.has(tandemUnit) ? tandemUnit : "auto",
          tandem_breaker_rating: this._breakerRating(
            candidate.tandem_breaker_rating
          ),
        });
      }
      return positions.sort((left, right) => left.position - right.position);
    }

    static _configPanelPositionMap(config) {
      return new Map(
        this._normalizePanelPositions(config?.panel_positions).map((entry) => [
          entry.position,
          entry,
        ])
      );
    }

    static _breakerType(clamp) {
      const requested = this._cleanText(clamp?.breaker_type).toLowerCase();
      if (BREAKER_TYPES.has(requested)) {
        return requested;
      }
      return Number(clamp?.poles) === 2 ? "double" : "single";
    }

    static _explicitCircuitPosition(value) {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const position = Number(value);
      return Number.isSafeInteger(position) && position > 0 ? position : null;
    }

    static _circuitPosition(clamp) {
      return (
        this._explicitCircuitPosition(clamp?.circuit_position) ||
        Number(clamp?.clamp)
      );
    }

    static _configuredCircuitHeading(clamp) {
      const configured = this._cleanText(clamp?.circuit);
      if (
        this._explicitCircuitPosition(clamp?.circuit_position) !== null &&
        /^(?:(?:ckt|circuit|clamp)\s*|#\s*)?\d+(?:\s*[-–/]\s*\d+)?$/iu.test(
          configured
        )
      ) {
        return "";
      }
      return configured;
    }

    static _breakerRating(value) {
      if (value === null || value === undefined || value === "") {
        return "";
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 && numeric <= 1000
        ? numeric
        : "";
    }

    static _pairedCircuit(start, panelSize = DEFAULT_PANEL_SIZE) {
      const position = Number(start);
      const size = PANEL_SIZES.has(Number(panelSize))
        ? Number(panelSize)
        : DEFAULT_PANEL_SIZE;
      return Number.isInteger(position) && position >= 1 && position + 2 <= size
        ? position + 2
        : null;
    }

    static _positionLabel(position, numberingStyle = "clamp") {
      const style = NUMBERING_STYLES.has(numberingStyle)
        ? numberingStyle
        : "clamp";
      if (style === "circuit") {
        return `Circuit ${position}`;
      }
      if (style === "number") {
        return `#${position}`;
      }
      return `Clamp ${position}`;
    }

    static _branchPairPlan(
      clamps,
      panelSize = DEFAULT_PANEL_SIZE,
      requirePrimaryEntity = false
    ) {
      const size = PANEL_SIZES.has(Number(panelSize))
        ? Number(panelSize)
        : DEFAULT_PANEL_SIZE;
      const plan = new Map();
      plan.byClamp = new Map();
      plan.panelSize = size;
      const grouped = new Map();

      for (const clamp of Array.isArray(clamps) ? clamps : []) {
        const clampNumber = Number(clamp?.clamp);
        if (
          !Number.isInteger(clampNumber) ||
          clampNumber < 1 ||
          clampNumber > MAX_CLAMPS ||
          plan.byClamp.has(clampNumber)
        ) {
          continue;
        }
        const position = this._circuitPosition(clamp);
        const entry = {
          kind: "single",
          clamp,
          clampNumber,
          owner: position,
          position,
          warning: "",
        };
        plan.byClamp.set(clampNumber, entry);
        if (!Number.isInteger(position) || position < 1 || position > size) {
          entry.kind = "invalid";
          entry.warning = `Clamp ${clampNumber} keeps Circuit ${position}, which is outside the selected ${size}-position panel.`;
          continue;
        }
        if (!grouped.has(position)) {
          grouped.set(position, []);
        }
        grouped.get(position).push(entry);
      }

      for (const [position, entries] of grouped) {
        if (entries.length === 1) {
          plan.set(position, entries[0]);
          continue;
        }
        const clampNumbers = entries.map((entry) => entry.clampNumber).join(", ");
        const warning = `Circuit ${position} is assigned to multiple clamps (${clampNumbers}); none is rendered at that position.`;
        for (const entry of entries) {
          entry.kind = "conflict";
          entry.warning = warning;
        }
        plan.set(position, {
          kind: "conflict",
          position,
          entries,
          warning,
        });
      }

      for (let position = 1; position <= size; position += 1) {
        const entry = plan.get(position);
        if (!entry || entry.kind !== "single") {
          continue;
        }
        const breakerType = this._breakerType(entry.clamp);
        if (breakerType === "tandem") {
          const primaryEntity = this._cleanText(entry.clamp?.entity);
          const tandemEntity = this._cleanText(entry.clamp?.tandem_entity);
          if (!tandemEntity) {
            entry.warning = `Circuit ${position} tandem second circuit is not configured.`;
          } else if (primaryEntity && primaryEntity === tandemEntity) {
            entry.warning = `Circuit ${position} uses the same entity for both tandem halves; assignments are preserved for correction.`;
          }
          continue;
        }
        if (breakerType !== "double") {
          continue;
        }
        const paired = this._pairedCircuit(position, size);
        if (paired === null) {
          entry.warning = `Circuit ${position} has no following same-side position and cannot start a two-pole breaker.`;
          continue;
        }
        if (
          requirePrimaryEntity &&
          !this._cleanText(entry.clamp?.entity)
        ) {
          entry.warning = `Clamp ${entry.clampNumber} needs a primary entity before it can consume Circuit ${paired}.`;
          continue;
        }
        const target = plan.get(paired);
        if (target?.kind === "conflict") {
          entry.warning = `Circuit ${paired} has conflicting clamp assignments, so Circuit ${position} renders as single pole.`;
          continue;
        }
        if (target?.kind === "consumed") {
          entry.warning = `Circuit ${paired} is already consumed by Circuit ${target.owner}.`;
          continue;
        }

        entry.kind = "owner";
        entry.paired = paired;
        if (target) {
          target.kind = "consumed";
          target.owner = position;
          if (this._breakerType(target.clamp) === "double") {
            target.warning = `Clamp ${target.clampNumber} cannot start a pair because Circuit ${paired} is already used by Circuit ${position}.`;
          }
        } else {
          plan.set(paired, {
            kind: "consumed",
            owner: position,
            position: paired,
            clamp: null,
            warning: "",
          });
        }
      }
      return plan;
    }

    static _physicalPositionStatus(plan, position) {
      const entry = plan?.get(Number(position));
      if (!entry) return "Empty";
      if (entry.kind === "consumed") {
        return `Used as second pole by Position ${entry.owner}`;
      }
      if (entry.kind === "conflict" || entry.conflict) return "Conflict";
      if (this._breakerType(entry.item) === "tandem") return "Tandem";
      if (entry.kind === "owner") return "Two pole start";
      if (entry.source === "panel_position") return "Explicitly configured";
      if (entry.source === "clamp") {
        return `Assigned from SEM Clamp ${entry.clampNumber}`;
      }
      return "Empty";
    }

    static _physicalPositionPlan(
      clamps,
      panelPositions,
      panelSize = DEFAULT_PANEL_SIZE,
      requirePrimaryEntity = false
    ) {
      const size = PANEL_SIZES.has(Number(panelSize))
        ? Number(panelSize)
        : DEFAULT_PANEL_SIZE;
      const plan = new Map();
      plan.panelSize = size;
      plan.outOfRange = [];
      const normalizedPositions = this._normalizePanelPositions(panelPositions);
      if (!normalizedPositions.some((entry) => entry.position <= size)) {
        const legacyPlan = this._branchPairPlan(
          clamps,
          size,
          requirePrimaryEntity
        );
        legacyPlan.outOfRange = normalizedPositions.filter(
          (entry) => entry.position > size
        );
        for (const entry of legacyPlan.values()) {
          if (entry?.clamp) {
            entry.item = entry.clamp;
            entry.source = "clamp";
          }
        }
        return legacyPlan;
      }
      const clampGroups = new Map();
      for (const clamp of Array.isArray(clamps) ? clamps : []) {
        const clampNumber = Number(clamp?.clamp);
        if (!Number.isInteger(clampNumber) || clampNumber < 1 || clampNumber > MAX_CLAMPS) {
          continue;
        }
        const position = this._circuitPosition(clamp);
        if (!Number.isInteger(position) || position < 1 || position > size) {
          continue;
        }
        if (!clampGroups.has(position)) clampGroups.set(position, []);
        clampGroups.get(position).push(clamp);
      }
      const explicitMap = new Map();
      for (const entry of normalizedPositions) {
        explicitMap.set(entry.position, entry);
        if (entry.position > size) plan.outOfRange.push(entry);
      }

      for (let position = 1; position <= size; position += 1) {
        const explicit = explicitMap.get(position);
        const assignedClamps = clampGroups.get(position) || [];
        if (explicit) {
          const conflict = assignedClamps.length > 0;
          plan.set(position, {
            kind: "single",
            position,
            owner: position,
            item: explicit,
            clamp: explicit,
            source: "panel_position",
            assignedClamps,
            conflict,
            warning: conflict
              ? `Position ${position} has an explicit override and is also assigned from ${assignedClamps
                  .map((clamp) => `Clamp ${clamp.clamp}`)
                  .join(", ")}. The explicit position is rendered; all configurations are preserved.`
              : "",
          });
        } else if (assignedClamps.length === 1) {
          plan.set(position, {
            kind: "single",
            position,
            owner: position,
            item: assignedClamps[0],
            clamp: assignedClamps[0],
            source: "clamp",
            clampNumber: assignedClamps[0].clamp,
            warning: "",
          });
        } else if (assignedClamps.length > 1) {
          plan.set(position, {
            kind: "conflict",
            position,
            entries: assignedClamps,
            warning: `Position ${position} is assigned to multiple clamps (${assignedClamps
              .map((clamp) => clamp.clamp)
              .join(", ")}); none is rendered at that position.`,
          });
        }
      }

      for (let position = 1; position <= size; position += 1) {
        const entry = plan.get(position);
        if (!entry || entry.kind !== "single") continue;
        const breakerType = this._breakerType(entry.item);
        if (breakerType === "tandem") {
          const primary = this._cleanText(entry.item.entity);
          const secondary = this._cleanText(entry.item.tandem_entity);
          if (!secondary && !entry.warning) {
            entry.warning = `Position ${position} tandem second circuit is not configured.`;
          } else if (primary && primary === secondary) {
            entry.warning = `Position ${position} uses the same entity for both tandem halves; assignments are preserved for correction.`;
          }
          continue;
        }
        if (breakerType !== "double") continue;
        const paired = this._pairedCircuit(position, size);
        if (paired === null) {
          entry.warning = `Position ${position} has no following same-side position and cannot start a two-pole breaker.`;
          continue;
        }
        if (requirePrimaryEntity && !this._cleanText(entry.item.entity)) {
          entry.warning = `Position ${position} needs a primary entity before it can consume Position ${paired}.`;
          continue;
        }
        const target = plan.get(paired);
        if (target?.kind === "conflict") {
          entry.warning = `Position ${paired} has conflicting assignments, so Position ${position} renders as single pole.`;
          continue;
        }
        if (target?.kind === "consumed") {
          entry.warning = `Position ${paired} is already consumed by Position ${target.owner}.`;
          continue;
        }
        entry.kind = "owner";
        entry.paired = paired;
        plan.set(paired, {
          kind: "consumed",
          owner: position,
          position: paired,
          preserved: target || null,
          warning: target
            ? `${
                this._breakerType(target.item) === "double"
                  ? `Position ${paired} cannot start its configured pair. `
                  : ""
              }Position ${paired}'s configuration is preserved but is consumed by the two-pole breaker at Position ${position}.`
            : "",
        });
      }
      return plan;
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

    static _effectiveDisplaySettings(config) {
      const numberingStyle = this._cleanText(
        config?.numbering_style
      ).toLowerCase();
      const panelSize = Number(config?.panel_size);
      const rawMeasurement = config?.measurement_decimals;
      const measurementDecimals =
        rawMeasurement === null || rawMeasurement === ""
          ? Number.NaN
          : Number(rawMeasurement);
      const rawEnergy = config?.energy_decimals;
      const energyDecimals =
        rawEnergy === null || rawEnergy === ""
          ? Number.NaN
          : Number(rawEnergy);
      return {
        numbering_style: NUMBERING_STYLES.has(numberingStyle)
          ? numberingStyle
          : "clamp",
        panel_size: PANEL_SIZES.has(panelSize)
          ? panelSize
          : DEFAULT_PANEL_SIZE,
        show_empty_positions:
          config?.show_empty_positions === undefined
            ? true
            : config.show_empty_positions === true,
        measurement_decimals: MEASUREMENT_DECIMALS.has(measurementDecimals)
          ? measurementDecimals
          : 1,
        energy_decimals: ENERGY_DECIMALS.has(energyDecimals)
          ? energyDecimals
          : 2,
      };
    }

    static _formatNumber(value, decimals, hass) {
      const safeDecimals = Number.isInteger(decimals)
        ? Math.min(Math.max(decimals, 0), 3)
        : 1;
      let rounded = Number(value.toFixed(safeDecimals));
      if (Object.is(rounded, -0)) {
        rounded = 0;
      }
      const locale =
        this._cleanText(hass?.locale?.language) ||
        this._cleanText(hass?.language) ||
        undefined;
      try {
        return new Intl.NumberFormat(locale, {
          maximumFractionDigits: safeDecimals,
          minimumFractionDigits: 0,
          useGrouping: true,
        }).format(rounded);
      } catch (_error) {
        return String(rounded);
      }
    }

    static _isEnergyUnit(unit) {
      return ["wh", "kwh", "mwh", "gwh"].includes(
        this._cleanText(unit).toLowerCase()
      );
    }

    static _formatEntity(
      hass,
      entityId,
      requestedUnit = "auto",
      measurementDecimals = 1,
      energyDecimals = 2
    ) {
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
      const normalizedState = rawState.trim().toLowerCase();
      if (normalizedState === "" || normalizedState === "unavailable") {
        return {
          available: false,
          value: "Unavailable",
          unit: "",
          numeric: null,
        };
      }
      if (normalizedState === "unknown") {
        return {
          available: false,
          value: "Unknown",
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
      const requestedMeasurementDecimals = Number(measurementDecimals);
      const requestedEnergyDecimals = Number(energyDecimals);
      const decimals = this._isEnergyUnit(formatUnit)
        ? ENERGY_DECIMALS.has(requestedEnergyDecimals)
          ? requestedEnergyDecimals
          : 2
        : MEASUREMENT_DECIMALS.has(requestedMeasurementDecimals)
        ? requestedMeasurementDecimals
        : 1;
      return {
        available: true,
        value: this._formatNumber(converted, decimals, hass),
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

    static _cleanCircuitDisplayName(rawName, selectedDeviceName = "") {
      const original = this._cleanText(rawName).replace(/\s+/gu, " ");
      if (!original) {
        return this._cleanText(rawName) || "Unnamed circuit";
      }

      let cleaned = original;
      const deviceName = this._cleanText(selectedDeviceName).replace(
        /\s+/gu,
        " "
      );
      if (
        deviceName &&
        cleaned.length > deviceName.length &&
        cleaned.slice(0, deviceName.length).toLocaleLowerCase() ===
          deviceName.toLocaleLowerCase() &&
        /^\s/u.test(cleaned.slice(deviceName.length))
      ) {
        cleaned = cleaned.slice(deviceName.length).trim();
      }

      if (/^sem meter\s+/iu.test(cleaned)) {
        cleaned = cleaned.replace(/^sem meter\s+/iu, "").trim();
      }
      cleaned = cleaned.replace(/\s+(?:power|current|energy)$/iu, "").trim();
      return cleaned || original;
    }

    static _formatCircuitHeading(
      physicalPosition,
      configuredCircuit = "",
      numberingStyle = "clamp",
      pairedPosition = null
    ) {
      const style = NUMBERING_STYLES.has(numberingStyle)
        ? numberingStyle
        : "clamp";
      const configured = this._cleanText(configuredCircuit).replace(
        /\s+/gu,
        " "
      );
      const numericHeading = configured.match(
        /^(?:(?:ckt|circuit|clamp)\s*|#\s*)?(\d+(?:\s*[-–/]\s*\d+)?)$/iu
      );
      if (configured && !numericHeading) {
        return configured;
      }
      let number = numericHeading
        ? numericHeading[1].replace(/\s+/gu, "")
        : String(physicalPosition);
      if (pairedPosition !== null && !number.match(/[-–/]/u)) {
        const numericStart = Number(number);
        number = Number.isInteger(numericStart)
          ? `${numericStart}–${numericStart + (pairedPosition - physicalPosition)}`
          : `${physicalPosition}–${pairedPosition}`;
      }
      if (style === "circuit") {
        return `CIRCUIT ${number}`;
      }
      if (style === "number") {
        return `#${number}`;
      }
      return `CLAMP ${number}`;
    }

    static _formatTandemHeading(
      physicalPosition,
      suffix,
      numberingStyle = "clamp"
    ) {
      const style = NUMBERING_STYLES.has(numberingStyle)
        ? numberingStyle
        : "clamp";
      const number = `${physicalPosition}${suffix}`;
      if (style === "circuit") {
        return `CIRCUIT ${number}`;
      }
      if (style === "number") {
        return `#${number}`;
      }
      return `CLAMP ${number}`;
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
      if (Array.isArray(config?.panel_positions)) {
        copy.panel_positions = config.panel_positions.map((entry) =>
          entry && typeof entry === "object" ? { ...entry } : entry
        );
      } else if (
        config?.panel_positions &&
        typeof config.panel_positions === "object"
      ) {
        copy.panel_positions = Object.fromEntries(
          Object.entries(config.panel_positions).map(([key, entry]) => [
            key,
            entry && typeof entry === "object" ? { ...entry } : entry,
          ])
        );
      } else {
        copy.panel_positions = [];
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

    static _matchRole(entries, hass, role, predicate = null) {
      let candidates = entries
        .filter((entry) => !predicate || predicate(entry))
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

    static _normalizeSourceName(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/\s+/gu, " ")
        .trim();
    }

    static _mappingSourceScore(entry, hass, clampNumber) {
      const expected = `sem clamp ${clampNumber} source`;
      const originalName = this._normalizeMatchText(entry.original_name);
      if (originalName === expected) {
        return 400;
      }

      const uniqueId = this._normalizeMatchText(entry.unique_id);
      if (` ${uniqueId} `.includes(` ${expected} `)) {
        return 300;
      }

      const entityId = this._normalizeMatchText(entry.entity_id);
      if (` ${entityId} `.includes(` ${expected} `)) {
        return 200;
      }

      const friendlyName = this._normalizeMatchText(
        hass?.states?.[entry.entity_id]?.attributes?.friendly_name
      );
      if (` ${friendlyName} `.includes(` ${expected} `)) {
        return 100;
      }
      return 0;
    }

    static _mappingClampNumber(entry, hass) {
      for (let clamp = 1; clamp <= MAX_CLAMPS; clamp += 1) {
        if (this._mappingSourceScore(entry, hass, clamp) > 0) {
          return clamp;
        }
      }
      return 0;
    }

    static _mappingState(entry, hass) {
      const rawState = hass?.states?.[entry.entity_id]?.state;
      if (typeof rawState !== "string") {
        return { value: "", error: "mapping state is unavailable" };
      }
      const value = rawState.replace(/\s+/gu, " ").trim();
      const normalized = value.toLowerCase();
      if (
        !value ||
        normalized === "unknown" ||
        normalized === "unavailable"
      ) {
        return { value: "", error: "mapping state is unavailable" };
      }
      if (value.length > 255) {
        return { value: "", error: "mapping state is too long" };
      }
      if (/[\u0000-\u001f\u007f]/u.test(value) || !/\s+power$/iu.test(value)) {
        return { value: "", error: "mapping state is malformed" };
      }
      return { value, error: "" };
    }

    static _isClampPowerTarget(entry, hass) {
      if (
        !entry ||
        typeof entry.entity_id !== "string" ||
        !entry.entity_id.startsWith("sensor.") ||
        this._mappingClampNumber(entry, hass) > 0
      ) {
        return false;
      }

      const stateObject = hass?.states?.[entry.entity_id];
      const deviceClass = this._cleanText(
        entry.original_device_class ||
          entry.device_class ||
          stateObject?.attributes?.device_class
      ).toLowerCase();
      if (deviceClass && deviceClass !== "power") {
        return false;
      }

      const unit = this._cleanText(
        stateObject?.attributes?.unit_of_measurement
      );
      if (unit && !["W", "mW", "kW", "MW", "GW"].includes(unit)) {
        return false;
      }

      const roleText = [
        entry.original_name,
        stateObject?.attributes?.friendly_name,
        entry.entity_id,
      ]
        .map((value) => this._normalizeMatchText(value))
        .join(" ");
      return !(
        /\bdaily energy\b/u.test(roleText) ||
        /\bbalance power\b/u.test(roleText) ||
        /\b(?:total )?main power\b/u.test(roleText) ||
        /\b(?:main )?phase [abc] power\b/u.test(roleText) ||
        /\b(?:line [12]|l[12]) power\b/u.test(roleText)
      );
    }

    static _selectorEntityLabel(entry, hass) {
      return (
        this._cleanText(entry?.original_name) ||
        this._cleanText(
          hass?.states?.[entry?.entity_id]?.attributes?.friendly_name
        ) ||
        this._friendlyEntityLabel(hass, entry?.entity_id)
      );
    }

    static _selectorMeasurementKind(entry, hass) {
      const stateObject = hass?.states?.[entry?.entity_id];
      const deviceClass = this._cleanText(
        entry?.original_device_class ||
          entry?.device_class ||
          stateObject?.attributes?.device_class
      ).toLowerCase();
      if (["power", "current", "energy"].includes(deviceClass)) {
        return deviceClass;
      }

      const unit = this._cleanText(
        stateObject?.attributes?.unit_of_measurement
      ).toLowerCase();
      if (["w", "mw", "kw", "gw"].includes(unit)) {
        return "power";
      }
      if (["a", "ma", "ka"].includes(unit)) {
        return "current";
      }
      if (["wh", "mwh", "kwh", "gwh"].includes(unit)) {
        return "energy";
      }

      const text = this._normalizeMatchText(
        `${entry?.original_name || ""} ${
          stateObject?.attributes?.friendly_name || ""
        } ${entry?.entity_id || ""}`
      );
      if (/\b(?:daily )?energy\b/u.test(text)) {
        return "energy";
      }
      if (/\bcurrent\b/u.test(text)) {
        return "current";
      }
      if (/\bpower\b/u.test(text)) {
        return "power";
      }
      return "";
    }

    static _selectorFieldKind(field) {
      return /energy/iu.test(field)
        ? "energy"
        : /current/iu.test(field)
        ? "current"
        : "power";
    }

    static _selectorEntityAllowed(entry, hass, field, configuredEntityId) {
      if (
        !entry ||
        typeof entry.entity_id !== "string" ||
        !entry.entity_id.startsWith("sensor.") ||
        this._mappingClampNumber(entry, hass) > 0
      ) {
        return false;
      }

      const isConfigured = entry.entity_id === configuredEntityId;
      if (isConfigured) {
        return true;
      }
      const stateObject = hass?.states?.[entry.entity_id];
      const category = this._cleanText(
        entry.entity_category || stateObject?.attributes?.entity_category
      ).toLowerCase();
      if (category === "diagnostic" || category === "config") {
        return false;
      }

      const kind = this._selectorMeasurementKind(entry, hass);
      return kind === this._selectorFieldKind(field);
    }

    static _selectorClampNumbers(entries, hass) {
      const numbers = new Map();
      const entriesByDevice = new Map();
      for (const entry of entries) {
        const deviceId = entry.device_id || "";
        if (!entriesByDevice.has(deviceId)) {
          entriesByDevice.set(deviceId, []);
        }
        entriesByDevice.get(deviceId).push(entry);
      }
      for (const deviceEntries of entriesByDevice.values()) {
        for (let clamp = 1; clamp <= MAX_CLAMPS; clamp += 1) {
          const explicit = this._matchExplicitClampMapping(
            deviceEntries,
            hass,
            clamp
          );
          if (explicit.match) {
            numbers.set(explicit.match.entity_id, clamp);
          }
        }
      }
      return numbers;
    }

    static _selectorNumericOrder(entry, hass, clampNumbers) {
      if (clampNumbers.has(entry.entity_id)) {
        return clampNumbers.get(entry.entity_id);
      }
      const text = this._normalizeMatchText(
        `${entry.original_name || ""} ${
          hass?.states?.[entry.entity_id]?.attributes?.friendly_name || ""
        } ${entry.entity_id}`
      );
      const match = text.match(/\b(?:clamp|circuit|ct|channel)\s+(\d+)\b/u);
      return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
    }

    static _selectorGroup(entry, hass, clampNumbers) {
      if (clampNumbers.has(entry.entity_id)) {
        return "Circuits";
      }
      const text = this._normalizeMatchText(
        `${entry.original_name || ""} ${
          hass?.states?.[entry.entity_id]?.attributes?.friendly_name || ""
        } ${entry.entity_id}`
      );
      if (
        /\b(?:main|total)\s+(?:power|current)\b/u.test(text) ||
        /\b(?:phase\s+[abc]|line\s+[123]|l[123])(?:\s+\w+)*\s+(?:power|current)\b/u.test(
          text
        )
      ) {
        return "Main";
      }
      if (/\b(?:clamp|circuit|ct|channel)\s+\d+\b/u.test(text)) {
        return "Circuits";
      }
      return "Other compatible entities";
    }

    static _selectorDeviceLabel(device, deviceId) {
      return (
        this._cleanText(device?.name_by_user) ||
        this._cleanText(device?.name) ||
        deviceId ||
        "Entities without a device"
      );
    }

    static _buildEntityChoiceGroups(
      registryEntries,
      deviceRegistry,
      hass,
      selectedDeviceId,
      showAllEntities,
      field,
      configuredEntityId = ""
    ) {
      const entries = (Array.isArray(registryEntries)
        ? registryEntries
        : []
      ).filter((entry) => entry && typeof entry.entity_id === "string");
      if (
        configuredEntityId &&
        !entries.some((entry) => entry.entity_id === configuredEntityId) &&
        hass?.states?.[configuredEntityId]
      ) {
        entries.push({ entity_id: configuredEntityId, device_id: "" });
      }

      const clampNumbers = this._selectorClampNumbers(entries, hass);
      const compatible = entries.filter(
        (entry) =>
          this._selectorEntityAllowed(
            entry,
            hass,
            field,
            configuredEntityId
          ) &&
          (showAllEntities ||
            entry.device_id === selectedDeviceId ||
            entry.entity_id === configuredEntityId)
      );
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      });
      const toOption = (entry) => ({
        value: entry.entity_id,
        label: this._selectorEntityLabel(entry, hass),
        deviceId: entry.device_id || "",
        numericOrder: this._selectorNumericOrder(
          entry,
          hass,
          clampNumbers
        ),
      });
      const sortOptions = (left, right) =>
        left.numericOrder - right.numericOrder ||
        collator.compare(left.label, right.label) ||
        left.value.localeCompare(right.value);

      const groups = [];
      const selectedEntries = compatible.filter(
        (entry) =>
          entry.device_id === selectedDeviceId ||
          entry.entity_id === configuredEntityId
      );
      for (const label of ["Main", "Circuits", "Other compatible entities"]) {
        const options = selectedEntries
          .filter(
            (entry) =>
              this._selectorGroup(entry, hass, clampNumbers) === label
          )
          .map(toOption)
          .sort(sortOptions);
        if (options.length > 0) {
          groups.push({ label, options });
        }
      }

      if (showAllEntities) {
        const devices = new Map(
          (Array.isArray(deviceRegistry) ? deviceRegistry : []).map(
            (device) => [device.id, device]
          )
        );
        const byDevice = new Map();
        for (const entry of compatible) {
          if (
            entry.device_id === selectedDeviceId ||
            entry.entity_id === configuredEntityId
          ) {
            continue;
          }
          const deviceId = entry.device_id || "";
          if (!byDevice.has(deviceId)) {
            byDevice.set(deviceId, []);
          }
          byDevice.get(deviceId).push(toOption(entry));
        }
        for (const [deviceId, options] of [...byDevice.entries()].sort(
          ([left], [right]) =>
            collator.compare(
              this._selectorDeviceLabel(devices.get(left), left),
              this._selectorDeviceLabel(devices.get(right), right)
            )
        )) {
          groups.push({
            label: this._selectorDeviceLabel(devices.get(deviceId), deviceId),
            options: options.sort(sortOptions),
          });
        }
      }
      return groups;
    }

    static _mappingTargetMatches(entry, hass, sourceName) {
      const normalizedSource = this._normalizeSourceName(sourceName);
      const originalName = this._cleanText(entry.original_name);
      if (originalName) {
        return this._normalizeSourceName(originalName) === normalizedSource;
      }

      const friendlyName = this._normalizeSourceName(
        hass?.states?.[entry.entity_id]?.attributes?.friendly_name
      );
      if (
        friendlyName === normalizedSource ||
        friendlyName.endsWith(` ${normalizedSource}`)
      ) {
        return true;
      }

      const entityText = this._normalizeMatchText(entry.entity_id);
      const sourceText = this._normalizeMatchText(sourceName);
      return (
        entityText === sourceText ||
        entityText.endsWith(` ${sourceText}`)
      );
    }

    static _matchExplicitClampMapping(entries, hass, clampNumber) {
      const mappingCandidates = entries
        .map((entry) => ({
          entry,
          score: this._mappingSourceScore(entry, hass, clampNumber),
        }))
        .filter(({ score }) => score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.entry.entity_id.localeCompare(right.entry.entity_id)
        );

      if (mappingCandidates.length === 0) {
        return {
          match: null,
          ambiguous: [],
          invalidMapping: "",
          mappingFound: false,
        };
      }

      const strongestScore = mappingCandidates[0].score;
      const strongestMappings = mappingCandidates.filter(
        ({ score }) => score === strongestScore
      );
      if (strongestMappings.length !== 1) {
        return {
          match: null,
          ambiguous: [],
          invalidMapping: "multiple mapping source entities",
          mappingFound: true,
        };
      }

      const mapping = strongestMappings[0].entry;
      const mappingState = this._mappingState(mapping, hass);
      if (mappingState.error) {
        return {
          match: null,
          ambiguous: [],
          invalidMapping: mappingState.error,
          mappingFound: true,
        };
      }

      const targets = entries.filter(
        (entry) =>
          this._isClampPowerTarget(entry, hass) &&
          this._mappingTargetMatches(entry, hass, mappingState.value)
      );
      if (targets.length === 1) {
        return {
          match: targets[0],
          ambiguous: [],
          invalidMapping: "",
          mappingFound: true,
        };
      }
      if (targets.length > 1) {
        return {
          match: null,
          ambiguous: targets
            .map((entry) => entry.entity_id)
            .sort((left, right) => left.localeCompare(right)),
          invalidMapping: "",
          mappingFound: true,
        };
      }
      return {
        match: null,
        ambiguous: [],
        invalidMapping: `no power sensor named "${mappingState.value}"`,
        mappingFound: true,
      };
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
        if (!role.clamp) {
          results[role.key] = this._matchRole(entries, hass, role);
          continue;
        }

        const explicit = this._matchExplicitClampMapping(
          entries,
          hass,
          role.clamp
        );
        if (explicit.match || explicit.ambiguous.length > 0) {
          results[role.key] = explicit;
          continue;
        }

        const targetPredicate = (entry) =>
          this._isClampPowerTarget(entry, hass);
        const stable = this._matchRole(
          entries,
          hass,
          {
            ...role,
            patterns: [`clamp ${role.clamp}`],
          },
          targetPredicate
        );
        if (stable.match || stable.ambiguous.length > 0) {
          results[role.key] = stable;
          continue;
        }

        const legacy = this._matchRole(
          entries,
          hass,
          role,
          targetPredicate
        );
        results[role.key] = {
          ...legacy,
          invalidMapping:
            legacy.match || legacy.ambiguous.length > 0
              ? ""
              : explicit.invalidMapping,
          mappingFound: explicit.mappingFound,
        };
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
          const explicit = role.clamp
            ? this._matchExplicitClampMapping(
                sensorEntries,
                hass,
                role.clamp
              )
            : null;
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
          roleMatches[role.key] =
            Boolean(explicit?.match) ||
            sensorEntries.some(
              (entry) =>
                (!role.clamp || this._isClampPowerTarget(entry, hass)) &&
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
      const numberingStyle = this._cleanText(
        editorConfig.numbering_style
      ).toLowerCase();
      editorConfig.numbering_style = NUMBERING_STYLES.has(numberingStyle)
        ? numberingStyle
        : "clamp";
      const panelSize = Number(editorConfig.panel_size);
      editorConfig.panel_size = PANEL_SIZES.has(panelSize)
        ? panelSize
        : DEFAULT_PANEL_SIZE;
      editorConfig.show_empty_positions =
        editorConfig.show_empty_positions === undefined
          ? true
          : editorConfig.show_empty_positions === true;
      const measurementDecimals =
        editorConfig.measurement_decimals === null ||
        editorConfig.measurement_decimals === ""
          ? Number.NaN
          : Number(editorConfig.measurement_decimals);
      editorConfig.measurement_decimals = MEASUREMENT_DECIMALS.has(
        measurementDecimals
      )
        ? measurementDecimals
        : 1;
      const energyDecimals =
        editorConfig.energy_decimals === null ||
        editorConfig.energy_decimals === ""
          ? Number.NaN
          : Number(editorConfig.energy_decimals);
      editorConfig.energy_decimals = ENERGY_DECIMALS.has(energyDecimals)
        ? energyDecimals
        : 2;
      const clampMap = this._configClampMap(config);
      editorConfig.clamps = Array.from(
        { length: MAX_CLAMPS },
        (_, index) => {
          const clamp = index + 1;
          const configured = clampMap.get(clamp) || {};
          const breakerType = this._breakerType(configured);
          return {
            clamp,
            entity: "",
            name: "",
            circuit: "",
            icon: "",
            unit: "auto",
            poles: 1,
            breaker_type: "single",
            breaker_rating: "",
            tandem_entity: "",
            tandem_name: "",
            tandem_icon: "",
            tandem_unit: "auto",
            tandem_breaker_rating: "",
            ...configured,
            clamp,
            poles: breakerType === "double" ? 2 : 1,
            breaker_type: breakerType,
            breaker_rating: this._breakerRating(configured.breaker_rating),
            tandem_unit: VALID_UNITS.has(this._cleanText(configured.tandem_unit))
              ? this._cleanText(configured.tandem_unit)
              : "auto",
            tandem_breaker_rating: this._breakerRating(
              configured.tandem_breaker_rating
            ),
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
        invalidMappings: [],
        preserved: [],
      };
      const roles = this._importRoles();
      const main = { ...(next.main || {}) };
      const clampMap = this._configClampMap(next);

      for (const role of roles) {
        const result = matches[role.key] || { match: null, ambiguous: [] };
        const existing = role.field
          ? this._cleanText(main[role.field])
          : this._cleanText(clampMap.get(role.clamp)?.entity);

        if (mode === IMPORT_FILL && existing) {
          summary.preserved.push(role.label);
          continue;
        }

        if (result.ambiguous.length > 0) {
          summary.ambiguous.push({
            label: role.label,
            entities: [...result.ambiguous],
          });
          continue;
        }
        if (result.invalidMapping) {
          summary.invalidMappings.push(
            `${role.label}: ${result.invalidMapping}`
          );
          continue;
        }
        if (!result.match) {
          if (existing) {
            summary.preserved.push(role.label);
          } else if (!role.clamp) {
            summary.notFound.push(role.label);
          }
          continue;
        }

        if (role.field) {
          main[role.field] = result.match.entity_id;
          summary.imported.push(role.label);
          continue;
        }

        const existingClamp = clampMap.get(role.clamp);
        if (existingClamp) {
          existingClamp.entity = result.match.entity_id;
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
            breaker_type: "single",
            breaker_rating: "",
          });
        }
        summary.imported.push(role.label);
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
      const activePositions =
        this._config?.panel_positions.filter(
          (entry) => entry.entity || entry.tandem_entity
        ).length || 0;
      return 3 + Math.max(1, Math.ceil((activeClamps + activePositions) / 2));
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

      const poles = document.createElement("div");
      poles.className = "main-breaker-poles";
      poles.setAttribute("aria-hidden", "true");
      for (const [side, label] of [
        ["left", "L1"],
        ["right", "L2"],
      ]) {
        const pole = document.createElement("div");
        pole.className = `main-breaker-pole ${side}`;
        const poleLabel = document.createElement("span");
        poleLabel.className = "main-pole-label";
        poleLabel.textContent = label;
        const handle = document.createElement("span");
        handle.className = "main-pole-handle";
        pole.append(poleLabel, handle);
        poles.append(pole);
      }
      const handleTie = document.createElement("span");
      handleTie.className = "main-handle-tie";
      poles.append(handleTie);

      const sharedInfo = document.createElement("div");
      sharedInfo.className = "main-breaker-shared-info";

      const heading = document.createElement("div");
      heading.className = "main-heading";
      heading.textContent = "MAIN BREAKER";
      const name = document.createElement("div");
      name.className = "main-name";
      name.textContent = main.name;
      sharedInfo.append(heading, name);

      const totalParts = [];
      if (main.power_entity) {
        const power = this._formatConfiguredEntity(
          main.power_entity,
          "auto"
        );
        totalParts.push(this._formattedText(power));
        if (main.current_entity) {
          const current = this._formatConfiguredEntity(
            main.current_entity,
            "auto"
          );
          if (current.available && current.numeric !== null) {
            totalParts.push(this._formattedText(current));
          }
        }
      } else if (main.current_entity) {
        const current = this._formatConfiguredEntity(
          main.current_entity,
          "auto"
        );
        totalParts.push(this._formattedText(current));
      }
      const total = document.createElement("div");
      total.className = "main-total";
      total.textContent =
        totalParts.length > 0
          ? totalParts.join(" | ")
          : "No main entities configured";
      sharedInfo.append(total);

      const lineParts = [];
      if (main.line_1_entity) {
        lineParts.push(
          `L1 ${this._formattedText(
            this._formatConfiguredEntity(main.line_1_entity, "auto")
          )}`
        );
      }
      if (main.line_2_entity) {
        lineParts.push(
          `L2 ${this._formattedText(
            this._formatConfiguredEntity(main.line_2_entity, "auto")
          )}`
        );
      }
      if (lineParts.length > 0) {
        const lines = document.createElement("div");
        lines.className = "main-lines";
        lines.textContent = lineParts.join(" | ");
        sharedInfo.append(lines);
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
      sharedInfo.append(balanceElement);
      section.append(poles, sharedInfo);
      return section;
    }

    _renderPanel() {
      const panel = document.createElement("div");
      panel.className = "panel";
      const settings = SemElectricPanelCard._effectiveDisplaySettings(
        this._config
      );
      const pairPlan = SemElectricPanelCard._physicalPositionPlan(
        this._config.clamps,
        this._config.panel_positions,
        settings.panel_size,
        true
      );
      let rendered = 0;
      for (let position = 1; position <= settings.panel_size; position += 1) {
        const placement = pairPlan.get(position);
        if (placement?.kind === "consumed") {
          continue;
        }
        if (placement?.kind === "conflict") {
          panel.append(this._renderEmptySlot(position, true));
          rendered += 1;
          continue;
        }
        const breakerType = SemElectricPanelCard._breakerType(placement?.item);
        if (
          placement?.item &&
          (placement.item.entity ||
            (breakerType === "tandem" && placement.item.tandem_entity))
        ) {
          panel.append(
            breakerType === "tandem"
              ? this._renderTandemClamp(placement.item, position)
              : placement.kind === "owner"
              ? this._renderDoubleClamp(
                  placement.item,
                  position,
                  placement.paired
                )
              : this._renderClamp(placement.item, position)
          );
          rendered += 1;
          continue;
        }
        if (settings.show_empty_positions) {
          panel.append(this._renderEmptySlot(position));
          rendered += 1;
        }
      }
      if (rendered === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-panel";
        empty.textContent = "No SEM Meter clamps configured";
        panel.append(empty);
      }
      return panel;
    }

    _renderEmptySlot(position, conflict = false) {
      const slot = document.createElement("div");
      const side = position % 2 === 1 ? "left" : "right";
      slot.className = `empty-slot ${side}${conflict ? " conflict" : ""}`;
      slot.style.gridRow = String(Math.ceil(position / 2));
      slot.textContent = conflict ? `${position} · CONFLICT` : String(position);
      slot.title = conflict
        ? `Circuit ${position} has conflicting clamp assignments`
        : `Unused Circuit ${position}`;
      slot.setAttribute("aria-label", slot.title);
      return slot;
    }

    _renderClamp(clamp, physicalPosition = null) {
      const position =
        physicalPosition || SemElectricPanelCard._circuitPosition(clamp);
      const stateObject =
        this._hass?.states && this._hass.states[clamp.entity];
      const sourceName =
        clamp.name || this._deriveEntityName(stateObject, clamp.entity);
      const displayName = SemElectricPanelCard._cleanCircuitDisplayName(
        sourceName,
        this._selectedDeviceDisplayName()
      );
      const formatted = this._formatConfiguredEntity(
        clamp.entity,
        clamp.unit
      );
      const side = position % 2 === 1 ? "left" : "right";
      const row = Math.ceil(position / 2);
      const breaker = document.createElement("div");
      breaker.className = `breaker ${side}`;
      breaker.style.gridRow = String(row);
      const sourceLabel = Number.isInteger(Number(clamp.clamp))
        ? `Clamp ${clamp.clamp}`
        : `Physical Position ${position}`;
      breaker.title = `${sourceLabel} measurement at Circuit ${position}: single-pole breaker`;
      breaker.setAttribute(
        "aria-label",
        `${sourceLabel}, Circuit ${position}, ${clamp.circuit || "circuit label not specified"}, ${
          displayName
        }, ${formatted.value}${formatted.unit ? ` ${formatted.unit}` : ""}, single-pole`
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
      circuit.textContent = SemElectricPanelCard._formatCircuitHeading(
        position,
        SemElectricPanelCard._configuredCircuitHeading(clamp),
        this._config.numbering_style
      );
      const name = document.createElement("div");
      name.className = "breaker-name";
      name.textContent = displayName;
      name.title = displayName;
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
      return breaker;
    }

    _renderDoubleClamp(clamp, physicalPosition, pairedPosition) {
      const stateObject =
        this._hass?.states && this._hass.states[clamp.entity];
      const sourceName =
        clamp.name || this._deriveEntityName(stateObject, clamp.entity);
      const displayName = SemElectricPanelCard._cleanCircuitDisplayName(
        sourceName,
        this._selectedDeviceDisplayName()
      );
      const formatted = this._formatConfiguredEntity(clamp.entity, clamp.unit);
      const rating = SemElectricPanelCard._breakerRating(clamp.breaker_rating);
      const side = physicalPosition % 2 === 1 ? "left" : "right";
      const row = Math.ceil(physicalPosition / 2);
      const breaker = document.createElement("div");
      breaker.className = `breaker ${side} branch-double`;
      breaker.style.gridRow = `${row} / span 2`;
      const sourceLabel = Number.isInteger(Number(clamp.clamp))
        ? `Clamp ${clamp.clamp}`
        : `Physical Position ${physicalPosition}`;
      breaker.title = `${sourceLabel} measurement at Circuits ${physicalPosition}–${pairedPosition}: two-pole breaker`;
      breaker.setAttribute(
        "aria-label",
        `${sourceLabel}, Circuits ${physicalPosition} and ${pairedPosition}, ${
          clamp.circuit || "circuit not specified"
        }, ${displayName}, ${formatted.value}${
          formatted.unit ? ` ${formatted.unit}` : ""
        }${rating ? `, ${rating} amp breaker` : ""}, two-pole`
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
      circuit.textContent = SemElectricPanelCard._formatCircuitHeading(
        physicalPosition,
        SemElectricPanelCard._configuredCircuitHeading(clamp),
        this._config.numbering_style,
        pairedPosition
      );
      const name = document.createElement("div");
      name.className = "breaker-name";
      name.textContent = displayName;
      name.title = displayName;
      copy.append(circuit, name);

      const metrics = document.createElement("div");
      metrics.className = "branch-double-metrics";
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
      metrics.append(state);
      if (rating) {
        const ratingElement = document.createElement("div");
        ratingElement.className = "breaker-rating";
        ratingElement.textContent = `${rating} A`;
        metrics.append(ratingElement);
      }

      const poles = document.createElement("div");
      poles.className = "branch-double-poles";
      poles.setAttribute("aria-hidden", "true");
      for (const polePosition of ["top", "bottom"]) {
        const pole = document.createElement("span");
        pole.className = `branch-double-pole ${polePosition}`;
        const handle = document.createElement("span");
        handle.className = "branch-pole-handle";
        pole.append(handle);
        poles.append(pole);
      }
      const tie = document.createElement("span");
      tie.className = "branch-handle-tie";
      poles.append(tie);

      breaker.append(icon, copy, metrics, poles);
      return breaker;
    }

    _renderTandemClamp(clamp, physicalPosition) {
      const side = physicalPosition % 2 === 1 ? "left" : "right";
      const breaker = document.createElement("div");
      breaker.className = `breaker ${side} tandem-shell`;
      breaker.style.gridRow = String(Math.ceil(physicalPosition / 2));
      breaker.title = `Circuit ${physicalPosition}: tandem breaker with two independent circuits`;
      breaker.setAttribute(
        "aria-label",
        `Circuit ${physicalPosition}, tandem breaker`
      );
      breaker.append(
        this._renderTandemHalf(clamp, physicalPosition, false),
        this._renderTandemDivider(),
        this._renderTandemHalf(clamp, physicalPosition, true)
      );
      return breaker;
    }

    _renderTandemDivider() {
      const divider = document.createElement("div");
      divider.className = "tandem-divider";
      divider.setAttribute("aria-hidden", "true");
      return divider;
    }

    _renderTandemHalf(clamp, physicalPosition, secondary) {
      const suffix = secondary ? "B" : "A";
      const entity = SemElectricPanelCard._cleanText(
        secondary ? clamp.tandem_entity : clamp.entity
      );
      const configuredName = SemElectricPanelCard._cleanText(
        secondary ? clamp.tandem_name : clamp.name
      );
      const configuredIcon = SemElectricPanelCard._cleanText(
        secondary ? clamp.tandem_icon : clamp.icon
      );
      const requestedUnit = secondary ? clamp.tandem_unit : clamp.unit;
      const rating = SemElectricPanelCard._breakerRating(
        secondary ? clamp.tandem_breaker_rating : clamp.breaker_rating
      );
      const stateObject = entity ? this._hass?.states?.[entity] : null;
      const displayName = entity
        ? SemElectricPanelCard._cleanCircuitDisplayName(
            configuredName || this._deriveEntityName(stateObject, entity),
            this._selectedDeviceDisplayName()
          )
        : "Not configured";
      const formatted = entity
        ? this._formatConfiguredEntity(entity, requestedUnit)
        : { value: "Not configured", unit: "", available: false };
      const half = document.createElement("div");
      half.className = `tandem-half ${secondary ? "lower" : "upper"}`;
      half.title = entity
        ? `${SemElectricPanelCard._formatTandemHeading(
            physicalPosition,
            suffix,
            this._config.numbering_style
          )}: ${displayName}`
        : `${SemElectricPanelCard._formatTandemHeading(
            physicalPosition,
            suffix,
            this._config.numbering_style
          )}: Not configured`;
      if (entity) {
        half.setAttribute(
          "aria-label",
          `${half.title}, ${formatted.value}${
            formatted.unit ? ` ${formatted.unit}` : ""
          }${rating ? `, ${rating} amp breaker` : ""}`
        );
        this._makeInteractive(half, entity);
      } else {
        half.setAttribute("aria-label", half.title);
      }

      const handle = document.createElement("span");
      handle.className = "tandem-handle";
      handle.setAttribute("aria-hidden", "true");
      const icon = document.createElement("ha-icon");
      icon.setAttribute(
        "icon",
        configuredIcon || stateObject?.attributes?.icon || "mdi:flash"
      );
      const copy = document.createElement("div");
      copy.className = "tandem-copy";
      const heading = document.createElement("div");
      heading.className = "tandem-heading";
      heading.textContent = SemElectricPanelCard._formatTandemHeading(
        physicalPosition,
        suffix,
        this._config.numbering_style
      );
      const name = document.createElement("div");
      name.className = "tandem-name";
      name.textContent = displayName;
      name.title = displayName;
      copy.append(heading, name);

      const metrics = document.createElement("div");
      metrics.className = "tandem-metrics";
      const state = document.createElement("div");
      state.className = `tandem-state${
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
      metrics.append(state);
      if (rating) {
        const ratingElement = document.createElement("div");
        ratingElement.className = "tandem-rating";
        ratingElement.textContent = `${rating} A`;
        metrics.append(ratingElement);
      }
      half.append(handle, icon, copy, metrics);
      return half;
    }

    _deriveEntityName(stateObject, entityId) {
      if (stateObject?.attributes?.friendly_name) {
        return String(stateObject.attributes.friendly_name);
      }
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
      const objectId = String(entityId || "Unnamed clamp").split(".").pop();
      return objectId
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    _selectedDeviceDisplayName() {
      const device = this._hass?.devices?.[this._config?.device_id];
      return SemElectricPanelCard._cleanText(
        device?.name_by_user || device?.name
      );
    }

    _formattedText(formatted) {
      return `${formatted.value}${formatted.unit ? ` ${formatted.unit}` : ""}`;
    }

    _formatConfiguredEntity(entityId, requestedUnit) {
      return SemElectricPanelCard._formatEntity(
        this._hass,
        entityId,
        requestedUnit,
        this._config.measurement_decimals,
        this._config.energy_decimals
      );
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
      this._entityChoiceCache = new Map();
      this._selectorStateSignature = "";
      this._entityChoicesLoading = false;
      this._entityRefreshGeneration = 0;
      this._entityRefreshKey = "";
      this._entityRefreshPromise = null;
      this._textDrafts = new Map();
      this._composingDrafts = new Set();
      this._activeDraftKey = "";
      this._entityRefreshDeferred = false;
      this._configRenderDeferred = false;
      this._lastEmittedConfigSignature = "";
      this._selectedPanelPosition = 1;
    }

    setConfig(config) {
      const next = SemElectricPanelCard._copyConfig(config);
      const signature = JSON.stringify(next);
      this._config = next;
      if (signature === this._lastEmittedConfigSignature) {
        this._lastEmittedConfigSignature = "";
        return;
      }
      if (this._activeDraftKey) {
        this._configRenderDeferred = true;
        return;
      }
      this._textDrafts.clear();
      this._render();
      this._ensureDeviceCandidates();
    }

    set hass(hass) {
      const previousHass = this._hass;
      this._hass = hass;
      const signature = this._entitySelectorStateSignature(hass);
      const choicesChanged = signature !== this._selectorStateSignature;
      this._selectorStateSignature = signature;
      if (choicesChanged) {
        this._entityChoiceCache.clear();
      }
      if (!this.shadowRoot?.hasChildNodes() && this._config) {
        this._render();
        this._ensureDeviceCandidates();
        return;
      }
      for (const form of this.shadowRoot?.querySelectorAll("ha-form") || []) {
        form.hass = hass;
      }
      if (choicesChanged && previousHass) {
        if (this._activeDraftKey) {
          this._entityRefreshDeferred = true;
        } else {
          this._refreshEntityChoices("state metadata changed").catch(() => {});
        }
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
          this._entityChoiceCache.clear();
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
          this._warmEntityChoiceCache();
          this._selectorStateSignature =
            this._entitySelectorStateSignature(this._hass);
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
      this._lastEmittedConfigSignature = JSON.stringify(this._config);
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
      const incoming = event.detail?.value;
      if (!incoming || typeof incoming !== "object") {
        return;
      }
      const next = SemElectricPanelCard._copyConfig({
        ...this._config,
        ...incoming,
        main: {
          ...(this._config?.main || {}),
          ...(incoming.main || {}),
        },
        clamps:
          incoming.clamps === undefined
            ? this._config?.clamps
            : incoming.clamps,
      });
      const deviceChanged =
        SemElectricPanelCard._cleanText(next.device_id) !==
        SemElectricPanelCard._cleanText(this._config?.device_id);
      const currentMain = this._config?.main || {};
      next.main = { ...(next.main || {}) };
      for (const field of [
        "power_entity",
        "current_entity",
        "line_1_entity",
        "line_2_entity",
      ]) {
        next.main[field] = SemElectricPanelCard._cleanText(
          currentMain[field]
        );
      }
      const currentClamps = SemElectricPanelCard._configClampMap(
        this._config
      );
      const nextClamps = SemElectricPanelCard._configClampMap(next);
      for (const [clamp, existing] of currentClamps) {
        const updated = nextClamps.get(clamp) || { ...existing };
        updated.entity = SemElectricPanelCard._cleanText(existing.entity);
        updated.name = SemElectricPanelCard._cleanText(existing.name);
        updated.circuit = SemElectricPanelCard._cleanText(existing.circuit);
        updated.tandem_entity = SemElectricPanelCard._cleanText(
          existing.tandem_entity
        );
        updated.tandem_name = SemElectricPanelCard._cleanText(
          existing.tandem_name
        );
        updated.tandem_icon = SemElectricPanelCard._cleanText(
          existing.tandem_icon
        );
        updated.tandem_unit = SemElectricPanelCard._cleanText(
          existing.tandem_unit
        );
        updated.tandem_breaker_rating = existing.tandem_breaker_rating;
        nextClamps.set(clamp, updated);
      }
      next.clamps = [...nextClamps.values()].sort(
        (left, right) => left.clamp - right.clamp
      );
      if (this._config?.show_all_entities === true) {
        next.show_all_entities = true;
      } else {
        delete next.show_all_entities;
      }
      this._summary = null;
      this._replaceConfirmationPending = false;
      this._emitConfig(next);
      if (deviceChanged) {
        this._entityChoiceCache.clear();
        this._render();
      } else {
        this._updateImportControls();
      }
    }

    _entitySelectorStateSignature(hass) {
      if (!this._registryCache || !hass?.states) {
        return "";
      }
      return this._registryCache.entities
        .map((entry) => {
          const attributes = hass.states[entry.entity_id]?.attributes || {};
          return [
            entry.entity_id,
            attributes.friendly_name || "",
            attributes.device_class || "",
            attributes.unit_of_measurement || "",
            attributes.entity_category || "",
          ].join("\u001f");
        })
        .sort()
        .join("\u001e");
    }

    _entityChoiceGroups(field, configuredEntityId) {
      const selectedDeviceId = SemElectricPanelCard._cleanText(
        this._config?.device_id
      );
      const showAll = this._config?.show_all_entities === true;
      const cacheKey = [
        selectedDeviceId,
        showAll ? "all" : "device",
        field,
        configuredEntityId,
      ].join("\u001f");
      if (this._entityChoiceCache.has(cacheKey)) {
        return this._entityChoiceCache.get(cacheKey);
      }
      const groups = SemElectricPanelCard._buildEntityChoiceGroups(
        this._registryCache?.entities || [],
        this._registryCache?.devices || [],
        this._hass,
        selectedDeviceId,
        showAll,
        field,
        configuredEntityId
      );
      this._entityChoiceCache.set(cacheKey, groups);
      return groups;
    }

    _yieldForEditorPaint() {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => setTimeout(resolve, 0));
        } else {
          setTimeout(resolve, 0);
        }
      });
    }

    _warmEntityChoiceCache() {
      for (const field of [
        "power_entity",
        "current_entity",
        "line_1_entity",
        "line_2_entity",
      ]) {
        this._entityChoiceGroups(
          field,
          SemElectricPanelCard._cleanText(this._config?.main?.[field])
        );
      }
      for (let clamp = 1; clamp <= MAX_CLAMPS; clamp += 1) {
        this._entityChoiceGroups(
          "entity",
          SemElectricPanelCard._cleanText(
            SemElectricPanelCard._editorClamp(this._config, clamp)?.entity
          )
        );
        this._entityChoiceGroups(
          "tandem_entity",
          SemElectricPanelCard._cleanText(
            SemElectricPanelCard._editorClamp(this._config, clamp)
              ?.tandem_entity
          )
        );
      }
      const selectedPosition = Number(this._selectedPanelPosition) || 1;
      const configuredPosition = SemElectricPanelCard._configPanelPositionMap(
        this._config
      ).get(selectedPosition);
      for (const field of ["entity", "tandem_entity"]) {
        this._entityChoiceGroups(
          field,
          SemElectricPanelCard._cleanText(configuredPosition?.[field])
        );
      }
    }

    _refreshEntityChoices(reason) {
      const refreshKey = [
        SemElectricPanelCard._cleanText(this._config?.device_id),
        this._config?.show_all_entities === true ? "all" : "device",
      ].join("\u001f");
      if (
        this._entityChoicesLoading &&
        this._entityRefreshKey === refreshKey &&
        this._entityRefreshPromise
      ) {
        return this._entityRefreshPromise;
      }

      const generation = ++this._entityRefreshGeneration;
      this._entityRefreshKey = refreshKey;
      this._entityChoicesLoading = true;
      this._deviceDiscoveryError = "";
      this._render();
      const refreshPromise = (async () => {
        try {
          await this._yieldForEditorPaint();
          if (generation !== this._entityRefreshGeneration) {
            return;
          }
          if (!this._registryCache) {
            await this._loadDeviceCandidates(false, false);
          }
          if (generation !== this._entityRefreshGeneration) {
            return;
          }
          this._entityChoiceCache.clear();
          this._warmEntityChoiceCache();
        } catch (error) {
          if (generation === this._entityRefreshGeneration) {
            this._deviceDiscoveryError = `Unable to load SEM Meter entities: ${
              error instanceof Error ? error.message : String(error)
            }. Existing assignments were preserved.`;
          }
          throw error;
        } finally {
          if (generation === this._entityRefreshGeneration) {
            this._entityChoicesLoading = false;
            this._entityRefreshPromise = null;
            this._render();
          }
        }
      })();
      this._entityRefreshPromise = refreshPromise;
      return refreshPromise;
    }

    _setManualEntity(field, clampNumber, entityId) {
      const next = SemElectricPanelCard._copyConfig(this._config);
      if (clampNumber) {
        const clampMap = SemElectricPanelCard._configClampMap(next);
        const existing = clampMap.get(clampNumber) || {
          clamp: clampNumber,
          name: "",
          circuit: "",
          icon: "",
          unit: "auto",
          poles: 1,
          breaker_type: "single",
          breaker_rating: "",
          tandem_entity: "",
          tandem_name: "",
          tandem_icon: "",
          tandem_unit: "auto",
          tandem_breaker_rating: "",
        };
        clampMap.set(clampNumber, { ...existing, [field]: entityId });
        next.clamps = [...clampMap.values()].sort(
          (left, right) => left.clamp - right.clamp
        );
      } else {
        next.main = { ...(next.main || {}), [field]: entityId };
      }
      this._summary = null;
      this._emitConfig(next);
    }

    _emptyPanelPosition(position) {
      return {
        position,
        entity: "",
        name: "",
        circuit: "",
        icon: "",
        unit: "auto",
        poles: 1,
        breaker_type: "single",
        breaker_rating: "",
        tandem_entity: "",
        tandem_name: "",
        tandem_icon: "",
        tandem_unit: "auto",
        tandem_breaker_rating: "",
      };
    }

    _panelPositionIsMeaningful(entry) {
      return Boolean(
        [
          "entity",
          "name",
          "circuit",
          "icon",
          "tandem_entity",
          "tandem_name",
          "tandem_icon",
        ].some((field) => SemElectricPanelCard._cleanText(entry?.[field])) ||
          SemElectricPanelCard._breakerType(entry) !== "single" ||
          SemElectricPanelCard._breakerRating(entry?.breaker_rating) ||
          SemElectricPanelCard._breakerRating(entry?.tandem_breaker_rating) ||
          (VALID_UNITS.has(SemElectricPanelCard._cleanText(entry?.unit)) &&
            SemElectricPanelCard._cleanText(entry?.unit) !== "auto") ||
          (VALID_UNITS.has(
            SemElectricPanelCard._cleanText(entry?.tandem_unit)
          ) && SemElectricPanelCard._cleanText(entry?.tandem_unit) !== "auto")
      );
    }

    _setPanelPositionField(position, field, rawValue, forceCreate = false) {
      const next = SemElectricPanelCard._copyConfig(this._config);
      const map = SemElectricPanelCard._configPanelPositionMap(next);
      const existing = map.get(position) || this._emptyPanelPosition(position);
      let value = rawValue;
      if (["entity", "name", "circuit", "icon", "tandem_entity", "tandem_name", "tandem_icon"].includes(field)) {
        value = SemElectricPanelCard._cleanText(rawValue);
      } else if (field === "breaker_type") {
        value = BREAKER_TYPES.has(rawValue) ? rawValue : "single";
      } else if (["breaker_rating", "tandem_breaker_rating"].includes(field)) {
        value = SemElectricPanelCard._breakerRating(rawValue);
      } else if (["unit", "tandem_unit"].includes(field)) {
        value = VALID_UNITS.has(SemElectricPanelCard._cleanText(rawValue))
          ? SemElectricPanelCard._cleanText(rawValue)
          : "auto";
      }
      const updated = { ...existing, position, [field]: value };
      if (field === "breaker_type") {
        updated.poles = value === "double" ? 2 : 1;
      }
      if (forceCreate || this._panelPositionIsMeaningful(updated)) {
        map.set(position, updated);
      } else {
        map.delete(position);
      }
      next.panel_positions = [...map.values()].sort(
        (left, right) => left.position - right.position
      );
      this._summary = null;
      this._emitConfig(next);
      this._render();
    }

    _createPanelPositionOverride(position) {
      this._setPanelPositionField(position, "entity", "", true);
    }

    _setClampBreakerSetting(clampNumber, field, rawValue) {
      const next = SemElectricPanelCard._copyConfig(this._config);
      const clampMap = SemElectricPanelCard._configClampMap(next);
      const existing = clampMap.get(clampNumber) || {
        clamp: clampNumber,
        entity: "",
        name: "",
        circuit: "",
        icon: "",
        unit: "auto",
        poles: 1,
        breaker_type: "single",
        breaker_rating: "",
        tandem_entity: "",
        tandem_name: "",
        tandem_icon: "",
        tandem_unit: "auto",
        tandem_breaker_rating: "",
      };
      if (field === "breaker_type") {
        const breakerType = BREAKER_TYPES.has(rawValue) ? rawValue : "single";
        clampMap.set(clampNumber, {
          ...existing,
          breaker_type: breakerType,
          poles: breakerType === "double" ? 2 : 1,
        });
      } else if (field === "breaker_rating") {
        clampMap.set(clampNumber, {
          ...existing,
          breaker_rating: SemElectricPanelCard._breakerRating(rawValue),
        });
      } else if (field === "tandem_breaker_rating") {
        clampMap.set(clampNumber, {
          ...existing,
          tandem_breaker_rating:
            SemElectricPanelCard._breakerRating(rawValue),
        });
      } else if (field === "tandem_unit") {
        const tandemUnit = SemElectricPanelCard._cleanText(rawValue);
        clampMap.set(clampNumber, {
          ...existing,
          tandem_unit: VALID_UNITS.has(tandemUnit) ? tandemUnit : "auto",
        });
      } else {
        return;
      }
      next.clamps = [...clampMap.values()].sort(
        (left, right) => left.clamp - right.clamp
      );
      this._summary = null;
      this._emitConfig(next);
      this._render();
    }

    _setClampCircuitPosition(clampNumber, rawValue) {
      const position = SemElectricPanelCard._explicitCircuitPosition(rawValue);
      if (position === null) {
        return false;
      }
      const next = SemElectricPanelCard._copyConfig(this._config);
      const clampMap = SemElectricPanelCard._configClampMap(next);
      const existing = clampMap.get(clampNumber) || {
        clamp: clampNumber,
        entity: "",
        name: "",
        circuit: "",
        icon: "",
        unit: "auto",
        poles: 1,
        breaker_type: "single",
        breaker_rating: "",
        tandem_entity: "",
        tandem_name: "",
        tandem_icon: "",
        tandem_unit: "auto",
        tandem_breaker_rating: "",
      };
      if (
        SemElectricPanelCard._explicitCircuitPosition(
          existing.circuit_position
        ) === position
      ) {
        return false;
      }
      clampMap.set(clampNumber, { ...existing, circuit_position: position });
      next.clamps = [...clampMap.values()].sort(
        (left, right) => left.clamp - right.clamp
      );
      this._summary = null;
      this._emitConfig(next);
      this._render();
      return true;
    }

    _createCircuitPositionSelect(clampNumber, configured) {
      const settings = SemElectricPanelCard._effectiveDisplaySettings(
        this._config
      );
      const position = SemElectricPanelCard._circuitPosition(
        configured || { clamp: clampNumber }
      );
      const options = Array.from(
        { length: settings.panel_size },
        (_, index) => index + 1
      );
      if (!options.includes(position)) {
        options.push(position);
      }
      const label = document.createElement("label");
      label.className = "circuit-position-setting";
      label.textContent = "Physical circuit position";
      const select = document.createElement("select");
      select.dataset.circuitPosition = String(clampNumber);
      for (const optionPosition of options) {
        const option = document.createElement("option");
        option.value = String(optionPosition);
        option.textContent =
          optionPosition > settings.panel_size
            ? `Circuit ${optionPosition} (outside panel)`
            : `Circuit ${optionPosition}`;
        option.selected = optionPosition === position;
        select.append(option);
      }
      select.value = String(position);
      select.addEventListener("change", () => {
        this._setClampCircuitPosition(clampNumber, select.value);
      });
      label.append(select);
      return label;
    }

    _createBreakerSelect(labelText, clampNumber, field, value, options) {
      const label = document.createElement("label");
      label.className = "breaker-setting";
      label.textContent = labelText;
      const select = document.createElement("select");
      select.dataset.breakerField = field;
      select.dataset.clamp = String(clampNumber);
      for (const optionValue of options) {
        const option = document.createElement("option");
        option.value = String(optionValue.value);
        option.textContent = optionValue.label;
        option.selected = String(value) === String(optionValue.value);
        select.append(option);
      }
      select.addEventListener("change", () => {
        this._setClampBreakerSetting(clampNumber, field, select.value);
      });
      label.append(select);
      return label;
    }

    _setSelectedDevice(deviceId) {
      const selected = SemElectricPanelCard._cleanText(deviceId);
      if (!selected) {
        return;
      }
      this._summary = null;
      this._replaceConfirmationPending = false;
      this._entityChoiceCache.clear();
      this._emitConfig({ ...this._config, device_id: selected });
      return this._refreshEntityChoices("selected device changed");
    }

    _setShowAllEntities(enabled) {
      if (this._entityChoicesLoading || this._deviceDiscoveryLoading) {
        return this._entityRefreshPromise || Promise.resolve();
      }
      const showAll = enabled === true;
      if ((this._config?.show_all_entities === true) === showAll) {
        return Promise.resolve();
      }
      const next = SemElectricPanelCard._copyConfig(this._config);
      if (showAll) {
        next.show_all_entities = true;
      } else {
        delete next.show_all_entities;
      }
      this._entityChoiceCache.clear();
      this._emitConfig(next);
      return this._refreshEntityChoices("show-all setting changed");
    }

    _setDisplaySetting(key, rawValue) {
      let value;
      if (key === "numbering_style") {
        value = SemElectricPanelCard._cleanText(rawValue).toLowerCase();
        if (!NUMBERING_STYLES.has(value)) {
          return false;
        }
      } else if (key === "measurement_decimals") {
        if (rawValue === null || String(rawValue).trim() === "") {
          return false;
        }
        value = Number(rawValue);
        if (!MEASUREMENT_DECIMALS.has(value)) {
          return false;
        }
      } else if (key === "energy_decimals") {
        if (rawValue === null || String(rawValue).trim() === "") {
          return false;
        }
        value = Number(rawValue);
        if (!ENERGY_DECIMALS.has(value)) {
          return false;
        }
      } else if (key === "panel_size") {
        value = Number(rawValue);
        if (!PANEL_SIZES.has(value)) {
          return false;
        }
      } else if (key === "show_empty_positions") {
        value = rawValue === true || rawValue === "true";
      } else {
        return false;
      }

      const current = this._config?.[key];
      const currentIsSame =
        key === "numbering_style"
          ? SemElectricPanelCard._cleanText(current).toLowerCase() === value &&
            NUMBERING_STYLES.has(value)
          : key === "show_empty_positions"
            ? (current === undefined ? true : current === true) === value
          : typeof current === "number" && current === value;
      if (currentIsSame) {
        return false;
      }
      const next = SemElectricPanelCard._copyConfig(this._config);
      next[key] = value;
      this._emitConfig(next);
      return true;
    }

    _createDisplaySettingSelect(labelText, key, options, currentValue, helper) {
      const label = document.createElement("label");
      label.className = "display-setting";
      const title = document.createElement("span");
      title.className = "display-setting-label";
      title.textContent = labelText;
      const select = document.createElement("select");
      select.dataset.displaySetting = key;
      select.setAttribute("aria-label", labelText);
      for (const optionConfig of options) {
        const option = document.createElement("option");
        option.value = String(optionConfig.value);
        option.textContent = optionConfig.label;
        option.selected = optionConfig.value === currentValue;
        select.append(option);
      }
      select.value = String(currentValue);
      select.addEventListener("change", () => {
        this._setDisplaySetting(key, select.value);
      });
      label.append(title, select);
      if (helper) {
        const help = document.createElement("span");
        help.className = "display-setting-help";
        help.textContent = helper;
        label.append(help);
      }
      return label;
    }

    _renderDisplaySettings() {
      const settings = SemElectricPanelCard._effectiveDisplaySettings(
        this._config
      );
      const section = document.createElement("section");
      section.className = "display-settings";
      const heading = document.createElement("h3");
      heading.textContent = "Display settings";
      const grid = document.createElement("div");
      grid.className = "display-settings-grid";
      grid.append(
        this._createDisplaySettingSelect(
          "Panel size",
          "panel_size",
          [...PANEL_SIZES].map((size) => ({
            value: size,
            label: `${size} positions`,
          })),
          settings.panel_size,
          "Sets the physical breaker positions; SEM measurement clamps remain limited to 16."
        ),
        this._createDisplaySettingSelect(
          "Show unused breaker positions",
          "show_empty_positions",
          [
            { value: true, label: "Show" },
            { value: false, label: "Hide" },
          ],
          settings.show_empty_positions,
          "Displays unassigned positions as non-interactive filler plates."
        ),
        this._createDisplaySettingSelect(
          "Circuit numbering style",
          "numbering_style",
          [
            { value: "clamp", label: "Clamp" },
            { value: "circuit", label: "Circuit" },
            { value: "number", label: "Number only" },
          ],
          settings.numbering_style,
          "Controls the automatic heading shown on each circuit tile."
        ),
        this._createDisplaySettingSelect(
          "Power/current decimals",
          "measurement_decimals",
          [
            { value: 0, label: "0 decimals" },
            { value: 1, label: "1 decimal" },
            { value: 2, label: "2 decimals" },
          ],
          settings.measurement_decimals,
          "Controls W, kW, A, V, VA, and similar live measurements."
        ),
        this._createDisplaySettingSelect(
          "Energy decimals",
          "energy_decimals",
          [
            { value: 0, label: "0 decimals" },
            { value: 1, label: "1 decimal" },
            { value: 2, label: "2 decimals" },
            { value: 3, label: "3 decimals" },
          ],
          settings.energy_decimals,
          "Controls Wh, kWh, MWh, and GWh values."
        )
      );
      section.append(heading, grid);
      return section;
    }

    _draftKey(clampNumber, field) {
      return `clamp:${clampNumber}:${field}`;
    }

    _commitTextDraft(clampNumber, field, inputValue) {
      const key = this._draftKey(clampNumber, field);
      const value = SemElectricPanelCard._cleanText(inputValue);
      this._textDrafts.delete(key);
      const clampMap = SemElectricPanelCard._configClampMap(this._config);
      const existing = clampMap.get(clampNumber) || {
        clamp: clampNumber,
        entity: "",
        name: "",
        circuit: "",
        icon: "",
        unit: "auto",
        poles: 1,
        breaker_type: "single",
        breaker_rating: "",
        tandem_entity: "",
        tandem_name: "",
        tandem_icon: "",
        tandem_unit: "auto",
        tandem_breaker_rating: "",
      };
      if (SemElectricPanelCard._cleanText(existing[field]) === value) {
        return false;
      }
      clampMap.set(clampNumber, { ...existing, [field]: value });
      const next = SemElectricPanelCard._copyConfig(this._config);
      next.clamps = [...clampMap.values()].sort(
        (left, right) => left.clamp - right.clamp
      );
      this._emitConfig(next);
      return true;
    }

    _createDraftTextInput(labelText, clampNumber, field, configuredValue) {
      const key = this._draftKey(clampNumber, field);
      const label = document.createElement("label");
      label.className = "draft-field";
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "text";
      input.dataset.draftKey = key;
      input.value = this._textDrafts.has(key)
        ? this._textDrafts.get(key)
        : configuredValue;
      input.addEventListener("focus", () => {
        this._activeDraftKey = key;
        this._textDrafts.set(key, input.value);
      });
      input.addEventListener("input", () => {
        this._textDrafts.set(key, input.value);
      });
      input.addEventListener("compositionstart", () => {
        this._composingDrafts.add(key);
      });
      input.addEventListener("compositionend", () => {
        this._composingDrafts.delete(key);
        this._textDrafts.set(key, input.value);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !this._composingDrafts.has(key)) {
          this._commitTextDraft(clampNumber, field, input.value);
        }
      });
      input.addEventListener("change", () => {
        if (!this._composingDrafts.has(key)) {
          this._commitTextDraft(clampNumber, field, input.value);
        }
      });
      input.addEventListener("blur", () => {
        if (!this._composingDrafts.has(key)) {
          this._commitTextDraft(clampNumber, field, input.value);
        }
        if (this._activeDraftKey === key) {
          this._activeDraftKey = "";
        }
        if (this._configRenderDeferred) {
          this._configRenderDeferred = false;
          this._render();
        }
        if (this._entityRefreshDeferred) {
          this._entityRefreshDeferred = false;
          this._refreshEntityChoices("deferred state metadata change").catch(
            () => {}
          );
        }
      });
      label.append(input);
      return label;
    }

    _createEntitySelect(
      labelText,
      field,
      configuredEntityId,
      clampNumber = 0,
      panelPosition = 0
    ) {
      const label = document.createElement("label");
      label.className = "entity-choice";
      label.textContent = labelText;
      const select = document.createElement("select");
      select.disabled =
        this._deviceDiscoveryLoading || this._entityChoicesLoading;
      select.dataset.entityField = field;
      if (clampNumber) {
        select.dataset.clamp = String(clampNumber);
      }
      if (panelPosition) {
        select.dataset.panelPosition = String(panelPosition);
      }
      select.setAttribute("aria-label", labelText);
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = this._registryCache
        ? "No entity selected"
        : "Loading compatible entities…";
      placeholder.selected = !configuredEntityId;
      select.append(placeholder);

      for (const group of this._entityChoiceGroups(
        field,
        configuredEntityId
      )) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = group.label;
        for (const choice of group.options) {
          const option = document.createElement("option");
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = choice.value === configuredEntityId;
          optgroup.append(option);
        }
        select.append(optgroup);
      }
      select.addEventListener("change", () => {
        const value = SemElectricPanelCard._cleanText(select.value);
        if (panelPosition) {
          this._setPanelPositionField(panelPosition, field, value);
        } else {
          this._setManualEntity(field, clampNumber, value);
        }
      });
      label.append(select);
      return label;
    }

    _createPanelTextInput(labelText, position, field, configuredValue) {
      const label = document.createElement("label");
      label.className = "draft-field";
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "text";
      input.dataset.panelField = field;
      input.dataset.panelPosition = String(position);
      input.value = SemElectricPanelCard._cleanText(configuredValue);
      input.addEventListener("change", () =>
        this._setPanelPositionField(position, field, input.value)
      );
      label.append(input);
      return label;
    }

    _createPanelSelect(labelText, position, field, value, options) {
      const label = document.createElement("label");
      label.className = "breaker-setting";
      label.textContent = labelText;
      const select = document.createElement("select");
      select.dataset.panelField = field;
      select.dataset.panelPosition = String(position);
      for (const optionValue of options) {
        const option = document.createElement("option");
        option.value = String(optionValue.value);
        option.textContent = optionValue.label;
        option.selected = String(optionValue.value) === String(value);
        select.append(option);
      }
      select.addEventListener("change", () =>
        this._setPanelPositionField(position, field, select.value)
      );
      label.append(select);
      return label;
    }

    _renderPhysicalPanelPositions() {
      const section = document.createElement("section");
      section.className = "physical-positions";
      const heading = document.createElement("h3");
      heading.textContent = "Physical Panel Positions";
      const explanation = document.createElement("p");
      explanation.className = "compatibility";
      explanation.textContent =
        "Configure physical breaker positions independently of the 16 SEM Meter clamps. Explicit position entries take rendering priority without replacing clamp assignments.";
      const settings = SemElectricPanelCard._effectiveDisplaySettings(this._config);
      const explicitMap = SemElectricPanelCard._configPanelPositionMap(this._config);
      const plan = SemElectricPanelCard._physicalPositionPlan(
        [...SemElectricPanelCard._configClampMap(this._config).values()],
        [...explicitMap.values()],
        settings.panel_size
      );
      const options = Array.from(
        { length: settings.panel_size },
        (_, index) => index + 1
      );
      for (const position of explicitMap.keys()) {
        if (!options.includes(position)) options.push(position);
      }
      options.sort((left, right) => left - right);
      if (!options.includes(this._selectedPanelPosition)) {
        this._selectedPanelPosition = Math.min(
          settings.panel_size,
          Math.max(1, Number(this._selectedPanelPosition) || 1)
        );
      }
      const pickerLabel = document.createElement("label");
      pickerLabel.className = "position-picker";
      pickerLabel.textContent = "Edit physical position";
      const picker = document.createElement("select");
      picker.dataset.physicalPositionPicker = "";
      for (const position of options) {
        const option = document.createElement("option");
        option.value = String(position);
        const status = position > settings.panel_size
          ? "Out of range"
          : SemElectricPanelCard._physicalPositionStatus(plan, position);
        const configured = explicitMap.get(position);
        const readableName = SemElectricPanelCard._cleanText(configured?.name);
        const summary = readableName
          ? status === "Explicitly configured"
            ? readableName
            : `${readableName} (${status})`
          : status;
        option.textContent = `${position} — ${summary}`;
        option.selected = position === this._selectedPanelPosition;
        picker.append(option);
      }
      picker.value = String(this._selectedPanelPosition);
      picker.addEventListener("change", () => {
        this._selectedPanelPosition = Number(picker.value);
        this._render();
      });
      pickerLabel.append(picker);
      section.append(heading, explanation, pickerLabel);

      const position = this._selectedPanelPosition;
      const configured = explicitMap.get(position);
      const placement = plan.get(position);
      const status = document.createElement("div");
      const outOfRange = position > settings.panel_size;
      const conflict = Boolean(placement?.conflict || placement?.kind === "conflict");
      status.className = `position-status${conflict || outOfRange ? " warning" : ""}`;
      status.setAttribute("role", conflict || outOfRange ? "alert" : "status");
      status.textContent = outOfRange
        ? `Position ${position} is outside the selected ${settings.panel_size}-position panel. Its configuration is preserved for recovery.`
        : placement?.warning || `Position ${position}: ${SemElectricPanelCard._physicalPositionStatus(plan, position)}.`;
      section.append(status);

      const assignedClamp = placement?.assignedClamps?.[0] ||
        (placement?.source === "clamp" ? placement.item : null);
      if (!configured && assignedClamp) {
        const actions = document.createElement("div");
        actions.className = "position-actions";
        const editClamp = document.createElement("button");
        editClamp.type = "button";
        editClamp.textContent = `Edit Clamp ${assignedClamp.clamp} assignment`;
        editClamp.addEventListener("click", () => {
          const clampSection = this.shadowRoot?.querySelector("details.clamp-assignments");
          if (clampSection) clampSection.open = true;
          this.shadowRoot
            ?.querySelector(`[data-clamp-assignment="${assignedClamp.clamp}"]`)
            ?.scrollIntoView?.({ block: "nearest" });
        });
        const override = document.createElement("button");
        override.type = "button";
        override.textContent = "Create position override";
        override.addEventListener("click", () =>
          this._createPanelPositionOverride(position)
        );
        actions.append(editClamp, override);
        section.append(actions);
        return section;
      }

      const value = configured || this._emptyPanelPosition(position);
      const fields = document.createElement("div");
      fields.className = "position-fields";
      const breakerType = SemElectricPanelCard._breakerType(value);
      const ratingOptions = (rating) => [
        { value: "", label: "Not shown" },
        ...[...BREAKER_RATINGS].map((item) => ({ value: item, label: `${item} A` })),
        ...(rating && !BREAKER_RATINGS.has(rating)
          ? [{ value: rating, label: `${rating} A (custom)` }]
          : []),
      ];
      const unitOptions = [
        { value: "auto", label: "Automatic" },
        { value: "W", label: "Watts (W)" },
        { value: "kW", label: "Kilowatts (kW)" },
        { value: "A", label: "Amps (A)" },
      ];
      fields.append(
        this._createEntitySelect("Entity", "entity", value.entity, 0, position),
        this._createPanelTextInput("Display name", position, "name", value.name),
        this._createPanelTextInput("Circuit number or label", position, "circuit", value.circuit),
        this._createPanelTextInput("Icon", position, "icon", value.icon),
        this._createPanelSelect("Display unit", position, "unit", value.unit, unitOptions),
        this._createPanelSelect("Breaker type", position, "breaker_type", breakerType, [
          { value: "single", label: "Single pole" },
          { value: "double", label: "Two pole — paired with next same-side position" },
          { value: "tandem", label: "Tandem — two independent circuits in one position" },
        ]),
        this._createPanelSelect(
          "Breaker rating",
          position,
          "breaker_rating",
          SemElectricPanelCard._breakerRating(value.breaker_rating),
          ratingOptions(SemElectricPanelCard._breakerRating(value.breaker_rating))
        )
      );
      if (breakerType === "tandem") {
        const tandem = document.createElement("section");
        tandem.className = "tandem-secondary";
        const tandemHeading = document.createElement("h4");
        tandemHeading.textContent = "Tandem second circuit";
        tandem.append(
          tandemHeading,
          this._createEntitySelect("Entity", "tandem_entity", value.tandem_entity, 0, position),
          this._createPanelTextInput("Display name", position, "tandem_name", value.tandem_name),
          this._createPanelTextInput("Icon", position, "tandem_icon", value.tandem_icon),
          this._createPanelSelect("Display unit", position, "tandem_unit", value.tandem_unit, unitOptions),
          this._createPanelSelect(
            "Breaker rating",
            position,
            "tandem_breaker_rating",
            SemElectricPanelCard._breakerRating(value.tandem_breaker_rating),
            ratingOptions(SemElectricPanelCard._breakerRating(value.tandem_breaker_rating))
          )
        );
        fields.append(tandem);
      }
      section.append(fields);
      return section;
    }

    _renderManualEntitySelectors() {
      const section = document.createElement("section");
      section.className = "entity-assignments";
      const heading = document.createElement("h3");
      heading.textContent = "Measurement entities";
      const explanation = document.createElement("p");
      explanation.className = "compatibility";
      explanation.textContent = this._config?.show_all_entities === true
        ? "Showing compatible entities from all Home Assistant devices; the selected SEM Meter is listed first."
        : "Showing compatible entities from the selected SEM Meter only.";
      section.append(heading, explanation);

      const main = document.createElement("details");
      main.open = true;
      const mainSummary = document.createElement("summary");
      mainSummary.textContent = "Main assignments";
      const mainGrid = document.createElement("div");
      mainGrid.className = "entity-grid";
      for (const [field, label] of [
        ["power_entity", "Main Power"],
        ["current_entity", "Main Current"],
        ["line_1_entity", "Phase A / Line 1 Power"],
        ["line_2_entity", "Phase B / Line 2 Power"],
      ]) {
        mainGrid.append(
          this._createEntitySelect(
            label,
            field,
            SemElectricPanelCard._cleanText(this._config?.main?.[field])
          )
        );
      }
      main.append(mainSummary, mainGrid);

      const circuits = document.createElement("details");
      circuits.className = "clamp-assignments";
      const circuitSummary = document.createElement("summary");
      circuitSummary.textContent = "Clamp assignments";
      const circuitGrid = document.createElement("div");
      circuitGrid.className = "entity-grid";
      const panelSize = SemElectricPanelCard._effectiveDisplaySettings(
        this._config
      ).panel_size;
      const pairPlan = SemElectricPanelCard._branchPairPlan(
        Array.from({ length: MAX_CLAMPS }, (_, index) =>
          SemElectricPanelCard._editorClamp(this._config, index + 1)
        ).filter(Boolean),
        panelSize
      );
      for (let clamp = 1; clamp <= MAX_CLAMPS; clamp += 1) {
        const configured = SemElectricPanelCard._editorClamp(
          this._config,
          clamp
        );
        const pairing = pairPlan.byClamp.get(clamp);
        const breakerType = SemElectricPanelCard._breakerType(configured);
        const breakerRating = SemElectricPanelCard._breakerRating(
          configured?.breaker_rating
        );
        const assignment = document.createElement("div");
        assignment.dataset.clampAssignment = String(clamp);
        assignment.className = `clamp-assignment${
          pairing?.kind === "consumed" ? " consumed" : ""
        }`;
        assignment.append(
          this._createEntitySelect(
            `Clamp ${clamp}`,
            "entity",
            SemElectricPanelCard._cleanText(configured?.entity),
            clamp
          ),
          this._createDraftTextInput(
            "Display label",
            clamp,
            "name",
            SemElectricPanelCard._cleanText(configured?.name)
          ),
          this._createDraftTextInput(
            "Circuit number or label",
            clamp,
            "circuit",
            SemElectricPanelCard._cleanText(configured?.circuit)
          ),
          this._createCircuitPositionSelect(clamp, configured),
          this._createBreakerSelect(
            "Breaker type",
            clamp,
            "breaker_type",
            breakerType,
            [
              { value: "single", label: "Single pole" },
              {
                value: "double",
                label: "Two pole — paired with next same-side position",
              },
              {
                value: "tandem",
                label: "Tandem — two independent circuits in one position",
              },
            ]
          ),
          this._createBreakerSelect(
            "Breaker rating",
            clamp,
            "breaker_rating",
            breakerRating,
            [
              { value: "", label: "Not shown" },
              ...[...BREAKER_RATINGS].map((rating) => ({
                value: rating,
                label: `${rating} A`,
              })),
              ...(breakerRating && !BREAKER_RATINGS.has(breakerRating)
                ? [
                    {
                      value: breakerRating,
                      label: `${breakerRating} A (custom)`,
                    },
                  ]
                : []),
            ]
          )
        );
        if (breakerType === "tandem") {
          const tandem = document.createElement("section");
          tandem.className = "tandem-secondary";
          const tandemHeading = document.createElement("h4");
          tandemHeading.textContent = "Tandem second circuit";
          tandem.append(
            tandemHeading,
            this._createEntitySelect(
              "Entity",
              "tandem_entity",
              SemElectricPanelCard._cleanText(configured?.tandem_entity),
              clamp
            ),
            this._createDraftTextInput(
              "Display name",
              clamp,
              "tandem_name",
              SemElectricPanelCard._cleanText(configured?.tandem_name)
            ),
            this._createDraftTextInput(
              "Icon",
              clamp,
              "tandem_icon",
              SemElectricPanelCard._cleanText(configured?.tandem_icon)
            ),
            this._createBreakerSelect(
              "Display unit",
              clamp,
              "tandem_unit",
              VALID_UNITS.has(
                SemElectricPanelCard._cleanText(configured?.tandem_unit)
              )
                ? SemElectricPanelCard._cleanText(configured?.tandem_unit)
                : "auto",
              [
                { value: "auto", label: "Automatic" },
                { value: "W", label: "Watts (W)" },
                { value: "kW", label: "Kilowatts (kW)" },
                { value: "A", label: "Amps (A)" },
              ]
            ),
            this._createBreakerSelect(
              "Breaker rating",
              clamp,
              "tandem_breaker_rating",
              SemElectricPanelCard._breakerRating(
                configured?.tandem_breaker_rating
              ),
              [
                { value: "", label: "Not shown" },
                ...[...BREAKER_RATINGS].map((rating) => ({
                  value: rating,
                  label: `${rating} A`,
                })),
                ...(SemElectricPanelCard._breakerRating(
                  configured?.tandem_breaker_rating
                ) &&
                !BREAKER_RATINGS.has(
                  SemElectricPanelCard._breakerRating(
                    configured?.tandem_breaker_rating
                  )
                )
                  ? [
                      {
                        value: SemElectricPanelCard._breakerRating(
                          configured?.tandem_breaker_rating
                        ),
                        label: `${SemElectricPanelCard._breakerRating(
                          configured?.tandem_breaker_rating
                        )} A (custom)`,
                      },
                    ]
                  : []),
              ]
            )
          );
          assignment.append(tandem);
        }
        let pairingMessage = "";
        let isWarning = false;
        if (pairing?.kind === "owner") {
          const ownerLabel = SemElectricPanelCard._positionLabel(
            pairing.position,
            this._config?.numbering_style
          );
          const pairedLabel = SemElectricPanelCard._positionLabel(
            pairing.paired,
            this._config?.numbering_style
          );
          pairingMessage = `Pairs ${ownerLabel} with ${pairedLabel}. ${pairedLabel}'s configuration is preserved.`;
        } else if (pairing?.kind === "consumed") {
          const ownerLabel = SemElectricPanelCard._positionLabel(
            pairing.owner,
            this._config?.numbering_style
          );
          pairingMessage = `Used by ${ownerLabel} two-pole breaker. This position's configuration is preserved.`;
          if (pairing.warning) {
            pairingMessage += ` ${pairing.warning}`;
            isWarning = true;
          }
        } else if (pairing?.warning) {
          pairingMessage = pairing.warning;
          if (pairing.kind === "single") {
            pairingMessage += " It will render as single pole.";
          }
          isWarning = true;
        }
        if (pairingMessage) {
          const status = document.createElement("div");
          status.className = `pairing-status${isWarning ? " warning" : ""}`;
          status.setAttribute("role", isWarning ? "alert" : "status");
          status.textContent = pairingMessage;
          assignment.append(status);
        }
        circuitGrid.append(assignment);
      }
      circuits.append(circuitSummary, circuitGrid);
      section.append(main, circuits);
      return section;
    }

    _createEntityLoadingRegion() {
      const region = document.createElement("div");
      region.className = "entity-loading sticky-loading-banner";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-busy", "true");
      const spinner = document.createElement("span");
      spinner.className = "loading-spinner";
      spinner.setAttribute("aria-hidden", "true");
      const message = document.createElement("span");
      message.textContent = "Loading SEM Meter entities…";
      region.append(spinner, message);
      return region;
    }

    _setEntitySectionBusy(section, isBusy) {
      section.setAttribute("aria-busy", isBusy ? "true" : "false");
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
          this._deviceDiscoveryLoading ||
          this._entityChoicesLoading ||
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
        ["Invalid mapping", this._summary.invalidMappings],
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
        .entity-options {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          color: var(--primary-text-color);
          font-size: 0.88rem;
        }
        .entity-options input {
          width: 18px;
          height: 18px;
          margin: 0;
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
        .display-settings, .physical-positions {
          margin-bottom: 16px;
          padding: 16px;
          border: 1px solid var(--divider-color, #d5d5d5);
          border-radius: var(--ha-border-radius-md, 12px);
        }
        .display-settings-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .display-setting {
          align-content: start;
        }
        .display-setting-label {
          color: var(--primary-text-color);
          font-size: 0.88rem;
          font-weight: 600;
        }
        .display-setting-help {
          color: var(--secondary-text-color);
          font-size: 0.75rem;
          line-height: 1.35;
        }
        .entity-assignments {
          margin-bottom: 16px;
          padding: 16px;
          border: 1px solid var(--divider-color, #d5d5d5);
          border-radius: var(--ha-border-radius-md, 12px);
        }
        .entity-assignments details:first-of-type {
          margin-top: 0;
          border-top: 0;
          padding-top: 0;
        }
        .entity-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .entity-choice select {
          min-width: 0;
        }
        .clamp-assignment {
          display: grid;
          gap: 10px;
          padding: 12px;
          border: 1px solid var(--divider-color, #d5d5d5);
          border-radius: 8px;
        }
        .clamp-assignment.consumed {
          border-color: color-mix(in srgb, var(--primary-color, #03a9f4) 45%, var(--divider-color, #d5d5d5));
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 5%, transparent);
        }
        .tandem-secondary {
          display: grid;
          gap: 10px;
          padding: 10px;
          border: 1px solid color-mix(in srgb, var(--primary-color, #03a9f4) 35%, var(--divider-color, #d5d5d5));
          border-radius: 8px;
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 4%, transparent);
        }
        .tandem-secondary h4 {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 0.88rem;
        }
        .pairing-status {
          padding: 7px 9px;
          border-radius: 6px;
          color: var(--secondary-text-color);
          background: var(--secondary-background-color, #f5f5f5);
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .pairing-status.warning {
          color: var(--error-color, #db4437);
          background: color-mix(in srgb, var(--error-color, #db4437) 8%, transparent);
        }
        .draft-field input {
          box-sizing: border-box;
          width: 100%;
          min-height: 40px;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #bdbdbd);
          border-radius: 8px;
          color: var(--primary-text-color);
          background: var(--card-background-color, #fff);
          font: inherit;
        }
        .position-picker {
          max-width: 460px;
        }
        .position-status {
          margin-top: 12px;
          padding: 9px 11px;
          border-radius: 7px;
          color: var(--secondary-text-color);
          background: var(--secondary-background-color, #f5f5f5);
          font-size: 0.82rem;
          line-height: 1.4;
        }
        .position-status.warning {
          color: var(--error-color, #db4437);
          background: color-mix(in srgb, var(--error-color, #db4437) 8%, transparent);
        }
        .position-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .position-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .position-fields .tandem-secondary {
          grid-column-start: 1;
          grid-column-end: -1;
        }
        .entity-loading {
          position: sticky;
          z-index: 20;
          top: 8px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
          min-height: 42px;
          gap: 10px;
          margin: 0 0 10px;
          padding: 6px 12px;
          border: 1px solid var(--divider-color, #d5d5d5);
          border-radius: 8px;
          color: var(--secondary-text-color);
          background: color-mix(
            in srgb,
            var(--card-background-color, #fff) 94%,
            var(--primary-color, #03a9f4)
          );
          box-shadow: 0 2px 8px color-mix(in srgb, #000 18%, transparent);
          backdrop-filter: blur(6px);
          font-size: 0.9rem;
        }
        .loading-spinner {
          box-sizing: border-box;
          width: 20px;
          height: 20px;
          border: 2px solid var(--divider-color, #bdbdbd);
          border-top-color: var(--primary-color, #03a9f4);
          border-radius: 50%;
          animation: sem-entity-spin 700ms linear infinite;
        }
        @keyframes sem-entity-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 520px) {
          .controls, .device-picker-row, .entity-grid,
          .display-settings-grid, .position-fields {
            grid-template-columns: 1fr;
          }
        }
      `;

      const deviceSection = document.createElement("section");
      deviceSection.className = "device-section";
      const entityWorkLoading =
        this._deviceDiscoveryLoading || this._entityChoicesLoading;
      this._setEntitySectionBusy(deviceSection, entityWorkLoading);
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
      candidateSelect.disabled = entityWorkLoading;
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
        this._setSelectedDevice(deviceId).catch(() => {});
        const candidate = this._deviceCandidates.find(
          (item) => item.device_id === deviceId
        );
        this._deviceDiscoveryMessage = candidate
          ? `${candidate.label} selected`
          : "";
      });
      candidateLabel.append(candidateSelect);

      const refreshButton = document.createElement("button");
      refreshButton.type = "button";
      refreshButton.dataset.refreshDevices = "";
      refreshButton.textContent = "Refresh SEM Meter Devices";
      refreshButton.disabled = entityWorkLoading;
      refreshButton.addEventListener("click", () =>
        this._refreshDeviceCandidates()
      );
      devicePickerRow.append(candidateLabel, refreshButton);
      deviceSection.append(devicePickerRow);

      const showAllLabel = document.createElement("label");
      showAllLabel.className = "entity-options";
      const showAll = document.createElement("input");
      showAll.type = "checkbox";
      showAll.checked = this._config?.show_all_entities === true;
      showAll.disabled = entityWorkLoading;
      showAll.dataset.showAllEntities = "";
      showAll.addEventListener("change", () => {
        this._setShowAllEntities(showAll.checked).catch(() => {});
      });
      showAllLabel.append(
        showAll,
        document.createTextNode("Show all Home Assistant entities")
      );
      deviceSection.append(showAllLabel);

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
        "Replace all Main and Clamp entity assignments with the detected entities? Custom names, circuit labels, icons, units, breaker types, and ratings will be preserved.";
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
        false,
        false,
        false,
        false,
        false
      );
      const editorForm = this._createForm(
        editorFormSchema,
        SemElectricPanelCard._configForEditor(this._config)
      );
      const entityEditor = this._renderManualEntitySelectors();
      const physicalPositions = this._renderPhysicalPanelPositions();
      this._setEntitySectionBusy(entityEditor, entityWorkLoading);
      this._setEntitySectionBusy(physicalPositions, entityWorkLoading);
      const editorChildren = [style];
      if (entityWorkLoading) {
        editorChildren.push(this._createEntityLoadingRegion());
      }
      editorChildren.push(
        deviceSection,
        this._renderDisplaySettings(),
        manualHeading,
        entityEditor,
        physicalPositions,
        editorForm
      );
      this.shadowRoot.replaceChildren(...editorChildren);
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
