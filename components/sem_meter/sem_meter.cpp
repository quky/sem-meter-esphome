#include "sem_meter.h"

#include <algorithm>
#include <array>
#include <cinttypes>

#include "esphome/core/hal.h"
#include "esphome/core/log.h"

namespace esphome::sem_meter {

static const char *const TAG = "sem_meter";

void SEMMeterComponent::setup() {
  ESP_LOGI(TAG, "SEM Meter parser started");
  const uint32_t now = millis();
  this->last_diagnostic_publish_ms_ = now;
  this->apply_health_update_(this->health_.setup_completed(now));
  this->publish_rejection_diagnostics_();
}

void SEMMeterComponent::loop() {
  const uint32_t loop_started_at = micros();

  // Hard scheduler budget: perform at most one UART read totaling no more than
  // MAX_BYTES_PER_LOOP, then decode at most MAX_FRAMES_PER_LOOP frame.
  std::array<uint8_t, MAX_BYTES_PER_LOOP> incoming;
  const size_t available_bytes = this->available();
  const size_t bytes_to_read = std::min(available_bytes, MAX_BYTES_PER_LOOP);
  if (bytes_to_read > 0) {
    if (!this->read_array(incoming.data(), bytes_to_read)) {
      ESP_LOGW(TAG, "UART read failed; preserving %zu buffered bytes", this->accumulator_.buffered_size());
      const uint32_t now = millis();
      this->apply_health_update_(this->health_.check_timeout(now));
      this->publish_periodic_diagnostics_(now);
      this->record_loop_time_(loop_started_at);
      return;
    }
  }

  const uint32_t now = millis();
  const uint32_t accumulator_started_at = micros();
  const SEMMeterFeedResult result =
      this->accumulator_.feed(incoming.data(), bytes_to_read, this, &this->diagnostics_,
                              &this->cycle_validator_, now);
  this->diagnostics_.record_accumulator_time(micros() - accumulator_started_at);

  if (result.bytes_dropped > 0) {
    this->apply_health_update_(this->health_.record_buffer_overflow(now));
  }
  for (size_t malformed_index = 0;
       malformed_index < result.malformed_frames; malformed_index++) {
    this->apply_health_update_(this->health_.record_malformed_frame(now));
  }
  if (result.validation_rejections > 0) {
    this->validator_.record_rejection(
        result.rejected_measurement, result.rejected_value, now,
        result.rejection_reason);
    ESP_LOGW(TAG, "SEM Meter rejected %s value %.2f %s: %s",
             measurement_id_to_string(result.rejected_measurement),
             result.rejected_value,
             measurement_unit_to_string(result.rejected_measurement),
             validation_failure_reason_to_string(result.rejection_reason));
    if (this->dispatch_event_(ComponentEvent::INVALID_SENSOR_VALUE, now)) {
      this->publish_immediate_diagnostics_();
    }
    this->publish_rejection_diagnostics_();
  }
  if (result.frames_processed > 0 && result.decoded_records == 0) {
    this->apply_health_update_(this->health_.record_malformed_frame(now));
  }
  if (result.frames_processed > 0 && result.decoded_records > 0) {
    this->apply_health_update_(this->health_.record_valid_frame(now));
  }
  this->apply_health_update_(this->health_.check_timeout(now));
  this->publish_periodic_diagnostics_(now);

  this->record_loop_time_(loop_started_at);
}

void SEMMeterComponent::apply_health_update_(const SEMMeterHealthUpdate &update) {
  if (update.state_changed()) {
    ESP_LOGI(TAG, "State changed: %s -> %s", component_state_to_string(update.previous_state),
             component_state_to_string(update.current_state));
  }

  const bool event_dispatched = this->dispatch_event_(update.event, update.timestamp_ms);
  if (update.state_changed() || event_dispatched) {
    this->publish_immediate_diagnostics_();
  }
}

bool SEMMeterComponent::dispatch_event_(ComponentEvent event, uint32_t timestamp_ms) {
  if (!this->event_dispatcher_.dispatch(event, timestamp_ms)) {
    return false;
  }

  switch (event) {
    case ComponentEvent::NONE:
      break;
    case ComponentEvent::SYSTEM_STARTED:
      ESP_LOGI(TAG, "SEM Meter system started");
      break;
    case ComponentEvent::UART_STARTED:
      ESP_LOGI(TAG, "UART data started");
      break;
    case ComponentEvent::UART_TIMEOUT:
      ESP_LOGW(TAG, "UART valid-frame timeout after %" PRIu32 " ms", this->health_.uart_timeout_ms());
      break;
    case ComponentEvent::UART_RESTORED:
      ESP_LOGI(TAG, "UART data restored");
      break;
    case ComponentEvent::BUFFER_OVERFLOW:
      ESP_LOGW(TAG, "UART receive buffer overflow recovery");
      break;
    case ComponentEvent::MALFORMED_FRAME:
      ESP_LOGW(TAG, "Rejected one malformed or out-of-sync SEM measurement cycle");
      break;
    case ComponentEvent::INVALID_SENSOR_VALUE:
      break;
  }
  return true;
}

optional<float> SEMMeterComponent::validate_sensor_value(MeasurementId measurement, float value) {
  const uint32_t now = millis();
  const ValidationAttempt attempt =
      this->validator_.validate_if_ready(measurement, value, now);
  if (!attempt.evaluated) {
    return {};
  }
  const ValidationResult result = attempt.result;
  if (result.valid) {
    return value;
  }

  ESP_LOGW(TAG, "SEM Meter rejected %s value %.2f %s: %s",
           measurement_id_to_string(measurement), value, measurement_unit_to_string(measurement),
           validation_failure_reason_to_string(result.reason));
  if (this->dispatch_event_(ComponentEvent::INVALID_SENSOR_VALUE, now)) {
    this->publish_immediate_diagnostics_();
  }
  this->publish_rejection_diagnostics_();
  return {};
}

void SEMMeterComponent::publish_immediate_diagnostics_() {
  if (this->sem_meter_healthy_binary_sensor_ != nullptr) {
    this->sem_meter_healthy_binary_sensor_->publish_state(this->health_.sem_meter_healthy());
  }
  if (this->uart_healthy_binary_sensor_ != nullptr) {
    this->uart_healthy_binary_sensor_->publish_state(this->health_.uart_healthy());
  }
  if (this->component_state_text_sensor_ != nullptr) {
    this->component_state_text_sensor_->publish_state(component_state_to_string(this->health_.state()));
  }
  if (this->last_event_text_sensor_ != nullptr) {
    this->last_event_text_sensor_->publish_state(component_event_to_string(this->event_dispatcher_.last_event()));
  }
}

void SEMMeterComponent::publish_periodic_diagnostics_(uint32_t timestamp_ms) {
  if (timestamp_ms - this->last_diagnostic_publish_ms_ < DIAGNOSTIC_PUBLISH_INTERVAL_MS) {
    return;
  }
  this->last_diagnostic_publish_ms_ = timestamp_ms;

  if (this->milliseconds_since_last_frame_sensor_ != nullptr) {
    this->milliseconds_since_last_frame_sensor_->publish_state(
        static_cast<float>(this->health_.milliseconds_since_last_valid_frame(timestamp_ms)));
  }
  if (this->frames_processed_sensor_ != nullptr) {
    this->frames_processed_sensor_->publish_state(
        static_cast<float>(this->diagnostics_.counters().frames_processed));
  }
  if (this->malformed_frames_sensor_ != nullptr) {
    this->malformed_frames_sensor_->publish_state(
        static_cast<float>(this->diagnostics_.counters().malformed_frames));
  }
  if (this->buffer_recoveries_sensor_ != nullptr) {
    this->buffer_recoveries_sensor_->publish_state(
        static_cast<float>(this->diagnostics_.counters().buffer_recovery_events));
  }
  if (this->event_count_sensor_ != nullptr) {
    this->event_count_sensor_->publish_state(static_cast<float>(this->event_dispatcher_.event_count()));
  }
  if (this->last_rejected_value_sensor_ != nullptr &&
      this->validator_.rejected_sensor_values() > 0) {
    this->last_rejected_value_sensor_->publish_state(this->validator_.last_rejected_value());
  }
  if (this->rejected_samples_sensor_ != nullptr) {
    this->rejected_samples_sensor_->publish_state(
        static_cast<float>(this->validator_.rejected_sensor_values()));
  }
}

void SEMMeterComponent::publish_rejection_diagnostics_() {
  if (this->last_rejected_sensor_text_sensor_ != nullptr) {
    this->last_rejected_sensor_text_sensor_->publish_state(
        measurement_id_to_string(this->validator_.last_rejected_measurement()));
  }
  if (this->last_rejection_reason_text_sensor_ != nullptr) {
    this->last_rejection_reason_text_sensor_->publish_state(
        validation_failure_reason_to_string(this->validator_.last_rejection_reason()));
  }
  if (this->last_rejected_value_sensor_ != nullptr &&
      this->validator_.rejected_sensor_values() > 0) {
    this->last_rejected_value_sensor_->publish_state(this->validator_.last_rejected_value());
  }
  if (this->rejected_samples_sensor_ != nullptr) {
    this->rejected_samples_sensor_->publish_state(
        static_cast<float>(this->validator_.rejected_sensor_values()));
  }
}

void SEMMeterComponent::record_loop_time_(uint32_t loop_started_at) {
  this->diagnostics_.record_loop_time(micros() - loop_started_at);
}

uint32_t SEMMeterComponent::get_milliseconds_since_last_valid_frame() const {
  return this->health_.milliseconds_since_last_valid_frame(millis());
}

void SEMMeterComponent::on_partial_record(size_t offset) {
  ESP_LOGV(TAG, "Preserving partial record candidate at frame offset %zu", offset);
}

void SEMMeterComponent::on_malformed_candidate(size_t offset, uint8_t record_id, uint8_t status) {
  ESP_LOGV(TAG, "Ignoring malformed record candidate at offset %zu (id=0x%02X, status=0x%02X)", offset,
           record_id, status);
}

void SEMMeterComponent::on_decoded_record(size_t, uint8_t marker, uint8_t record_id, uint8_t status) {
  this->update_measurement_readiness_(record_id);
  ESP_LOGV(TAG, "Decoded record 0x%02X with marker 0x%02X and status 0x%02X", record_id, marker, status);
}

bool SEMMeterComponent::all_measurements_ready_(MeasurementId first, MeasurementId last) const {
  for (uint8_t raw = static_cast<uint8_t>(first); raw <= static_cast<uint8_t>(last); raw++) {
    if (!this->validator_.measurement_ready(static_cast<MeasurementId>(raw))) {
      return false;
    }
  }
  return true;
}

void SEMMeterComponent::update_measurement_readiness_(uint8_t record_id) {
  if (record_id <= LAST_BRANCH_RECORD_ID) {
    const auto measurement =
        static_cast<MeasurementId>(static_cast<uint8_t>(MeasurementId::CIRCUIT_1_POWER) +
                                   record_id);
    this->validator_.mark_measurement_ready(measurement);
  } else if (record_id == PHASE_A_RECORD_ID) {
    this->validator_.mark_measurement_ready(MeasurementId::MAIN_PHASE_A_POWER);
    if (this->accumulator_.parser().has_phase_a_voltage()) {
      this->validator_.mark_measurement_ready(MeasurementId::PHASE_A_VOLTAGE);
    }
    if (this->accumulator_.parser().has_line_frequency()) {
      this->validator_.mark_measurement_ready(MeasurementId::LINE_FREQUENCY);
    }
  } else if (record_id == PHASE_B_RECORD_ID) {
    this->validator_.mark_measurement_ready(MeasurementId::MAIN_PHASE_B_POWER);
    if (this->accumulator_.parser().has_phase_b_voltage()) {
      this->validator_.mark_measurement_ready(MeasurementId::PHASE_B_VOLTAGE);
    }
  } else if (record_id == PHASE_C_RECORD_ID) {
    this->validator_.mark_measurement_ready(MeasurementId::MAIN_PHASE_C_POWER);
  }

  if (this->all_measurements_ready_(MeasurementId::MAIN_PHASE_A_POWER,
                                    MeasurementId::MAIN_PHASE_C_POWER)) {
    this->validator_.mark_measurement_ready(MeasurementId::TOTAL_MAIN_POWER);
  }
  if (this->validator_.measurement_ready(MeasurementId::TOTAL_MAIN_POWER) &&
      this->all_measurements_ready_(MeasurementId::CIRCUIT_1_POWER,
                                    MeasurementId::CIRCUIT_16_POWER)) {
    this->validator_.mark_measurement_ready(MeasurementId::BALANCE_POWER);
  }
}

void SEMMeterComponent::dump_config() {
  ESP_LOGCONFIG(TAG, "SEM Meter:");
  ESP_LOGCONFIG(TAG, "  Complete frame size: %zu bytes", COMPLETE_FRAME_SIZE);
  ESP_LOGCONFIG(TAG, "  Maximum bytes per loop: %zu", MAX_BYTES_PER_LOOP);
  ESP_LOGCONFIG(TAG, "  Maximum frames per loop: %zu", MAX_FRAMES_PER_LOOP);
  ESP_LOGCONFIG(TAG, "  Receive buffer capacity: %zu bytes", MAX_BUFFER_SIZE);
  ESP_LOGCONFIG(TAG, "  UART valid-frame timeout: %" PRIu32 " ms", this->health_.uart_timeout_ms());
  ESP_LOGCONFIG(TAG, "  Record markers: 0x%02X, 0x%02X", MARKER_PRIMARY, MARKER_SECONDARY);
  ESP_LOGCONFIG(TAG, "  Branch power divisor: %.3f", this->accumulator_.parser().get_branch_power_divisor());
  ESP_LOGCONFIG(TAG, "  Main power divisor: %.3f", this->accumulator_.parser().get_main_power_divisor());
  ESP_LOGCONFIG(TAG, "  Voltage divisor: %.3f", this->accumulator_.parser().get_voltage_divisor());
  const ValidationConfiguration &validation = this->validator_.configuration();
  ESP_LOGCONFIG(TAG, "  Maximum voltage jump: %.1f V", validation.phase_voltage_maximum_delta);
  ESP_LOGCONFIG(TAG, "  Maximum frequency jump: %.1f Hz", validation.line_frequency_maximum_delta);
  ESP_LOGCONFIG(TAG, "  Maximum circuit-power jump: %.1f W",
                validation.circuit_power_maximum_delta);
  ESP_LOGCONFIG(TAG, "  Maximum main-phase-power jump: %.1f W",
                validation.main_phase_power_maximum_delta);
  ESP_LOGCONFIG(TAG, "  Maximum total/balance-power jump: %.1f W",
                validation.total_power_maximum_delta);
  this->check_uart_settings(115200, 1, uart::UART_CONFIG_PARITY_NONE, 8);
}

}  // namespace esphome::sem_meter
