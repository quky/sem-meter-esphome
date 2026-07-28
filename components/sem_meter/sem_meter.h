#pragma once

#include <cstddef>
#include <cstdint>

#include "esphome/components/binary_sensor/binary_sensor.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/text_sensor/text_sensor.h"
#include "esphome/components/uart/uart.h"
#include "esphome/core/component.h"
#include "esphome/core/helpers.h"
#include "sem_meter_accumulator.h"
#include "sem_meter_validator.h"

namespace esphome::sem_meter {

inline constexpr uint32_t DIAGNOSTIC_PUBLISH_INTERVAL_MS = 5000;

class SEMMeterComponent final : public Component,
                                public uart::UARTDevice,
                                protected SEMMeterAccumulatorObserver {
 public:
  void setup() override;
  void loop() override;
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::DATA; }

  void set_branch_power_divisor(float divisor) { this->accumulator_.parser().set_branch_power_divisor(divisor); }
  void set_main_power_divisor(float divisor) { this->accumulator_.parser().set_main_power_divisor(divisor); }
  void set_voltage_divisor(float divisor) { this->accumulator_.parser().set_voltage_divisor(divisor); }
  void set_phase_voltage_maximum_delta(float maximum_delta) {
    this->validator_.set_phase_voltage_maximum_delta(maximum_delta);
  }
  void set_line_frequency_maximum_delta(float maximum_delta) {
    this->validator_.set_line_frequency_maximum_delta(maximum_delta);
  }
  void set_circuit_power_maximum_delta(float maximum_delta) {
    this->validator_.set_circuit_power_maximum_delta(maximum_delta);
  }
  void set_main_phase_power_maximum_delta(float maximum_delta) {
    this->validator_.set_main_phase_power_maximum_delta(maximum_delta);
  }
  void set_total_power_maximum_delta(float maximum_delta) {
    this->validator_.set_total_power_maximum_delta(maximum_delta);
  }
  void set_sem_meter_healthy_binary_sensor(binary_sensor::BinarySensor *sensor) {
    this->sem_meter_healthy_binary_sensor_ = sensor;
  }
  void set_uart_healthy_binary_sensor(binary_sensor::BinarySensor *sensor) {
    this->uart_healthy_binary_sensor_ = sensor;
  }
  void set_component_state_text_sensor(text_sensor::TextSensor *sensor) {
    this->component_state_text_sensor_ = sensor;
  }
  void set_last_event_text_sensor(text_sensor::TextSensor *sensor) {
    this->last_event_text_sensor_ = sensor;
  }
  void set_milliseconds_since_last_frame_sensor(sensor::Sensor *sensor) {
    this->milliseconds_since_last_frame_sensor_ = sensor;
  }
  void set_frames_processed_sensor(sensor::Sensor *sensor) { this->frames_processed_sensor_ = sensor; }
  void set_malformed_frames_sensor(sensor::Sensor *sensor) { this->malformed_frames_sensor_ = sensor; }
  void set_buffer_recoveries_sensor(sensor::Sensor *sensor) { this->buffer_recoveries_sensor_ = sensor; }
  void set_event_count_sensor(sensor::Sensor *sensor) { this->event_count_sensor_ = sensor; }
  void set_last_rejected_sensor_text_sensor(text_sensor::TextSensor *sensor) {
    this->last_rejected_sensor_text_sensor_ = sensor;
  }
  void set_last_rejection_reason_text_sensor(text_sensor::TextSensor *sensor) {
    this->last_rejection_reason_text_sensor_ = sensor;
  }
  void set_last_rejected_value_sensor(sensor::Sensor *sensor) {
    this->last_rejected_value_sensor_ = sensor;
  }
  void set_rejected_samples_sensor(sensor::Sensor *sensor) {
    this->rejected_samples_sensor_ = sensor;
  }

  float get_branch_power(size_t index) const { return this->accumulator_.parser().get_branch_power(index); }
  float get_phase_a_power() const { return this->accumulator_.parser().get_phase_a_power(); }
  float get_phase_b_power() const { return this->accumulator_.parser().get_phase_b_power(); }
  float get_phase_c_power() const { return this->accumulator_.parser().get_phase_c_power(); }
  float get_phase_a_voltage() const { return this->accumulator_.parser().get_phase_a_voltage(); }
  float get_phase_b_voltage() const { return this->accumulator_.parser().get_phase_b_voltage(); }
  float get_line_frequency() const { return this->accumulator_.parser().get_line_frequency(); }
  optional<float> validate_sensor_value(MeasurementId measurement, float value);

  bool register_event_listener(SEMMeterEventListener *listener) {
    return this->event_dispatcher_.register_event_listener(listener);
  }

