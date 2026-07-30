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
  WIFI_TIMEOUT,
  WIFI_RESTORED,
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
    case ComponentEvent::WIFI_TIMEOUT:
      return "WIFI_TIMEOUT";
    case ComponentEvent::WIFI_RESTORED:
      return "WIFI_RESTORED";
  }
  return "UNKNOWN";
}

inline bool sem_meter_is_healthy(ComponentState state, bool uart_healthy) {
  return state == ComponentState::RECEIVING_DATA && uart_healthy;
}

inline constexpr uint32_t DEFAULT_UART_TIMEOUT_MS = 10000;
inline constexpr uint32_t DEFAULT_STARTUP_GRACE_PERIOD_MS = 30000;
inline constexpr uint32_t DEFAULT_WIFI_STARTUP_GRACE_PERIOD_MS = 180000;
inline constexpr uint32_t DEFAULT_WIFI_OUTAGE_THRESHOLD_MS = 120000;
inline constexpr uint32_t WIFI_RECOVERED_STATUS_DURATION_MS = 5000;
inline constexpr uint32_t SELF_TEST_DURATION_MS = 2000;
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
  explicit SEMMeterHealthTracker(
      uint32_t uart_timeout_ms = DEFAULT_UART_TIMEOUT_MS,
      uint32_t startup_grace_period_ms = DEFAULT_STARTUP_GRACE_PERIOD_MS)
      : uart_timeout_ms_(uart_timeout_ms),
        startup_grace_period_ms_(startup_grace_period_ms) {}

  SEMMeterHealthUpdate setup_completed(uint32_t timestamp_ms) {
    if (this->state_ != ComponentState::BOOTING) {
      return this->no_change_();
    }
    this->setup_timestamp_ms_ = timestamp_ms;
    this->setup_completed_ = true;
    return this->transition_(ComponentState::WAITING_FOR_UART, ComponentEvent::SYSTEM_STARTED,
                             timestamp_ms);
  }

  SEMMeterHealthUpdate record_valid_frame(uint32_t timestamp_ms) {
    const bool recovering_from_timeout = this->state_ == ComponentState::DATA_TIMEOUT;
    if (recovering_from_timeout) {
      this->last_completed_outage_duration_ms_ =
          timestamp_ms - this->current_outage_started_timestamp_ms_;
      this->has_completed_outage_ = true;
    }

    this->last_valid_frame_timestamp_ms_ = timestamp_ms;
    this->has_received_valid_frame_ = true;

    if (this->state_ == ComponentState::WAITING_FOR_UART ||
        this->state_ == ComponentState::BOOTING) {
      return this->transition_(ComponentState::RECEIVING_DATA, ComponentEvent::UART_STARTED,
                               timestamp_ms);
    }
    if (recovering_from_timeout) {
      return this->transition_(ComponentState::RECEIVING_DATA, ComponentEvent::UART_RESTORED,
                               timestamp_ms);
    }
    if (this->state_ == ComponentState::RECOVERING) {
      return this->transition_(ComponentState::RECEIVING_DATA, ComponentEvent::NONE, timestamp_ms);
    }
    return this->no_change_();
  }

  SEMMeterHealthUpdate check_timeout(uint32_t timestamp_ms) {
    if (this->state_ == ComponentState::WAITING_FOR_UART && this->setup_completed_ &&
        !this->has_received_valid_frame_) {
      const uint32_t startup_elapsed_ms = timestamp_ms - this->setup_timestamp_ms_;
      if (startup_elapsed_ms < this->startup_grace_period_ms_) {
        return this->no_change_();
      }
      this->current_outage_started_timestamp_ms_ = timestamp_ms;
      return this->transition_(ComponentState::DATA_TIMEOUT, ComponentEvent::UART_TIMEOUT,
                               timestamp_ms);
    }

    if (this->state_ != ComponentState::RECEIVING_DATA || !this->has_received_valid_frame_) {
      return this->no_change_();
    }

    const uint32_t elapsed_ms = timestamp_ms - this->last_valid_frame_timestamp_ms_;
    if (elapsed_ms < this->uart_timeout_ms_) {
      return this->no_change_();
    }
    this->current_outage_started_timestamp_ms_ = this->last_valid_frame_timestamp_ms_;
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
  void set_startup_grace_period_ms(uint32_t startup_grace_period_ms) {
    this->startup_grace_period_ms_ = startup_grace_period_ms;
  }

  ComponentState state() const { return this->state_; }
  uint32_t last_valid_frame_timestamp_ms() const { return this->last_valid_frame_timestamp_ms_; }
  uint32_t uart_timeout_ms() const { return this->uart_timeout_ms_; }
  uint32_t startup_grace_period_ms() const { return this->startup_grace_period_ms_; }
  uint32_t current_outage_started_timestamp_ms() const {
    return this->current_outage_started_timestamp_ms_;
  }
  uint32_t last_completed_outage_duration_ms() const {
    return this->last_completed_outage_duration_ms_;
  }
  bool has_received_valid_frame() const { return this->has_received_valid_frame_; }
  bool watchdog_failed() const { return this->state_ == ComponentState::DATA_TIMEOUT; }
  bool has_completed_outage() const { return this->has_completed_outage_; }
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
  uint32_t setup_timestamp_ms_{0};
  uint32_t last_valid_frame_timestamp_ms_{0};
  uint32_t current_outage_started_timestamp_ms_{0};
  uint32_t last_completed_outage_duration_ms_{0};
  uint32_t uart_timeout_ms_{DEFAULT_UART_TIMEOUT_MS};
  uint32_t startup_grace_period_ms_{DEFAULT_STARTUP_GRACE_PERIOD_MS};
  bool setup_completed_{false};
  bool has_received_valid_frame_{false};
  bool has_completed_outage_{false};
};

