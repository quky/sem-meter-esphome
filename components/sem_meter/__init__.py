import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import uart
from esphome.const import CONF_ID

CONF_BRANCH_POWER_DIVISOR = "branch_power_divisor"
CONF_MAIN_POWER_DIVISOR = "main_power_divisor"
CONF_VOLTAGE_DIVISOR = "voltage_divisor"

DEPENDENCIES = ["uart"]

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