  ComponentState get_component_state() const { return this->health_.state(); }
  size_t get_event_listener_count() const { return this->event_dispatcher_.listener_count(); }
  ComponentEvent get_last_event() const { return this->event_dispatcher_.last_event(); }
  uint64_t get_event_count() const { return this->event_dispatcher_.event_count(); }
  uint32_t get_last_event_timestamp_ms() const {
    return this->event_dispatcher_.last_event_timestamp_ms();
  }
  uint32_t get_milliseconds_since_last_valid_frame() const;
  bool get_sem_meter_healthy() const { return this->health_.sem_meter_healthy(); }
  bool get_uart_healthy() const { return this->health_.uart_healthy(); }
  uint32_t get_last_valid_frame_timestamp_ms() const {
    return this->health_.last_valid_frame_timestamp_ms();
  }
  void set_uart_timeout_ms(uint32_t timeout_ms) { this->health_.set_uart_timeout_ms(timeout_ms); }
  uint32_t get_uart_timeout_ms() const { return this->health_.uart_timeout_ms(); }
  uint64_t get_rejected_sensor_values() const {
    return this->validator_.rejected_sensor_values();
  }
  bool has_rejected_sensor_value() const {
    return this->validator_.has_rejected_sensor_value();
  }
  float get_last_rejected_value() const { return this->validator_.last_rejected_value(); }
  MeasurementId get_last_rejected_measurement() const {
    return this->validator_.last_rejected_measurement();
  }
  ValidationFailureReason get_last_rejection_reason() const {
    return this->validator_.last_rejection_reason();
  }
  uint32_t get_last_rejection_timestamp_ms() const {
    return this->validator_.last_rejection_timestamp_ms();
  }

  const SEMMeterDiagnostics &get_diagnostics() const { return this->diagnostics_; }
  uint64_t get_uart_bytes_received() const { return this->diagnostics_.counters().uart_bytes_received; }
  uint64_t get_feed_calls() const { return this->diagnostics_.counters().feed_calls; }
  uint64_t get_frames_processed() const { return this->diagnostics_.counters().frames_processed; }
  uint64_t get_records_decoded() const { return this->diagnostics_.counters().records_decoded; }
  uint64_t get_idle_records() const { return this->diagnostics_.counters().idle_records; }
  uint64_t get_partial_records() const { return this->diagnostics_.counters().partial_records; }
  uint64_t get_malformed_record_candidates() const {
    return this->diagnostics_.counters().malformed_record_candidates;
  }
  uint64_t get_zero_valid_record_frames() const {
    return this->diagnostics_.counters().zero_valid_record_frames;
  }
  uint64_t get_bytes_dropped() const { return this->diagnostics_.counters().bytes_dropped; }
  uint64_t get_buffer_recovery_events() const {
    return this->diagnostics_.counters().buffer_recovery_events;
  }
  const TimingStatistics &get_loop_timing() const { return this->diagnostics_.loop_timing(); }
  const TimingStatistics &get_accumulator_timing() const {
    return this->diagnostics_.accumulator_timing();
  }

 protected:
  void apply_health_update_(const SEMMeterHealthUpdate &update);
  bool dispatch_event_(ComponentEvent event, uint32_t timestamp_ms);
  void publish_immediate_diagnostics_();
  void publish_rejection_diagnostics_();
  void update_measurement_readiness_(uint8_t record_id);
  bool all_measurements_ready_(MeasurementId first, MeasurementId last) const;
  void publish_periodic_diagnostics_(uint32_t timestamp_ms);
  void record_loop_time_(uint32_t loop_started_at);
  void on_partial_record(size_t offset) override;
  void on_malformed_candidate(size_t offset, uint8_t record_id, uint8_t status) override;
  void on_decoded_record(size_t offset, uint8_t marker, uint8_t record_id, uint8_t status) override;

  SEMMeterFrameAccumulator accumulator_{};
  SEMMeterDiagnostics diagnostics_{};
  SEMMeterHealthTracker health_{};
  SEMMeterEventDispatcher event_dispatcher_{};
  SEMMeterValidator validator_{};
  binary_sensor::BinarySensor *sem_meter_healthy_binary_sensor_{nullptr};
  binary_sensor::BinarySensor *uart_healthy_binary_sensor_{nullptr};
  text_sensor::TextSensor *component_state_text_sensor_{nullptr};
  text_sensor::TextSensor *last_event_text_sensor_{nullptr};
  sensor::Sensor *milliseconds_since_last_frame_sensor_{nullptr};
  sensor::Sensor *frames_processed_sensor_{nullptr};
  sensor::Sensor *malformed_frames_sensor_{nullptr};
  sensor::Sensor *buffer_recoveries_sensor_{nullptr};
  sensor::Sensor *event_count_sensor_{nullptr};
  text_sensor::TextSensor *last_rejected_sensor_text_sensor_{nullptr};
  text_sensor::TextSensor *last_rejection_reason_text_sensor_{nullptr};
  sensor::Sensor *last_rejected_value_sensor_{nullptr};
  sensor::Sensor *rejected_samples_sensor_{nullptr};
  uint32_t last_diagnostic_publish_ms_{0};
};

}  // namespace esphome::sem_meter
