#include "sem_meter.h"

#include <algorithm>
#include <array>

#include "esphome/core/log.h"

namespace esphome::sem_meter {

static const char *const TAG = "sem_meter";

void SEMMeterComponent::setup() {
  ESP_LOGI(TAG, "SEM Meter parser started");
}

void SEMMeterComponent::loop() {
  // Hard scheduler budget: perform at most one UART read totaling no more than
  // MAX_BYTES_PER_LOOP, then decode at most MAX_FRAMES_PER_LOOP frame.
  std::array<uint8_t, MAX_BYTES_PER_LOOP> incoming;
  const size_t available_bytes = this->available();
  const size_t bytes_to_read = std::min(available_bytes, MAX_BYTES_PER_LOOP);
  if (bytes_to_read > 0) {
    if (!this->read_array(incoming.data(), bytes_to_read)) {
      ESP_LOGW(TAG, "UART read failed; preserving %zu buffered bytes", this->accumulator_.buffered_size());
      return;
    }
  }

  const SEMMeterFeedResult result = this->accumulator_.feed(incoming.data(), bytes_to_read, this);
  if (result.bytes_dropped > 0) {
    ESP_LOGW(TAG, "Receive buffer overflow; dropping %zu old bytes to recover", result.bytes_dropped);
  }
  if (result.frames_processed > 0 && result.decoded_records == 0) {
    ESP_LOGW(TAG, "Malformed or out-of-sync 447-byte frame contained no valid records");
  }
  if (result.frames_processed >= MAX_FRAMES_PER_LOOP) {
    return;
  }
}

void SEMMeterComponent::on_partial_record(size_t offset) {
  ESP_LOGV(TAG, "Preserving partial record candidate at frame offset %zu", offset);
}

void SEMMeterComponent::on_malformed_candidate(size_t offset, uint8_t record_id, uint8_t status) {
  ESP_LOGV(TAG, "Ignoring malformed record candidate at offset %zu (id=0x%02X, status=0x%02X)", offset,
           record_id, status);
}

void SEMMeterComponent::on_decoded_record(size_t, uint8_t marker, uint8_t record_id, uint8_t status) {
  ESP_LOGV(TAG, "Decoded record 0x%02X with marker 0x%02X and status 0x%02X", record_id, marker, status);
}

void SEMMeterComponent::dump_config() {
  ESP_LOGCONFIG(TAG, "SEM Meter:");
  ESP_LOGCONFIG(TAG, "  Complete frame size: %zu bytes", COMPLETE_FRAME_SIZE);
  ESP_LOGCONFIG(TAG, "  Maximum bytes per loop: %zu", MAX_BYTES_PER_LOOP);
  ESP_LOGCONFIG(TAG, "  Maximum frames per loop: %zu", MAX_FRAMES_PER_LOOP);
  ESP_LOGCONFIG(TAG, "  Receive buffer capacity: %zu bytes", MAX_BUFFER_SIZE);
  ESP_LOGCONFIG(TAG, "  Record markers: 0x%02X, 0x%02X", MARKER_PRIMARY, MARKER_SECONDARY);
  ESP_LOGCONFIG(TAG, "  Branch power divisor: %.3f", this->accumulator_.parser().get_branch_power_divisor());
  ESP_LOGCONFIG(TAG, "  Main power divisor: %.3f", this->accumulator_.parser().get_main_power_divisor());
  ESP_LOGCONFIG(TAG, "  Voltage divisor: %.3f", this->accumulator_.parser().get_voltage_divisor());
  this->check_uart_settings(115200, 1, uart::UART_CONFIG_PARITY_NONE, 8);
}

}  // namespace esphome::sem_meter