class SEMMeterWatchdogGate {
 public:
  bool set_timeout_simulation_enabled(bool enabled) {
    if (this->timeout_simulation_enabled_ == enabled) {
      return false;
    }
    this->timeout_simulation_enabled_ = enabled;
    return true;
  }

  bool timeout_simulation_enabled() const {
    return this->timeout_simulation_enabled_;
  }

  SEMMeterHealthUpdate record_accepted_frame(SEMMeterHealthTracker &health,
                                              uint32_t timestamp_ms) const {
    if (this->timeout_simulation_enabled_) {
      return {health.state(), health.state(), ComponentEvent::NONE, 0};
    }
    return health.record_valid_frame(timestamp_ms);
  }

 private:
  bool timeout_simulation_enabled_{false};
};

enum class WiFiDiagnosticState {
  STARTING,
  WAITING_FOR_WIFI,
  CONNECTED,
  DISCONNECTED_PENDING,
  WIFI_TIMEOUT,
  RECOVERED,
};

inline const char *wifi_diagnostic_state_to_string(WiFiDiagnosticState state) {
  switch (state) {
    case WiFiDiagnosticState::STARTING:
      return "STARTING";
    case WiFiDiagnosticState::WAITING_FOR_WIFI:
      return "WAITING_FOR_WIFI";
    case WiFiDiagnosticState::CONNECTED:
      return "CONNECTED";
    case WiFiDiagnosticState::DISCONNECTED_PENDING:
      return "DISCONNECTED_PENDING";
    case WiFiDiagnosticState::WIFI_TIMEOUT:
      return "WIFI_TIMEOUT";
    case WiFiDiagnosticState::RECOVERED:
      return "RECOVERED";
  }
  return "UNKNOWN";
}

struct WiFiHealthUpdate {
  WiFiDiagnosticState previous_state{WiFiDiagnosticState::STARTING};
  WiFiDiagnosticState current_state{WiFiDiagnosticState::STARTING};
  ComponentEvent event{ComponentEvent::NONE};
  uint32_t timestamp_ms{0};

  bool state_changed() const { return this->previous_state != this->current_state; }
};

class SEMMeterWiFiHealthTracker {
 public:
  explicit SEMMeterWiFiHealthTracker(
      uint32_t startup_grace_period_ms = DEFAULT_WIFI_STARTUP_GRACE_PERIOD_MS,
      uint32_t outage_threshold_ms = DEFAULT_WIFI_OUTAGE_THRESHOLD_MS)
      : startup_grace_period_ms_(startup_grace_period_ms),
        outage_threshold_ms_(outage_threshold_ms) {}

  WiFiHealthUpdate setup_completed(uint32_t timestamp_ms) {
    if (this->setup_completed_) {
      return this->no_change_();
    }
    this->setup_completed_ = true;
    this->setup_timestamp_ms_ = timestamp_ms;
    this->disconnect_started_timestamp_ms_ = timestamp_ms;
    return this->no_change_();
  }

  WiFiHealthUpdate set_real_connected(bool connected, uint32_t timestamp_ms) {
    if (this->real_connected_ == connected) {
      return this->no_change_();
    }

    const bool was_effectively_connected = this->effective_connected_();
    this->real_connected_ = connected;
    if (connected) {
      this->has_connected_once_ = true;
    }
    const bool is_effectively_connected = this->effective_connected_();

    if (was_effectively_connected == is_effectively_connected) {
      return this->no_change_();
    }
    return is_effectively_connected ? this->record_effective_connection_(timestamp_ms)
                                    : this->record_effective_disconnection_(timestamp_ms);
  }

