#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace esphome::sem_meter {

inline constexpr size_t COMPLETE_FRAME_SIZE = 447;
inline constexpr float BRANCH_POWER_DIVISOR = 95.0f;
inline constexpr float MAIN_POWER_DIVISOR = 102.0f;
inline constexpr float VOLTAGE_DIVISOR = 10.30f;

inline constexpr uint8_t MARKER_PRIMARY = 0xFF;
inline constexpr uint8_t MARKER_SECONDARY = 0x3B;
inline constexpr uint8_t MARKER_LIVE_SECONDARY = 0x3C;
inline constexpr uint8_t STATUS_IDLE = 0x01;
inline constexpr uint8_t STATUS_ACTIVE = 0x03;
inline constexpr uint8_t STATUS_ALTERNATE_ACTIVE = 0x07;

inline constexpr size_t RECORD_PAYLOAD_SIZE = 21;
inline constexpr size_t RECORD_MINIMUM_SIZE = 2 + RECORD_PAYLOAD_SIZE;
inline constexpr size_t RECORD_OVERLAP_SIZE = RECORD_MINIMUM_SIZE - 1;
inline constexpr size_t RECORD_CADENCE_SIZE = 22;
inline constexpr size_t RECORD_COUNT = 19;
inline constexpr size_t RECORD_SEQUENCE_SIZE =
    (RECORD_COUNT - 1) * RECORD_CADENCE_SIZE + RECORD_MINIMUM_SIZE;

inline constexpr uint8_t LAST_BRANCH_RECORD_ID = 0x0F;
inline constexpr uint8_t PHASE_A_RECORD_ID = 0x10;
inline constexpr uint8_t PHASE_B_RECORD_ID = 0x11;
inline constexpr uint8_t PHASE_C_RECORD_ID = 0x12;
inline constexpr uint8_t LAST_RECORD_ID = PHASE_C_RECORD_ID;

inline constexpr size_t VOLTAGE_OFFSET = 4;
inline constexpr size_t POWER_OFFSET = 12;
inline constexpr size_t FREQUENCY_OFFSET = 20;
inline constexpr uint16_t MINIMUM_VALID_RAW_VOLTAGE = 900;

class SEMMeterRecordParser {
 public:
  void set_branch_power_divisor(float divisor) { this->branch_power_divisor_ = divisor; }
  void set_main_power_divisor(float divisor) { this->main_power_divisor_ = divisor; }
  void set_voltage_divisor(float divisor) { this->voltage_divisor_ = divisor; }
  float get_branch_power_divisor() const { return this->branch_power_divisor_; }
  float get_main_power_divisor() const { return this->main_power_divisor_; }
  float get_voltage_divisor() const { return this->voltage_divisor_; }

  float get_branch_power(size_t index) const {
    return index < this->branch_power_.size() ? this->branch_power_[index] : 0.0f;
  }
  float get_phase_a_power() const { return this->phase_power_[0]; }
  float get_phase_b_power() const { return this->phase_power_[1]; }
  float get_phase_c_power() const { return this->phase_power_[2]; }
  float get_phase_a_voltage() const { return this->phase_voltage_[0]; }
  float get_phase_b_voltage() const { return this->phase_voltage_[1]; }
  float get_line_frequency() const { return this->line_frequency_; }
  bool has_phase_a_voltage() const { return this->phase_voltage_initialized_[0]; }
  bool has_phase_b_voltage() const { return this->phase_voltage_initialized_[1]; }
  bool has_line_frequency() const { return this->line_frequency_initialized_; }

  bool decode_record(uint8_t record_id, const uint8_t *payload, size_t payload_size) {
    if (record_id > LAST_RECORD_ID || payload == nullptr || payload_size < RECORD_PAYLOAD_SIZE) {
      return false;
    }

    const uint8_t status = payload[0];
    if (!is_valid_status(status)) {
      return false;
    }

    if (status == STATUS_IDLE) {
      if (record_id <= LAST_BRANCH_RECORD_ID) {
        this->branch_power_[record_id] = 0.0f;
      } else {
        this->phase_power_[record_id - PHASE_A_RECORD_ID] = 0.0f;
      }
      return true;
    }

    const uint32_t raw_power = read_big_endian_u32(payload + POWER_OFFSET);
    if (record_id <= LAST_BRANCH_RECORD_ID) {
      this->branch_power_[record_id] = static_cast<float>(raw_power) / this->branch_power_divisor_;
      return true;
    }

    this->phase_power_[record_id - PHASE_A_RECORD_ID] =
        static_cast<float>(raw_power) / this->main_power_divisor_;

    const uint16_t raw_voltage = read_big_endian_u16(payload + VOLTAGE_OFFSET);
    if (raw_voltage <= MINIMUM_VALID_RAW_VOLTAGE) {
      return true;
    }

    if (record_id == PHASE_A_RECORD_ID) {
      this->phase_voltage_[0] = static_cast<float>(raw_voltage) / this->voltage_divisor_;
      this->line_frequency_ = static_cast<float>(payload[FREQUENCY_OFFSET]);
      this->phase_voltage_initialized_[0] = true;
      this->line_frequency_initialized_ = true;
    } else if (record_id == PHASE_B_RECORD_ID) {
      this->phase_voltage_[1] = static_cast<float>(raw_voltage) / this->voltage_divisor_;
      this->phase_voltage_initialized_[1] = true;
    }

    return true;
  }

  static bool is_marker(uint8_t value) {
    return value == MARKER_PRIMARY || value == MARKER_SECONDARY ||
           value == MARKER_LIVE_SECONDARY;
  }

  static bool is_valid_status(uint8_t value) {
    return value == STATUS_IDLE || value == STATUS_ACTIVE || value == STATUS_ALTERNATE_ACTIVE;
  }

 private:
  static uint16_t read_big_endian_u16(const uint8_t *data) {
    return (static_cast<uint16_t>(data[0]) << 8) | static_cast<uint16_t>(data[1]);
  }

  static uint32_t read_big_endian_u32(const uint8_t *data) {
    return (static_cast<uint32_t>(data[0]) << 24) | (static_cast<uint32_t>(data[1]) << 16) |
           (static_cast<uint32_t>(data[2]) << 8) | static_cast<uint32_t>(data[3]);
  }

  std::array<float, 16> branch_power_{};
  std::array<float, 3> phase_power_{};
  std::array<float, 2> phase_voltage_{};
  std::array<bool, 2> phase_voltage_initialized_{};
  float line_frequency_{0.0f};
  bool line_frequency_initialized_{false};
  float branch_power_divisor_{BRANCH_POWER_DIVISOR};
  float main_power_divisor_{MAIN_POWER_DIVISOR};
  float voltage_divisor_{VOLTAGE_DIVISOR};
};

}  // namespace esphome::sem_meter
