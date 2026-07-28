#pragma once

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

namespace esphome::sem_meter {

enum class ValidationFailureReason {
  NONE,
  NOT_FINITE,
  BELOW_MINIMUM,
  ABOVE_MAXIMUM,
  EXCESSIVE_JUMP,
};

enum class MeasurementId : uint8_t {
  NONE,
  PHASE_A_VOLTAGE,
  PHASE_B_VOLTAGE,
  LINE_FREQUENCY,
  MAIN_PHASE_A_POWER,
  MAIN_PHASE_B_POWER,
  MAIN_PHASE_C_POWER,
  TOTAL_MAIN_POWER,
  BALANCE_POWER,
  CIRCUIT_1_POWER,
  CIRCUIT_2_POWER,
  CIRCUIT_3_POWER,
  CIRCUIT_4_POWER,
  CIRCUIT_5_POWER,
  CIRCUIT_6_POWER,
  CIRCUIT_7_POWER,
  CIRCUIT_8_POWER,
  CIRCUIT_9_POWER,
  CIRCUIT_10_POWER,
  CIRCUIT_11_POWER,
  CIRCUIT_12_POWER,
  CIRCUIT_13_POWER,
  CIRCUIT_14_POWER,
  CIRCUIT_15_POWER,
  CIRCUIT_16_POWER,
  COUNT,
};

struct ValidationResult {
  bool valid;
  ValidationFailureReason reason;
};

struct ValidationAttempt {
  bool evaluated;
  ValidationResult result;
};

struct ValidationLimits {
  float minimum;
  float maximum;
  float maximum_delta;
  bool zero_bypasses_jump;
};

inline constexpr float PHASE_VOLTAGE_MINIMUM = 70.0f;
inline constexpr float PHASE_VOLTAGE_MAXIMUM = 150.0f;
inline constexpr float PHASE_VOLTAGE_MAXIMUM_DELTA = 40.0f;
inline constexpr float LINE_FREQUENCY_MINIMUM = 40.0f;
inline constexpr float LINE_FREQUENCY_MAXIMUM = 70.0f;
inline constexpr float LINE_FREQUENCY_MAXIMUM_DELTA = 10.0f;
inline constexpr float CIRCUIT_POWER_MINIMUM = 0.0f;
inline constexpr float CIRCUIT_POWER_MAXIMUM = 50000.0f;
inline constexpr float CIRCUIT_POWER_MAXIMUM_DELTA = 20000.0f;
inline constexpr float MAIN_PHASE_POWER_MINIMUM = 0.0f;
inline constexpr float MAIN_PHASE_POWER_MAXIMUM = 100000.0f;
inline constexpr float MAIN_PHASE_POWER_MAXIMUM_DELTA = 50000.0f;
inline constexpr float TOTAL_MAIN_POWER_MINIMUM = 0.0f;
inline constexpr float TOTAL_MAIN_POWER_MAXIMUM = 200000.0f;
inline constexpr float TOTAL_MAIN_POWER_MAXIMUM_DELTA = 100000.0f;
// Balance Power is clamped to zero by the existing YAML, so its preserved
// semantics are non-negative. It cannot reasonably exceed validated total power.
inline constexpr float BALANCE_POWER_MINIMUM = 0.0f;
inline constexpr float BALANCE_POWER_MAXIMUM = 200000.0f;
inline constexpr float BALANCE_POWER_MAXIMUM_DELTA = 100000.0f;

struct ValidationConfiguration {
  float phase_voltage_maximum_delta{PHASE_VOLTAGE_MAXIMUM_DELTA};
  float line_frequency_maximum_delta{LINE_FREQUENCY_MAXIMUM_DELTA};
  float circuit_power_maximum_delta{CIRCUIT_POWER_MAXIMUM_DELTA};
  float main_phase_power_maximum_delta{MAIN_PHASE_POWER_MAXIMUM_DELTA};
  float total_power_maximum_delta{TOTAL_MAIN_POWER_MAXIMUM_DELTA};
};

inline const char *validation_failure_reason_to_string(ValidationFailureReason reason) {
  switch (reason) {
    case ValidationFailureReason::NONE:
      return "NONE";
    case ValidationFailureReason::NOT_FINITE:
      return "NOT_FINITE";
    case ValidationFailureReason::BELOW_MINIMUM:
      return "BELOW_MINIMUM";
    case ValidationFailureReason::ABOVE_MAXIMUM:
      return "ABOVE_MAXIMUM";
    case ValidationFailureReason::EXCESSIVE_JUMP:
      return "EXCESSIVE_JUMP";
  }
  return "UNKNOWN";
}

inline const char *measurement_id_to_string(MeasurementId measurement) {
  switch (measurement) {
    case MeasurementId::NONE:
      return "NONE";
    case MeasurementId::PHASE_A_VOLTAGE:
      return "Phase A Voltage";
    case MeasurementId::PHASE_B_VOLTAGE:
      return "Phase B Voltage";
    case MeasurementId::LINE_FREQUENCY:
      return "Line Frequency";
    case MeasurementId::MAIN_PHASE_A_POWER:
      return "Main Phase A Power";
    case MeasurementId::MAIN_PHASE_B_POWER:
      return "Main Phase B Power";
    case MeasurementId::MAIN_PHASE_C_POWER:
      return "Main Phase C Power";
    case MeasurementId::TOTAL_MAIN_POWER:
      return "Total Main Power";
    case MeasurementId::BALANCE_POWER:
      return "Balance Power";
    case MeasurementId::CIRCUIT_1_POWER:
      return "Circuit 1 Power";
    case MeasurementId::CIRCUIT_2_POWER:
      return "Circuit 2 Power";
    case MeasurementId::CIRCUIT_3_POWER:
      return "Circuit 3 Power";
    case MeasurementId::CIRCUIT_4_POWER:
      return "Circuit 4 Power";
    case MeasurementId::CIRCUIT_5_POWER:
      return "Circuit 5 Power";
    case MeasurementId::CIRCUIT_6_POWER:
      return "Circuit 6 Power";
    case MeasurementId::CIRCUIT_7_POWER:
      return "Circuit 7 Power";
    case MeasurementId::CIRCUIT_8_POWER:
      return "Circuit 8 Power";
    case MeasurementId::CIRCUIT_9_POWER:
      return "Circuit 9 Power";
    case MeasurementId::CIRCUIT_10_POWER:
      return "Circuit 10 Power";
    case MeasurementId::CIRCUIT_11_POWER:
      return "Circuit 11 Power";
    case MeasurementId::CIRCUIT_12_POWER:
      return "Circuit 12 Power";
    case MeasurementId::CIRCUIT_13_POWER:
      return "A/C Power";
    case MeasurementId::CIRCUIT_14_POWER:
      return "Circuit 14 Power";
    case MeasurementId::CIRCUIT_15_POWER:
      return "Circuit 15 Power";
    case MeasurementId::CIRCUIT_16_POWER:
      return "Circuit 16 Power";
    case MeasurementId::COUNT:
      break;
  }
  return "UNKNOWN";
}

inline const char *measurement_unit_to_string(MeasurementId measurement) {
  switch (measurement) {
    case MeasurementId::PHASE_A_VOLTAGE:
    case MeasurementId::PHASE_B_VOLTAGE:
      return "V";
    case MeasurementId::LINE_FREQUENCY:
      return "Hz";
    case MeasurementId::MAIN_PHASE_A_POWER:
    case MeasurementId::MAIN_PHASE_B_POWER:
    case MeasurementId::MAIN_PHASE_C_POWER:
    case MeasurementId::TOTAL_MAIN_POWER:
    case MeasurementId::BALANCE_POWER:
    case MeasurementId::CIRCUIT_1_POWER:
    case MeasurementId::CIRCUIT_2_POWER:
    case MeasurementId::CIRCUIT_3_POWER:
    case MeasurementId::CIRCUIT_4_POWER:
    case MeasurementId::CIRCUIT_5_POWER:
    case MeasurementId::CIRCUIT_6_POWER:
    case MeasurementId::CIRCUIT_7_POWER:
    case MeasurementId::CIRCUIT_8_POWER:
    case MeasurementId::CIRCUIT_9_POWER:
    case MeasurementId::CIRCUIT_10_POWER:
    case MeasurementId::CIRCUIT_11_POWER:
    case MeasurementId::CIRCUIT_12_POWER:
    case MeasurementId::CIRCUIT_13_POWER:
    case MeasurementId::CIRCUIT_14_POWER:
    case MeasurementId::CIRCUIT_15_POWER:
    case MeasurementId::CIRCUIT_16_POWER:
      return "W";
    case MeasurementId::NONE:
    case MeasurementId::COUNT:
      break;
  }
  return "";
}

inline ValidationLimits validation_limits_for(
    MeasurementId measurement, const ValidationConfiguration &configuration = {}) {
  switch (measurement) {
    case MeasurementId::PHASE_A_VOLTAGE:
    case MeasurementId::PHASE_B_VOLTAGE:
      return {PHASE_VOLTAGE_MINIMUM, PHASE_VOLTAGE_MAXIMUM,
              configuration.phase_voltage_maximum_delta, false};
    case MeasurementId::LINE_FREQUENCY:
      return {LINE_FREQUENCY_MINIMUM, LINE_FREQUENCY_MAXIMUM,
              configuration.line_frequency_maximum_delta, false};
    case MeasurementId::MAIN_PHASE_A_POWER:
    case MeasurementId::MAIN_PHASE_B_POWER:
    case MeasurementId::MAIN_PHASE_C_POWER:
      return {MAIN_PHASE_POWER_MINIMUM, MAIN_PHASE_POWER_MAXIMUM,
              configuration.main_phase_power_maximum_delta, true};
    case MeasurementId::TOTAL_MAIN_POWER:
      return {TOTAL_MAIN_POWER_MINIMUM, TOTAL_MAIN_POWER_MAXIMUM,
              configuration.total_power_maximum_delta, true};
    case MeasurementId::BALANCE_POWER:
      return {BALANCE_POWER_MINIMUM, BALANCE_POWER_MAXIMUM,
              configuration.total_power_maximum_delta, true};
    case MeasurementId::CIRCUIT_1_POWER:
    case MeasurementId::CIRCUIT_2_POWER:
    case MeasurementId::CIRCUIT_3_POWER:
    case MeasurementId::CIRCUIT_4_POWER:
    case MeasurementId::CIRCUIT_5_POWER:
    case MeasurementId::CIRCUIT_6_POWER:
    case MeasurementId::CIRCUIT_7_POWER:
    case MeasurementId::CIRCUIT_8_POWER:
    case MeasurementId::CIRCUIT_9_POWER:
    case MeasurementId::CIRCUIT_10_POWER:
    case MeasurementId::CIRCUIT_11_POWER:
    case MeasurementId::CIRCUIT_12_POWER:
    case MeasurementId::CIRCUIT_13_POWER:
    case MeasurementId::CIRCUIT_14_POWER:
    case MeasurementId::CIRCUIT_15_POWER:
    case MeasurementId::CIRCUIT_16_POWER:
      return {CIRCUIT_POWER_MINIMUM, CIRCUIT_POWER_MAXIMUM,
              configuration.circuit_power_maximum_delta, true};
    case MeasurementId::NONE:
    case MeasurementId::COUNT:
      break;
  }
  return {0.0f, 0.0f, 0.0f, false};
}

class SEMMeterValidator {
 public:
  void set_phase_voltage_maximum_delta(float maximum_delta) {
    this->configuration_.phase_voltage_maximum_delta = maximum_delta;
  }
  void set_line_frequency_maximum_delta(float maximum_delta) {
    this->configuration_.line_frequency_maximum_delta = maximum_delta;
  }
  void set_circuit_power_maximum_delta(float maximum_delta) {
    this->configuration_.circuit_power_maximum_delta = maximum_delta;
  }
  void set_main_phase_power_maximum_delta(float maximum_delta) {
    this->configuration_.main_phase_power_maximum_delta = maximum_delta;
  }
  void set_total_power_maximum_delta(float maximum_delta) {
    this->configuration_.total_power_maximum_delta = maximum_delta;
  }
  const ValidationConfiguration &configuration() const { return this->configuration_; }