  WiFiHealthUpdate set_timeout_simulation_enabled(bool enabled,
                                                   uint32_t timestamp_ms) {
    if (this->timeout_simulation_enabled_ == enabled) {
      return this->no_change_();
    }

    const bool was_effectively_connected = this->effective_connected_();
    this->timeout_simulation_enabled_ = enabled;
    const bool is_effectively_connected = this->effective_connected_();

    if (was_effectively_connected == is_effectively_connected) {
      return this->no_change_();
    }
    return is_effectively_connected ? this->record_effective_connection_(timestamp_ms)
                                    : this->record_effective_disconnection_(timestamp_ms);
  }

  WiFiHealthUpdate evaluate(uint32_t timestamp_ms) {
    if (this->effective_connected_()) {
      if (this->state_ == WiFiDiagnosticState::RECOVERED &&
          timestamp_ms - this->recovered_timestamp_ms_ >=
              WIFI_RECOVERED_STATUS_DURATION_MS) {
        return this->transition_(WiFiDiagnosticState::CONNECTED,
                                 ComponentEvent::NONE, timestamp_ms);
      }
      return this->no_change_();
    }

    if (!this->setup_completed_ || this->outage_declared_) {
      return this->no_change_();
    }

    if (!this->has_connected_once_) {
      const uint32_t elapsed_ms = timestamp_ms - this->setup_timestamp_ms_;
      if (elapsed_ms < this->startup_grace_period_ms_) {
        if (this->state_ == WiFiDiagnosticState::STARTING) {
          return this->transition_(WiFiDiagnosticState::WAITING_FOR_WIFI,
                                   ComponentEvent::NONE, timestamp_ms);
        }
        return this->no_change_();
      }
    } else {
      const uint32_t elapsed_ms =
          timestamp_ms - this->disconnect_started_timestamp_ms_;
      if (elapsed_ms < this->outage_threshold_ms_) {
        return this->no_change_();
      }
    }

    this->outage_declared_ = true;
    return this->transition_(WiFiDiagnosticState::WIFI_TIMEOUT,
                             ComponentEvent::WIFI_TIMEOUT, timestamp_ms);
  }

  WiFiDiagnosticState state() const { return this->state_; }
  bool real_connected() const { return this->real_connected_; }
  bool effective_connected() const { return this->effective_connected_(); }
  bool has_connected_once() const { return this->has_connected_once_; }
  bool outage_declared() const { return this->outage_declared_; }
  bool healthy() const {
    return this->has_connected_once_ && !this->outage_declared_;
  }
  bool timeout_simulation_enabled() const {
    return this->timeout_simulation_enabled_;
  }
  bool has_completed_outage() const { return this->has_completed_outage_; }
  uint32_t disconnect_started_timestamp_ms() const {
    return this->disconnect_started_timestamp_ms_;
  }
  uint32_t last_completed_outage_duration_ms() const {
    return this->last_completed_outage_duration_ms_;
  }
  uint32_t disconnect_age_ms(uint32_t timestamp_ms) const {
    if (this->effective_connected_()) {
      return 0;
    }
    return timestamp_ms - this->disconnect_started_timestamp_ms_;
  }
  uint32_t startup_grace_period_ms() const {
    return this->startup_grace_period_ms_;
  }
  uint32_t outage_threshold_ms() const { return this->outage_threshold_ms_; }
  void set_startup_grace_period_ms(uint32_t grace_period_ms) {
    this->startup_grace_period_ms_ = grace_period_ms;
  }
  void set_outage_threshold_ms(uint32_t threshold_ms) {
    this->outage_threshold_ms_ = threshold_ms;
  }

 private:
  bool effective_connected_() const {
    return this->real_connected_ && !this->timeout_simulation_enabled_;
  }

  WiFiHealthUpdate record_effective_disconnection_(uint32_t timestamp_ms) {
    this->disconnect_started_timestamp_ms_ = timestamp_ms;
    this->outage_declared_ = false;
    return this->transition_(WiFiDiagnosticState::DISCONNECTED_PENDING,
                             ComponentEvent::NONE, timestamp_ms);
  }

