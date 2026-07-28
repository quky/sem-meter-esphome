import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import binary_sensor, sensor, text_sensor, uart
from esphome.const import (
    CONF_ID,
    ENTITY_CATEGORY_DIAGNOSTIC,
    STATE_CLASS_MEASUREMENT,
    STATE_CLASS_TOTAL_INCREASING,
    UNIT_MILLISECOND,
)

CONF_BRANCH_POWER_DIVISOR = "branch_power_divisor"
CONF_MAIN_POWER_DIVISOR = "main_power_divisor"
CONF_VOLTAGE_DIVISOR = "voltage_divisor"
CONF_UART_TIMEOUT = "uart_timeout"
CONF_SEM_METER_HEALTHY = "sem_meter_healthy"
CONF_UART_HEALTHY = "uart_healthy"
CONF_COMPONENT_STATE = "component_state"
CONF_LAST_EVENT = "last_event"
CONF_MILLISECONDS_SINCE_LAST_FRAME = "milliseconds_since_last_frame"
CONF_FRAMES_PROCESSED = "frames_processed"
CONF_MALFORMED_FRAMES = "malformed_frames"
CONF_BUFFER_RECOVERIES = "buffer_recoveries"
CONF_EVENT_COUNT = "event_count"
CONF_LAST_REJECTED_SENSOR = "last_rejected_sensor"
CONF_LAST_REJECTION_REASON = "last_rejection_reason"
CONF_LAST_REJECTED_VALUE = "last_rejected_value"
CONF_REJECTED_SAMPLES = "rejected_samples"
CONF_PHASE_VOLTAGE_MAXIMUM_DELTA = "phase_voltage_maximum_delta"
CONF_LINE_FREQUENCY_MAXIMUM_DELTA = "line_frequency_maximum_delta"
CONF_CIRCUIT_POWER_MAXIMUM_DELTA = "circuit_power_maximum_delta"
CONF_MAIN_PHASE_POWER_MAXIMUM_DELTA = "main_phase_power_maximum_delta"
CONF_TOTAL_POWER_MAXIMUM_DELTA = "total_power_maximum_delta"

DEPENDENCIES = ["uart"]
AUTO_LOAD = ["binary_sensor", "sensor", "text_sensor"]

sem_meter_ns = cg.esphome_ns.namespace("sem_meter")
SEMMeterComponent = sem_meter_ns.class_(
    "SEMMeterComponent", cg.Component, uart.UARTDevice
)