  bool mark_measurement_ready(MeasurementId measurement) {
    const size_t index = measurement_index_(measurement);
    if (index >= this->ready_.size()) {
      return false;
    }
    this->ready_[index] = true;
    return true;
  }

  bool measurement_ready(MeasurementId measurement) const {
    const size_t index = measurement_index_(measurement);
    return index < this->ready_.size() && this->ready_[index];
  }

  ValidationAttempt validate_if_ready(MeasurementId measurement, float value,
                                      uint32_t timestamp_ms) {
    if (!this->measurement_ready(measurement)) {
      return {false, {false, ValidationFailureReason::NONE}};
    }
    return {true, this->validate(measurement, value, timestamp_ms)};
  }

  ValidationResult validate(MeasurementId measurement, float value, uint32_t timestamp_ms) {
    const size_t index = measurement_index_(measurement);
    if (index >= this->accepted_.size()) {
      return this->reject_(measurement, value, timestamp_ms,
                           ValidationFailureReason::ABOVE_MAXIMUM);
    }

    const ValidationLimits limits = validation_limits_for(measurement, this->configuration_);
    ValidationFailureReason reason = ValidationFailureReason::NONE;
    if (!std::isfinite(value)) {
      reason = ValidationFailureReason::NOT_FINITE;
    } else if (value < limits.minimum) {
      reason = ValidationFailureReason::BELOW_MINIMUM;
    } else if (value > limits.maximum) {
      reason = ValidationFailureReason::ABOVE_MAXIMUM;
    } else if (this->accepted_[index].initialized &&
               !(limits.zero_bypasses_jump && value == 0.0f) &&
               std::fabs(value - this->accepted_[index].value) > limits.maximum_delta) {
      reason = ValidationFailureReason::EXCESSIVE_JUMP;
    }

    if (reason != ValidationFailureReason::NONE) {
      return this->reject_(measurement, value, timestamp_ms, reason);
    }

    this->accepted_[index].value = value;
    this->accepted_[index].initialized = true;
    return {true, ValidationFailureReason::NONE};
  }

