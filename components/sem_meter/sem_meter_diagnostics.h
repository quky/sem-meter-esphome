#pragma once

#include <cstddef>
#include <cstdint>

namespace esphome::sem_meter {

enum class ComponentState {
  BOOTING,
  WAITING_FOR_UART,
  RECEIVING_DATA,
  DATA_TIMEOUT,
  RECOVERING,
};

enum class ComponentEvent {
  NONE,
  SYSTEM_STARTED,
  UART_STARTED,
  UART_TIMEOUT,
  UART_RESTORED,
  BUFFER_OVERFLOW,
  MALFORMED_FRAME,
  INVALID_SENSOR_VALUE,
};

inline const char *component_state_to_string(ComponentState state) {
  switch (state) {
    case ComponentState::BOOTING:
      return "BOOTING";
    case ComponentState::WAITING_FOR_UART:
      return "WAITING_FOR_UART";
    case ComponentState::RECEIVING_DATA:
      return "RECEIVING_DATA";
    case ComponentState::DATA_TIMEOUT:
      return "DATA_TIMEOUT";
    case ComponentState::RECOVERING:
      return "RECOVERING";
  }
  return "UNKNOWN";
}

inline const char *component_event_to_string(ComponentEvent event) {
  switch (event) {
    case ComponentEvent::NONE:
      return "NONE";
    case ComponentEvent::SYSTEM_STARTED:
      return "SYSTEM_STARTED";
    case ComponentEvent::UART_STARTED:
      return "UART_STARTED";
    case ComponentEvent::UART_TIMEOUT:
      return "UART_TIMEOUT";
    case ComponentEvent::UART_RESTORED:
      return "UART_RESTORED";
    case ComponentEvent::BUFFER_OVERFLOW:
      return "BUFFER_OVERFLOW";
    case ComponentEvent::MALFORMED_FRAME:
      return "MALFORMED_FRAME";
    case ComponentEvent::INVALID_SENSOR_VALUE:
      return "INVALID_SENSOR_VALUE";
  }
  return "UNKNOWN";
}

inline bool sem_meter_is_healthy(ComponentState state, bool uart_healthy) {
  return state == ComponentState::RECEIVING_DATA && uart_healthy;
}

inline constexpr uint32_t DEFAULT_UART_TIMEOUT_MS = 10000;
inline constexpr size_t MAX_EVENT_LISTENERS = 1;

class SEMMeterEventListener {
 public:
  virtual ~SEMMeterEventListener() = default;
  virtual void on_sem_meter_event(ComponentEvent event, uint32_t timestamp_ms) = 0;
};

class SEMMeterEventDispatcher {
 public:
  bool register_event_listener(SEMMeterEventListener *listener) {
    if (listener == nullptr || this->listener_ != nullptr) {
      return false;
    }
    this->listener_ = listener;
    return true;
  }

  bool dispatch(ComponentEvent event, uint32_t timestamp_ms) {
    if (event == ComponentEvent::NONE || this->dispatching_) {
      return false;
    }

    this->last_event_ = event;
    this->last_event_timestamp_ms_ = timestamp_ms;
    this->event_count_++;

    if (this->listener_ != nullptr) {
      this->dispatching_ = true;
      this->listener_->on_sem_meter_event(event, timestamp_ms);
      this->dispatching_ = false;
    }
    return true;
  }

  size_t listener_count() const { return this->listener_ != nullptr ? 1 : 0; }
  ComponentEvent last_event() const { return this->last_event_; }
  uint64_t event_count() const { return this->event_count_; }
  uint32_t last_event_timestamp_ms() const { return this->last_event_timestamp_ms_; }

 private:
  SEMMeterEventListener *listener_{nullptr};
  ComponentEvent last_event_{ComponentEvent::NONE};
  uint64_t event_count_{0};
  uint32_t last_event_timestamp_ms_{0};
  bool dispatching_{false};
};

struct SEMMeterHealthUpdate {
  ComponentState previous_state{ComponentState::BOOTING};
  ComponentState current_state{ComponentState::BOOTING};
  ComponentEvent event{ComponentEvent::NONE};
  uint32_t timestamp_ms{0};