CONFIG_SCHEMA = (
    cv.Schema(
        {
            cv.GenerateID(): cv.declare_id(SEMMeterComponent),
            cv.Optional(CONF_BRANCH_POWER_DIVISOR, default=95.0): cv.positive_float,
            cv.Optional(CONF_MAIN_POWER_DIVISOR, default=102.0): cv.positive_float,
            cv.Optional(CONF_VOLTAGE_DIVISOR, default=10.30): cv.positive_float,
            cv.Optional(CONF_UART_TIMEOUT, default="10s"): cv.positive_time_period_milliseconds,
            cv.Optional(CONF_PHASE_VOLTAGE_MAXIMUM_DELTA, default=40.0): cv.positive_float,
            cv.Optional(CONF_LINE_FREQUENCY_MAXIMUM_DELTA, default=10.0): cv.positive_float,
            cv.Optional(CONF_CIRCUIT_POWER_MAXIMUM_DELTA, default=20000.0): cv.positive_float,
            cv.Optional(CONF_MAIN_PHASE_POWER_MAXIMUM_DELTA, default=50000.0): cv.positive_float,
            cv.Optional(CONF_TOTAL_POWER_MAXIMUM_DELTA, default=100000.0): cv.positive_float,
            cv.Optional(CONF_SEM_METER_HEALTHY): binary_sensor.binary_sensor_schema(
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_UART_HEALTHY): binary_sensor.binary_sensor_schema(
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_COMPONENT_STATE): text_sensor.text_sensor_schema(
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_LAST_EVENT): text_sensor.text_sensor_schema(
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_MILLISECONDS_SINCE_LAST_FRAME): sensor.sensor_schema(
                unit_of_measurement=UNIT_MILLISECOND,
                accuracy_decimals=0,
                state_class=STATE_CLASS_MEASUREMENT,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_FRAMES_PROCESSED): sensor.sensor_schema(
                accuracy_decimals=0,
                state_class=STATE_CLASS_TOTAL_INCREASING,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_MALFORMED_FRAMES): sensor.sensor_schema(
                accuracy_decimals=0,
                state_class=STATE_CLASS_TOTAL_INCREASING,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_BUFFER_RECOVERIES): sensor.sensor_schema(
                accuracy_decimals=0,
                state_class=STATE_CLASS_TOTAL_INCREASING,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_EVENT_COUNT): sensor.sensor_schema(
                accuracy_decimals=0,
                state_class=STATE_CLASS_TOTAL_INCREASING,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_LAST_REJECTED_SENSOR): text_sensor.text_sensor_schema(
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_LAST_REJECTION_REASON): text_sensor.text_sensor_schema(
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_LAST_REJECTED_VALUE): sensor.sensor_schema(
                accuracy_decimals=2,
                state_class=STATE_CLASS_MEASUREMENT,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
            cv.Optional(CONF_REJECTED_SAMPLES): sensor.sensor_schema(
                accuracy_decimals=0,
                state_class=STATE_CLASS_TOTAL_INCREASING,
                entity_category=ENTITY_CATEGORY_DIAGNOSTIC,
            ),
        }
    )
    .extend(cv.COMPONENT_SCHEMA)
    .extend(uart.UART_DEVICE_SCHEMA)
)

FINAL_VALIDATE_SCHEMA = uart.final_validate_device_schema(
    "sem_meter",
    baud_rate=115200,
    data_bits=8,
    parity="NONE",
    stop_bits=1,
    require_rx=True,
)


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await uart.register_uart_device(var, config)
    cg.add(var.set_branch_power_divisor(config[CONF_BRANCH_POWER_DIVISOR]))
    cg.add(var.set_main_power_divisor(config[CONF_MAIN_POWER_DIVISOR]))
    cg.add(var.set_voltage_divisor(config[CONF_VOLTAGE_DIVISOR]))
    cg.add(var.set_uart_timeout_ms(config[CONF_UART_TIMEOUT].total_milliseconds))
    cg.add(
        var.set_phase_voltage_maximum_delta(
            config[CONF_PHASE_VOLTAGE_MAXIMUM_DELTA]
        )
    )
    cg.add(
        var.set_line_frequency_maximum_delta(
            config[CONF_LINE_FREQUENCY_MAXIMUM_DELTA]
        )
    )
    cg.add(
        var.set_circuit_power_maximum_delta(
            config[CONF_CIRCUIT_POWER_MAXIMUM_DELTA]
        )
    )
    cg.add(
        var.set_main_phase_power_maximum_delta(
            config[CONF_MAIN_PHASE_POWER_MAXIMUM_DELTA]
        )
    )
    cg.add(
        var.set_total_power_maximum_delta(
            config[CONF_TOTAL_POWER_MAXIMUM_DELTA]
        )
    )

    if CONF_SEM_METER_HEALTHY in config:
        sens = await binary_sensor.new_binary_sensor(config[CONF_SEM_METER_HEALTHY])
        cg.add(var.set_sem_meter_healthy_binary_sensor(sens))
    if CONF_UART_HEALTHY in config:
        sens = await binary_sensor.new_binary_sensor(config[CONF_UART_HEALTHY])
        cg.add(var.set_uart_healthy_binary_sensor(sens))
    if CONF_COMPONENT_STATE in config:
        sens = await text_sensor.new_text_sensor(config[CONF_COMPONENT_STATE])
        cg.add(var.set_component_state_text_sensor(sens))
    if CONF_LAST_EVENT in config:
        sens = await text_sensor.new_text_sensor(config[CONF_LAST_EVENT])
        cg.add(var.set_last_event_text_sensor(sens))
    if CONF_MILLISECONDS_SINCE_LAST_FRAME in config:
        sens = await sensor.new_sensor(config[CONF_MILLISECONDS_SINCE_LAST_FRAME])
        cg.add(var.set_milliseconds_since_last_frame_sensor(sens))
    if CONF_FRAMES_PROCESSED in config:
        sens = await sensor.new_sensor(config[CONF_FRAMES_PROCESSED])
        cg.add(var.set_frames_processed_sensor(sens))
    if CONF_MALFORMED_FRAMES in config:
        sens = await sensor.new_sensor(config[CONF_MALFORMED_FRAMES])
        cg.add(var.set_malformed_frames_sensor(sens))
    if CONF_BUFFER_RECOVERIES in config:
        sens = await sensor.new_sensor(config[CONF_BUFFER_RECOVERIES])
        cg.add(var.set_buffer_recoveries_sensor(sens))
    if CONF_EVENT_COUNT in config:
        sens = await sensor.new_sensor(config[CONF_EVENT_COUNT])
        cg.add(var.set_event_count_sensor(sens))
    if CONF_LAST_REJECTED_SENSOR in config:
        sens = await text_sensor.new_text_sensor(config[CONF_LAST_REJECTED_SENSOR])
        cg.add(var.set_last_rejected_sensor_text_sensor(sens))
    if CONF_LAST_REJECTION_REASON in config:
        sens = await text_sensor.new_text_sensor(config[CONF_LAST_REJECTION_REASON])
        cg.add(var.set_last_rejection_reason_text_sensor(sens))
    if CONF_LAST_REJECTED_VALUE in config:
        sens = await sensor.new_sensor(config[CONF_LAST_REJECTED_VALUE])
        cg.add(var.set_last_rejected_value_sensor(sens))
    if CONF_REJECTED_SAMPLES in config:
        sens = await sensor.new_sensor(config[CONF_REJECTED_SAMPLES])
        cg.add(var.set_rejected_samples_sensor(sens))