  WiFiHealthUpdate record_effective_connection_(uint32_t timestamp_ms) {
    if (this->outage_declared_) {
      this->last_completed_outage_duration_ms_ =
          timestamp_ms - this->disconnect_started_timestamp_ms_;
      this->has_completed_outage_ = true;
      this->outage_declared_ = false;
      this->recovered_timestamp_ms_ = timestamp_ms;
      return this->transition_(WiFiDiagnosticState::RECOVERED,
                               ComponentEvent::WIFI_RESTORED, timestamp_ms);
    }

    this->outage_declared_ = false;
    return this->transition_(WiFiDiagnosticState::CONNECTED,
                             ComponentEvent::NONE, timestamp_ms);
  }

  WiFiHealthUpdate no_change_() const {
    return {this->state_, this->state_, ComponentEvent::NONE, 0};
  }

  WiFiHealthUpdate transition_(WiFiDiagnosticState new_state,
                               ComponentEvent event, uint32_t timestamp_ms) {
    const WiFiDiagnosticState previous_state = this->state_;
    this->state_ = new_state;
    return {previous_state, this->state_, event, timestamp_ms};
  }

  WiFiDiagnosticState state_{WiFiDiagnosticState::STARTING};
  uint32_t setup_timestamp_ms_{0};
  uint32_t disconnect_started_timestamp_ms_{0};
  uint32_t recovered_timestamp_ms_{0};
  uint32_t last_completed_outage_duration_ms_{0};
  uint32_t startup_grace_period_ms_{DEFAULT_WIFI_STARTUP_GRACE_PERIOD_MS};
  uint32_t outage_threshold_ms_{DEFAULT_WIFI_OUTAGE_THRESHOLD_MS};
  bool setup_completed_{false};
  bool real_connected_{false};
  bool has_connected_once_{false};
  bool outage_declared_{false};
  bool timeout_simulation_enabled_{false};
  bool has_completed_outage_{false};
};

enum class SelfTestStatus {
  NOT_RUN,
  RUNNING,
  PASS,
  FAIL,
};

inline const char *self_test_status_to_string(SelfTestStatus status) {
  switch (status) {
    case SelfTestStatus::NOT_RUN:
      return "NOT_RUN";
    case SelfTestStatus::RUNNING:
      return "RUNNING";
    case SelfTestStatus::PASS:
      return "PASS";
    case SelfTestStatus::FAIL:
      return "FAIL";
  }
  return "UNKNOWN";
}

enum class SelfTestSignal {
  NONE,
  STARTED,
  PASSED,
  FAILED,
};

enum SelfTestFailure : uint8_t {
  SELF_TEST_FAILURE_NONE = 0,
  SELF_TEST_FAILURE_PARSER = 1U << 0,
  SELF_TEST_FAILURE_WIFI = 1U << 1,
  SELF_TEST_FAILURE_API = 1U << 2,
  SELF_TEST_FAILURE_INTERNAL_STATE = 1U << 3,
};

struct SelfTestInputs {
  bool parser_watchdog_healthy{false};
  bool has_valid_frame{false};
  uint32_t valid_frame_age_ms{0};
  uint32_t parser_timeout_ms{DEFAULT_UART_TIMEOUT_MS};
  bool wifi_real_connected{false};
  bool wifi_watchdog_healthy{false};
  bool wifi_timeout_simulation_active{false};
  bool api_connected{false};
  bool internal_state_consistent{true};
};

struct SelfTestUpdate {
  SelfTestSignal signal{SelfTestSignal::NONE};
  SelfTestStatus status{SelfTestStatus::NOT_RUN};
  uint8_t failed_checks{SELF_TEST_FAILURE_NONE};
  uint32_t duration_ms{0};
  bool changed{false};
};

class SEMMeterSelfTest {
 public:
  SelfTestUpdate start(uint32_t timestamp_ms) {
    if (this->status_ == SelfTestStatus::RUNNING) {
      return this->no_change_();
    }
    this->status_ = SelfTestStatus::RUNNING;
    this->failed_checks_ = SELF_TEST_FAILURE_NONE;
    this->started_timestamp_ms_ = timestamp_ms;
    return {SelfTestSignal::STARTED, this->status_, this->failed_checks_, 0, true};
  }