  bool state_changed() const { return this->previous_state != this->current_state; }
};

class SEMMeterHealthTracker {
 public:
  explicit SEMMeterHealthTracker(uint32_t uart_timeout_ms = DEFAULT_UART_TIMEOUT_MS)
      : uart_timeout_ms_(uart_timeout_ms) {}

  SEMMeterHealthUpdate setup_completed(uint32_t timestamp_ms) {
    if (this->state_ != ComponentState::BOOTING) {
      return this->no_change_();
    }
    return this->transition_(ComponentState::WAITING_FOR_UART, ComponentEvent::SYSTEM_STARTED,
                             timestamp_ms);
  }

  SEMMeterHealthUpdate record_valid_frame(uint32_t timestamp_ms) {
    this->last_valid_frame_timestamp_ms_ = timestamp_ms;
    this->has_received_valid_frame_ = true;

    if (this->state_ == ComponentState::WAITING_FOR_UART ||
        this->state_ == ComponentState::BOOTING) {
      return this->transition_(ComponentState::RECEIVING_DATA, ComponentEvent::UART_STARTED,
                               timestamp_ms);
    }
    if (this->state_ == ComponentState::DATA_TIMEOUT) {
      return this->transition_(ComponentState::RECEIVING_DATA, ComponentEvent::UART_RESTORED,
                               timestamp_ms);
    }
    if (this->state_ == ComponentState::RECOVERING) {
      return this->transition_(ComponentState::RECEIVING_DATA, ComponentEvent::NONE, timestamp_ms);
    }
    return this->no_change_();
  }

  SEMMeterHealthUpdate check_timeout(uint32_t timestamp_ms) {
    if (this->state_ != ComponentState::RECEIVING_DATA || !this->has_received_valid_frame_) {
      return this->no_change_();
    }

    const uint32_t elapsed_ms = timestamp_ms - this->last_valid_frame_timestamp_ms_;
    if (elapsed_ms < this->uart_timeout_ms_) {
      return this->no_change_();
    }
    return this->transition_(ComponentState::DATA_TIMEOUT, ComponentEvent::UART_TIMEOUT,
                             timestamp_ms);
  }

  SEMMeterHealthUpdate record_buffer_overflow(uint32_t timestamp_ms) {
    return this->raise_event_(ComponentEvent::BUFFER_OVERFLOW, timestamp_ms);
  }

  SEMMeterHealthUpdate record_malformed_frame(uint32_t timestamp_ms) {
    return this->raise_event_(ComponentEvent::MALFORMED_FRAME, timestamp_ms);
  }

  void set_uart_timeout_ms(uint32_t uart_timeout_ms) { this->uart_timeout_ms_ = uart_timeout_ms; }

  ComponentState state() const { return this->state_; }
  uint32_t last_valid_frame_timestamp_ms() const { return this->last_valid_frame_timestamp_ms_; }
  uint32_t uart_timeout_ms() const { return this->uart_timeout_ms_; }
  bool uart_healthy() const {
    return this->has_received_valid_frame_ && this->state_ == ComponentState::RECEIVING_DATA;
  }
  bool sem_meter_healthy() const { return sem_meter_is_healthy(this->state_, this->uart_healthy()); }

  uint32_t milliseconds_since_last_valid_frame(uint32_t timestamp_ms) const {
    if (!this->has_received_valid_frame_) {
      return 0;
    }
    return timestamp_ms - this->last_valid_frame_timestamp_ms_;
  }

 private:
  SEMMeterHealthUpdate no_change_() const {
    return {this->state_, this->state_, ComponentEvent::NONE, 0};
  }

