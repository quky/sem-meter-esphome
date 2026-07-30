#pragma once

#include <cstdint>
#include <limits>

#include "sem_meter_diagnostics.h"

namespace esphome::sem_meter {

inline constexpr char SEM_METER_COMPONENT_VERSION[] = "3.0.0-dev";
inline constexpr char SEM_METER_HARDWARE_PROFILE[] =
    "ESP32-S3 / UART RX GPIO39 / Buzzer GPIO41";
inline constexpr char SEM_METER_BOARD_VARIANT[] = "QUKY_GPIO41";

enum class SEMResetReason {
  UNKNOWN,
  POWER_ON,
  EXTERNAL_RESET,
  SOFTWARE_RESET,
  PANIC,
  INTERRUPT_WATCHDOG,
  TASK_WATCHDOG,
  OTHER_WATCHDOG,
  DEEP_SLEEP,
  BROWNOUT,
  SDIO_RESET,
  USB_RESET,
  JTAG_RESET,
  EFUSE_ERROR,
  POWER_GLITCH,
  CPU_LOCKUP,
};

inline const char *sem_reset_reason_to_string(SEMResetReason reason) {
  switch (reason) {
    case SEMResetReason::UNKNOWN:
      return "UNKNOWN";
    case SEMResetReason::POWER_ON:
      return "POWER_ON";
    case SEMResetReason::EXTERNAL_RESET:
      return "EXTERNAL_RESET";
    case SEMResetReason::SOFTWARE_RESET:
      return "SOFTWARE_RESET";
    case SEMResetReason::PANIC:
      return "PANIC";
    case SEMResetReason::INTERRUPT_WATCHDOG:
      return "INTERRUPT_WATCHDOG";
    case SEMResetReason::TASK_WATCHDOG:
      return "TASK_WATCHDOG";
    case SEMResetReason::OTHER_WATCHDOG:
      return "OTHER_WATCHDOG";
    case SEMResetReason::DEEP_SLEEP:
      return "DEEP_SLEEP";
    case SEMResetReason::BROWNOUT:
      return "BROWNOUT";
    case SEMResetReason::SDIO_RESET:
      return "SDIO_RESET";
    case SEMResetReason::USB_RESET:
      return "USB_RESET";
    case SEMResetReason::JTAG_RESET:
      return "JTAG_RESET";
    case SEMResetReason::EFUSE_ERROR:
      return "EFUSE_ERROR";
    case SEMResetReason::POWER_GLITCH:
      return "POWER_GLITCH";
    case SEMResetReason::CPU_LOCKUP:
      return "CPU_LOCKUP";
  }
  return "UNKNOWN";
}

struct SEMMeterRuntimeCounterValues {
  uint32_t parser_fault_count{0};
  uint32_t wifi_fault_count{0};
  uint32_t self_test_run_count{0};
  uint32_t self_test_failure_count{0};
};

enum RuntimeCounterChange : uint8_t {
  RUNTIME_COUNTER_NONE = 0,
  RUNTIME_COUNTER_PARSER_FAULT = 1U << 0,
  RUNTIME_COUNTER_WIFI_FAULT = 1U << 1,
  RUNTIME_COUNTER_SELF_TEST_RUN = 1U << 2,
  RUNTIME_COUNTER_SELF_TEST_FAILURE = 1U << 3,
  RUNTIME_COUNTER_ALL = RUNTIME_COUNTER_PARSER_FAULT |
                        RUNTIME_COUNTER_WIFI_FAULT |
                        RUNTIME_COUNTER_SELF_TEST_RUN |
                        RUNTIME_COUNTER_SELF_TEST_FAILURE,
};

class SEMMeterRuntimeCounters {
 public:
  explicit SEMMeterRuntimeCounters(
      const SEMMeterRuntimeCounterValues &initial = {})
      : values_(initial) {}

  uint8_t record_event(ComponentEvent event) {
    if (event == ComponentEvent::UART_TIMEOUT) {
      increment_(this->values_.parser_fault_count);
      return RUNTIME_COUNTER_PARSER_FAULT;
    }
    if (event == ComponentEvent::WIFI_TIMEOUT) {
      increment_(this->values_.wifi_fault_count);
      return RUNTIME_COUNTER_WIFI_FAULT;
    }
    return RUNTIME_COUNTER_NONE;
  }

  uint8_t record_self_test_start() {
    increment_(this->values_.self_test_run_count);
    return RUNTIME_COUNTER_SELF_TEST_RUN;
  }

  uint8_t record_self_test_result(SelfTestSignal signal) {
    if (signal != SelfTestSignal::FAILED) {
      return RUNTIME_COUNTER_NONE;
    }
    increment_(this->values_.self_test_failure_count);
    return RUNTIME_COUNTER_SELF_TEST_FAILURE;
  }

  const SEMMeterRuntimeCounterValues &values() const { return this->values_; }

 private:
  static void increment_(uint32_t &value) {
    value = value == std::numeric_limits<uint32_t>::max() ? 0U : value + 1U;
  }

  SEMMeterRuntimeCounterValues values_{};
};

}  // namespace esphome::sem_meter