  bool has_accepted_value(MeasurementId measurement) const {
    const size_t index = measurement_index_(measurement);
    return index < this->accepted_.size() && this->accepted_[index].initialized;
  }

  float last_accepted_value(MeasurementId measurement) const {
    const size_t index = measurement_index_(measurement);
    return index < this->accepted_.size() && this->accepted_[index].initialized
               ? this->accepted_[index].value
               : 0.0f;
  }

  uint64_t rejected_sensor_values() const { return this->rejected_sensor_values_; }
  bool has_rejected_sensor_value() const { return this->rejected_sensor_values_ > 0; }
  float last_rejected_value() const { return this->last_rejected_value_; }
  MeasurementId last_rejected_measurement() const {
    return this->last_rejected_measurement_;
  }
  ValidationFailureReason last_rejection_reason() const {
    return this->last_rejection_reason_;
  }
  uint32_t last_rejection_timestamp_ms() const {
    return this->last_rejection_timestamp_ms_;
  }

 private:
  struct AcceptedValue {
    float value{0.0f};
    bool initialized{false};
  };

  static constexpr size_t MEASUREMENT_COUNT =
      static_cast<size_t>(MeasurementId::COUNT) - 1;

  static size_t measurement_index_(MeasurementId measurement) {
    const size_t raw = static_cast<size_t>(measurement);
    return raw == 0 ? MEASUREMENT_COUNT : raw - 1;
  }

  ValidationResult reject_(MeasurementId measurement, float value, uint32_t timestamp_ms,
                           ValidationFailureReason reason) {
    this->rejected_sensor_values_++;
    this->last_rejected_value_ = value;
    this->last_rejected_measurement_ = measurement;
    this->last_rejection_reason_ = reason;
    this->last_rejection_timestamp_ms_ = timestamp_ms;
    return {false, reason};
  }

  std::array<AcceptedValue, MEASUREMENT_COUNT> accepted_{};
  std::array<bool, MEASUREMENT_COUNT> ready_{};
  ValidationConfiguration configuration_{};
  uint64_t rejected_sensor_values_{0};
  float last_rejected_value_{0.0f};
  MeasurementId last_rejected_measurement_{MeasurementId::NONE};
  ValidationFailureReason last_rejection_reason_{ValidationFailureReason::NONE};
  uint32_t last_rejection_timestamp_ms_{0};
};

}  // namespace esphome::sem_meter