  SelfTestUpdate evaluate(uint32_t timestamp_ms, const SelfTestInputs &inputs) {
    if (this->status_ != SelfTestStatus::RUNNING ||
        timestamp_ms - this->started_timestamp_ms_ < SELF_TEST_DURATION_MS) {
      return this->no_change_();
    }

    uint8_t failures = SELF_TEST_FAILURE_NONE;
    if (!inputs.parser_watchdog_healthy || !inputs.has_valid_frame ||
        inputs.valid_frame_age_ms >= inputs.parser_timeout_ms) {
      failures |= SELF_TEST_FAILURE_PARSER;
    }
    if (!inputs.wifi_real_connected || !inputs.wifi_watchdog_healthy ||
        inputs.wifi_timeout_simulation_active) {
      failures |= SELF_TEST_FAILURE_WIFI;
    }
    if (!inputs.api_connected) {
      failures |= SELF_TEST_FAILURE_API;
    }
    if (!inputs.internal_state_consistent) {
      failures |= SELF_TEST_FAILURE_INTERNAL_STATE;
    }

    this->failed_checks_ = failures;
    this->last_duration_ms_ = timestamp_ms - this->started_timestamp_ms_;
    this->status_ =
        failures == SELF_TEST_FAILURE_NONE ? SelfTestStatus::PASS
                                           : SelfTestStatus::FAIL;
    return {failures == SELF_TEST_FAILURE_NONE ? SelfTestSignal::PASSED
                                               : SelfTestSignal::FAILED,
            this->status_, this->failed_checks_, this->last_duration_ms_, true};
  }

  SelfTestStatus status() const { return this->status_; }
  uint8_t failed_checks() const { return this->failed_checks_; }
  uint32_t last_duration_ms() const { return this->last_duration_ms_; }
  bool running() const { return this->status_ == SelfTestStatus::RUNNING; }

  const char *failed_checks_string() const {
    switch (this->failed_checks_) {
      case SELF_TEST_FAILURE_NONE:
        return "NONE";
      case SELF_TEST_FAILURE_PARSER:
        return "PARSER";
      case SELF_TEST_FAILURE_WIFI:
        return "WIFI";
      case SELF_TEST_FAILURE_API:
        return "API";
      case SELF_TEST_FAILURE_INTERNAL_STATE:
        return "INTERNAL_STATE";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_WIFI:
        return "PARSER,WIFI";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_API:
        return "PARSER,API";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_INTERNAL_STATE:
        return "PARSER,INTERNAL_STATE";
      case SELF_TEST_FAILURE_WIFI | SELF_TEST_FAILURE_API:
        return "WIFI,API";
      case SELF_TEST_FAILURE_WIFI | SELF_TEST_FAILURE_INTERNAL_STATE:
        return "WIFI,INTERNAL_STATE";
      case SELF_TEST_FAILURE_API | SELF_TEST_FAILURE_INTERNAL_STATE:
        return "API,INTERNAL_STATE";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_WIFI |
          SELF_TEST_FAILURE_API:
        return "PARSER,WIFI,API";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_WIFI |
          SELF_TEST_FAILURE_INTERNAL_STATE:
        return "PARSER,WIFI,INTERNAL_STATE";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_API |
          SELF_TEST_FAILURE_INTERNAL_STATE:
        return "PARSER,API,INTERNAL_STATE";
      case SELF_TEST_FAILURE_WIFI | SELF_TEST_FAILURE_API |
          SELF_TEST_FAILURE_INTERNAL_STATE:
        return "WIFI,API,INTERNAL_STATE";
      case SELF_TEST_FAILURE_PARSER | SELF_TEST_FAILURE_WIFI |
          SELF_TEST_FAILURE_API | SELF_TEST_FAILURE_INTERNAL_STATE:
        return "PARSER,WIFI,API,INTERNAL_STATE";
      default:
        return "INTERNAL_STATE";
    }
  }

  const char *summary() const {
    if (this->status_ == SelfTestStatus::NOT_RUN) {
      return "Self-test has not run";
    }
    if (this->status_ == SelfTestStatus::RUNNING) {
      return "Self-test in progress";
    }
    if (this->status_ == SelfTestStatus::PASS) {
      return "All checks passed";
    }
    if ((this->failed_checks_ &
         static_cast<uint8_t>(this->failed_checks_ - 1U)) != 0) {
      return "Multiple checks failed";
    }
    if ((this->failed_checks_ & SELF_TEST_FAILURE_PARSER) != 0) {
      return "Parser unhealthy";
    }
    if ((this->failed_checks_ & SELF_TEST_FAILURE_WIFI) != 0) {
      return "WiFi unhealthy";
    }
    if ((this->failed_checks_ & SELF_TEST_FAILURE_API) != 0) {
      return "API disconnected";
    }
    return "Internal state inconsistent";
  }

 private:
  SelfTestUpdate no_change_() const {
    return {SelfTestSignal::NONE, this->status_, this->failed_checks_,
            this->last_duration_ms_, false};
  }

  SelfTestStatus status_{SelfTestStatus::NOT_RUN};
  uint8_t failed_checks_{SELF_TEST_FAILURE_NONE};
  uint32_t started_timestamp_ms_{0};
  uint32_t last_duration_ms_{0};
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
