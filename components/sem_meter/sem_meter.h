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
#include "sem_meter_foundation.h"
#include "sem_meter_report.h"
#include "sem_meter_validator.h"

namespace esphome::sem_meter {

inline constexpr uint32_t DIAGNOSTIC_PUBLISH_INTERVAL_MS = 5000;
inline constexpr uint32_t WATCHDOG_EVALUATION_INTERVAL_MS = 1000;

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
    this->cycle_validator_.set_phase_voltage_maximum_delta(maximum_delta);
  }
  void set_line_frequency_maximum_delta(float maximum_delta) {
    this->validator_.set_line_frequency_maximum_delta(maximum_delta);
    this->cycle_validator_.set_line_frequency_maximum_delta(maximum_delta);
  }
  void set_circuit_power_maximum_delta(float maximum_delta) {
    this->validator_.set_circuit_power_maximum_delta(maximum_delta);
    this->cycle_validator_.set_circuit_power_maximum_delta(maximum_delta);
  }
  void set_main_phase_power_maximum_delta(float maximum_delta) {
    this->validator_.set_main_phase_power_maximum_delta(maximum_delta);
    this->cycle_validator_.set_main_phase_power_maximum_delta(maximum_delta);
  }
  void set_total_power_maximum_delta(float maximum_delta) {
    this->validator_.set_total_power_maximum_delta(maximum_delta);
    this->cycle_validator_.set_total_power_maximum_delta(maximum_delta);
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
  void set_sem_parser_healthy_binary_sensor(binary_sensor::BinarySensor *sensor) {
    this->sem_parser_healthy_binary_sensor_ = sensor;
  }
  void set_sem_diagnostic_status_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_diagnostic_status_text_sensor_ = sensor;
  }
  void set_sem_last_valid_frame_age_sensor(sensor::Sensor *sensor) {
    this->sem_last_valid_frame_age_sensor_ = sensor;
  }
  void set_sem_last_parser_outage_duration_sensor(sensor::Sensor *sensor) {
    this->sem_last_parser_outage_duration_sensor_ = sensor;
  }
  void set_sem_wifi_healthy_binary_sensor(binary_sensor::BinarySensor *sensor) {
    this->sem_wifi_healthy_binary_sensor_ = sensor;
  }
  void set_sem_wifi_diagnostic_status_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_wifi_diagnostic_status_text_sensor_ = sensor;
  }
  void set_sem_last_wifi_outage_duration_sensor(sensor::Sensor *sensor) {
    this->sem_last_wifi_outage_duration_sensor_ = sensor;
  }
  void set_sem_wifi_disconnect_age_sensor(sensor::Sensor *sensor) {
    this->sem_wifi_disconnect_age_sensor_ = sensor;
  }
  void set_sem_self_test_status_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_self_test_status_text_sensor_ = sensor;
  }
  void set_sem_self_test_summary_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_self_test_summary_text_sensor_ = sensor;
  }
  void set_sem_self_test_failed_checks_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_self_test_failed_checks_text_sensor_ = sensor;
  }
  void set_sem_last_self_test_duration_sensor(sensor::Sensor *sensor) {
    this->sem_last_self_test_duration_sensor_ = sensor;
  }
  void set_sem_component_version_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_component_version_text_sensor_ = sensor;
  }
  void set_sem_esphome_version_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_esphome_version_text_sensor_ = sensor;
  }
  void set_sem_hardware_profile_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_hardware_profile_text_sensor_ = sensor;
  }
  void set_sem_board_variant_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_board_variant_text_sensor_ = sensor;
  }
  void set_sem_last_reset_reason_text_sensor(text_sensor::TextSensor *sensor) {
    this->sem_last_reset_reason_text_sensor_ = sensor;
  }
  void set_sem_parser_fault_count_sensor(sensor::Sensor *sensor) {
    this->sem_parser_fault_count_sensor_ = sensor;
  }
  void set_sem_wifi_fault_count_sensor(sensor::Sensor *sensor) {
    this->sem_wifi_fault_count_sensor_ = sensor;
  }
  void set_sem_self_test_run_count_sensor(sensor::Sensor *sensor) {
    this->sem_self_test_run_count_sensor_ = sensor;
  }
  void set_sem_self_test_failure_count_sensor(sensor::Sensor *sensor) {
    this->sem_self_test_failure_count_sensor_ = sensor;
  }
  void set_sem_diagnostic_report_part_1_text_sensor(
      text_sensor::TextSensor *sensor) {
    this->sem_diagnostic_report_part_text_sensors_[0] = sensor;
  }
  void set_sem_diagnostic_report_part_2_text_sensor(
      text_sensor::TextSensor *sensor) {
    this->sem_diagnostic_report_part_text_sensors_[1] = sensor;
  }
  void set_sem_diagnostic_report_part_3_text_sensor(
      text_sensor::TextSensor *sensor) {
    this->sem_diagnostic_report_part_text_sensors_[2] = sensor;
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
  void set_startup_grace_period_ms(uint32_t grace_period_ms) {
    this->health_.set_startup_grace_period_ms(grace_period_ms);
  }
  uint32_t get_startup_grace_period_ms() const {
    return this->health_.startup_grace_period_ms();
  }
  bool has_received_valid_frame() const { return this->health_.has_received_valid_frame(); }
  bool get_parser_watchdog_failed() const { return this->health_.watchdog_failed(); }
  uint32_t get_current_outage_started_timestamp_ms() const {
    return this->health_.current_outage_started_timestamp_ms();
  }
  uint32_t get_last_completed_outage_duration_ms() const {
    return this->health_.last_completed_outage_duration_ms();
  }
  void set_parser_timeout_simulation(bool enabled);
  bool get_parser_timeout_simulation() const {
    return this->watchdog_gate_.timeout_simulation_enabled();
  }
  void set_wifi_connected(bool connected);
  void set_wifi_timeout_simulation(bool enabled);
  bool get_wifi_timeout_simulation() const {
    return this->wifi_health_.timeout_simulation_enabled();
  }
  void set_wifi_startup_grace_period_ms(uint32_t grace_period_ms) {
    this->wifi_health_.set_startup_grace_period_ms(grace_period_ms);
  }
  void set_wifi_outage_threshold_ms(uint32_t threshold_ms) {
    this->wifi_health_.set_outage_threshold_ms(threshold_ms);
  }
  void run_self_test();
  void generate_diagnostic_report();
  SelfTestStatus get_self_test_status() const { return this->self_test_.status(); }
  uint8_t get_self_test_failed_checks() const {
    return this->self_test_.failed_checks();
  }
  uint32_t get_last_self_test_duration_ms() const {
    return this->self_test_.last_duration_ms();
  }
  const SEMMeterRuntimeCounterValues &get_runtime_counter_values() const {
    return this->runtime_counters_.values();
  }
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
  uint64_t get_malformed_frames() const {
    return this->diagnostics_.counters().malformed_frames;
  }
  uint64_t get_structural_cycle_rejections() const {
    return this->diagnostics_.counters().structural_cycle_rejections;
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
  void publish_immediate_diagnostics_(ComponentEvent transition_event = ComponentEvent::NONE);
  void publish_rejection_diagnostics_();
  void evaluate_watchdog_(uint32_t timestamp_ms);
  void evaluate_wifi_watchdog_(uint32_t timestamp_ms);
  void apply_wifi_health_update_(const WiFiHealthUpdate &update);
  void publish_wifi_immediate_diagnostics_(ComponentEvent transition_event);
  void evaluate_self_test_(uint32_t timestamp_ms);
  void apply_self_test_update_(const SelfTestUpdate &update);
  void publish_self_test_diagnostics_(bool publish_duration);
  SelfTestInputs collect_self_test_inputs_(uint32_t timestamp_ms) const;
  bool internal_diagnostic_state_consistent_() const;
  DiagnosticReportSnapshot collect_diagnostic_report_snapshot_() const;
  void publish_startup_identity_();
  void publish_runtime_counters_(uint8_t changed_counters);
  const char *diagnostic_status_(ComponentEvent transition_event) const;
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
  SEMMeterWatchdogGate watchdog_gate_{};
  SEMMeterWiFiHealthTracker wifi_health_{};
  SEMMeterSelfTest self_test_{};
  SEMMeterRuntimeCounters runtime_counters_{};
  SEMMeterDiagnosticReportGenerator report_generator_{};
  SEMMeterEventDispatcher event_dispatcher_{};
  SEMMeterValidator validator_{};
  SEMMeterValidator cycle_validator_{};
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
  binary_sensor::BinarySensor *sem_parser_healthy_binary_sensor_{nullptr};
  text_sensor::TextSensor *sem_diagnostic_status_text_sensor_{nullptr};
  sensor::Sensor *sem_last_valid_frame_age_sensor_{nullptr};
  sensor::Sensor *sem_last_parser_outage_duration_sensor_{nullptr};
  binary_sensor::BinarySensor *sem_wifi_healthy_binary_sensor_{nullptr};
  text_sensor::TextSensor *sem_wifi_diagnostic_status_text_sensor_{nullptr};
  sensor::Sensor *sem_last_wifi_outage_duration_sensor_{nullptr};
  sensor::Sensor *sem_wifi_disconnect_age_sensor_{nullptr};
  text_sensor::TextSensor *sem_self_test_status_text_sensor_{nullptr};
  text_sensor::TextSensor *sem_self_test_summary_text_sensor_{nullptr};
  text_sensor::TextSensor *sem_self_test_failed_checks_text_sensor_{nullptr};
  sensor::Sensor *sem_last_self_test_duration_sensor_{nullptr};
  text_sensor::TextSensor *sem_component_version_text_sensor_{nullptr};
  text_sensor::TextSensor *sem_esphome_version_text_sensor_{nullptr};
  text_sensor::TextSensor *sem_hardware_profile_text_sensor_{nullptr};
  text_sensor::TextSensor *sem_board_variant_text_sensor_{nullptr};
  text_sensor::TextSensor *sem_last_reset_reason_text_sensor_{nullptr};
  sensor::Sensor *sem_parser_fault_count_sensor_{nullptr};
  sensor::Sensor *sem_wifi_fault_count_sensor_{nullptr};
  sensor::Sensor *sem_self_test_run_count_sensor_{nullptr};
  sensor::Sensor *sem_self_test_failure_count_sensor_{nullptr};
  std::array<text_sensor::TextSensor *, DIAGNOSTIC_REPORT_PART_COUNT>
      sem_diagnostic_report_part_text_sensors_{};
  SEMResetReason reset_reason_{SEMResetReason::UNKNOWN};
  uint32_t last_diagnostic_publish_ms_{0};
  uint32_t last_watchdog_evaluation_ms_{0};
  uint32_t last_wifi_watchdog_evaluation_ms_{0};
  uint32_t recovered_status_timestamp_ms_{0};
  bool recovered_status_active_{false};
  bool waiting_status_published_{false};
};

}  // namespace esphome::sem_meter