  SEMMeterHealthUpdate transition_(ComponentState new_state, ComponentEvent event,
                                   uint32_t timestamp_ms) {
    const ComponentState previous_state = this->state_;
    this->state_ = new_state;
    return {previous_state, this->state_, event, timestamp_ms};
  }

  SEMMeterHealthUpdate raise_event_(ComponentEvent event, uint32_t timestamp_ms) {
    return {this->state_, this->state_, event, timestamp_ms};
  }

  ComponentState state_{ComponentState::BOOTING};
  uint32_t last_valid_frame_timestamp_ms_{0};
  uint32_t uart_timeout_ms_{DEFAULT_UART_TIMEOUT_MS};
  bool has_received_valid_frame_{false};
};

struct TimingStatistics {
  uint32_t minimum_microseconds{0};
  uint32_t maximum_microseconds{0};
  uint64_t cumulative_microseconds{0};
  uint64_t sample_count{0};

  void add_sample(uint32_t elapsed_microseconds) {
    if (this->sample_count == 0 || elapsed_microseconds < this->minimum_microseconds) {
      this->minimum_microseconds = elapsed_microseconds;
    }
    if (elapsed_microseconds > this->maximum_microseconds) {
      this->maximum_microseconds = elapsed_microseconds;
    }
    this->cumulative_microseconds += elapsed_microseconds;
    this->sample_count++;
  }

  double average_microseconds() const {
    if (this->sample_count == 0) {
      return 0.0;
    }
    return static_cast<double>(this->cumulative_microseconds) / static_cast<double>(this->sample_count);
  }
};

struct SEMMeterDiagnosticCounters {
  uint64_t uart_bytes_received{0};
  uint64_t feed_calls{0};
  uint64_t frames_processed{0};
  uint64_t records_decoded{0};
  uint64_t idle_records{0};
  uint64_t partial_records{0};
  uint64_t malformed_record_candidates{0};
  uint64_t zero_valid_record_frames{0};
  uint64_t malformed_frames{0};
  uint64_t bytes_dropped{0};
  uint64_t buffer_recovery_events{0};
  uint64_t structural_cycle_rejections{0};
};

class SEMMeterDiagnostics {
 public:
  void record_feed_call(size_t received_bytes) {
    this->counters_.feed_calls++;
    this->counters_.uart_bytes_received += received_bytes;
  }

  void record_frame_processed(size_t decoded_records) {
    this->counters_.frames_processed++;
    if (decoded_records == 0) {
      this->counters_.zero_valid_record_frames++;
    }
  }

  void record_decoded_record(bool idle) {
    this->counters_.records_decoded++;
    if (idle) {
      this->counters_.idle_records++;
    }
  }

  void record_partial_record() { this->counters_.partial_records++; }
  void record_malformed_candidate() { this->counters_.malformed_record_candidates++; }

  void record_buffer_recovery(size_t bytes_dropped) {
    if (bytes_dropped == 0) {
      return;
    }
    this->counters_.bytes_dropped += bytes_dropped;
    this->counters_.buffer_recovery_events++;
  }

  void record_structural_cycle_rejection() {
    this->counters_.structural_cycle_rejections++;
  }

  void record_malformed_frame() { this->counters_.malformed_frames++; }

  void record_loop_time(uint32_t elapsed_microseconds) {
    this->loop_timing_.add_sample(elapsed_microseconds);
  }

  void record_accumulator_time(uint32_t elapsed_microseconds) {
    this->accumulator_timing_.add_sample(elapsed_microseconds);
  }

  const SEMMeterDiagnosticCounters &counters() const { return this->counters_; }
  const TimingStatistics &loop_timing() const { return this->loop_timing_; }
  const TimingStatistics &accumulator_timing() const { return this->accumulator_timing_; }

 private:
  SEMMeterDiagnosticCounters counters_{};
  TimingStatistics loop_timing_{};
  TimingStatistics accumulator_timing_{};
};

}  // namespace esphome::sem_meter
