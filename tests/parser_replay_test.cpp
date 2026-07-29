#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "sem_meter_accumulator.h"
#include "sem_meter_validator.h"

namespace {

using esphome::sem_meter::COMPLETE_FRAME_SIZE;
using esphome::sem_meter::ComponentEvent;
using esphome::sem_meter::ComponentState;
using esphome::sem_meter::DEFAULT_UART_TIMEOUT_MS;
using esphome::sem_meter::MARKER_PRIMARY;
using esphome::sem_meter::MARKER_SECONDARY;
using esphome::sem_meter::MAX_BYTES_PER_LOOP;
using esphome::sem_meter::MAX_BUFFER_SIZE;
using esphome::sem_meter::MeasurementId;
using esphome::sem_meter::RECORD_OVERLAP_SIZE;
using esphome::sem_meter::RECORD_CADENCE_SIZE;
using esphome::sem_meter::RECORD_COUNT;
using esphome::sem_meter::RECORD_SEQUENCE_SIZE;
using esphome::sem_meter::SEMMeterAccumulatorObserver;
using esphome::sem_meter::SEMMeterDiagnosticCounters;
using esphome::sem_meter::SEMMeterDiagnostics;
using esphome::sem_meter::SEMMeterFeedResult;
using esphome::sem_meter::SEMMeterFrameAccumulator;
using esphome::sem_meter::SEMMeterEventDispatcher;
using esphome::sem_meter::SEMMeterEventListener;
using esphome::sem_meter::SEMMeterHealthUpdate;
using esphome::sem_meter::SEMMeterHealthTracker;
using esphome::sem_meter::SEMMeterRecordParser;
using esphome::sem_meter::SEMMeterValidator;
using esphome::sem_meter::STATUS_IDLE;
using esphome::sem_meter::ValidationFailureReason;
using esphome::sem_meter::component_event_to_string;
using esphome::sem_meter::component_state_to_string;
using esphome::sem_meter::measurement_id_to_string;
using esphome::sem_meter::measurement_unit_to_string;
using esphome::sem_meter::sem_meter_is_healthy;
using esphome::sem_meter::validation_failure_reason_to_string;

class TrackingObserver final : public SEMMeterAccumulatorObserver {
 public:
  void on_decoded_record(size_t, uint8_t marker, uint8_t record_id, uint8_t) override {
    if (marker == MARKER_PRIMARY) {
      this->primary_records++;
    } else if (marker == MARKER_SECONDARY) {
      this->secondary_records++;
    }
    if (record_id < this->record_counts.size()) {
      this->record_counts[record_id]++;
    }
  }

  size_t primary_records{0};
  size_t secondary_records{0};
  std::array<size_t, RECORD_COUNT> record_counts{};
};

class RecordingEventListener final : public SEMMeterEventListener {
 public:
  void on_sem_meter_event(ComponentEvent event, uint32_t timestamp_ms) override {
    if (this->received_count < this->events.size()) {
      this->events[this->received_count] = event;
      this->timestamps[this->received_count] = timestamp_ms;
      this->received_count++;
    } else {
      this->overflowed = true;
    }
  }

  std::array<ComponentEvent, 8> events{};
  std::array<uint32_t, 8> timestamps{};
  size_t received_count{0};
  bool overflowed{false};
};

class ReentrantEventListener final : public SEMMeterEventListener {
 public:
  explicit ReentrantEventListener(SEMMeterEventDispatcher *dispatcher) : dispatcher_(dispatcher) {}

  void on_sem_meter_event(ComponentEvent, uint32_t timestamp_ms) override {
    this->callback_count++;
    this->nested_dispatch_accepted =
        this->dispatcher_->dispatch(ComponentEvent::MALFORMED_FRAME, timestamp_ms + 1);
  }

  size_t callback_count{0};
  bool nested_dispatch_accepted{false};

 private:
  SEMMeterEventDispatcher *dispatcher_;
};

class ReplaySession {
 public:
  SEMMeterFeedResult feed(const uint8_t *data, size_t size) {
    const SEMMeterFeedResult result =
        this->accumulator.feed(data, size, &this->observer, &this->diagnostics);
    expect_bounded();
    return result;
  }

  SEMMeterFeedResult feed(const std::vector<uint8_t> &bytes) { return this->feed(bytes.data(), bytes.size()); }

  SEMMeterFeedResult feed_validated(const uint8_t *data, size_t size,
                                    SEMMeterValidator &validator,
                                    uint32_t timestamp_ms) {
    const SEMMeterFeedResult result = this->accumulator.feed(
        data, size, &this->observer, &this->diagnostics, &validator, timestamp_ms);
    expect_bounded();
    return result;
  }

  SEMMeterFeedResult feed_validated(const std::vector<uint8_t> &bytes,
                                    SEMMeterValidator &validator,
                                    uint32_t timestamp_ms) {
    return this->feed_validated(bytes.data(), bytes.size(), validator,
                                timestamp_ms);
  }

  void expect_bounded() const {
    if (this->accumulator.buffered_size() > MAX_BUFFER_SIZE) {
      throw std::runtime_error("shared accumulator exceeded MAX_BUFFER_SIZE");
    }
  }

  const SEMMeterDiagnosticCounters &counters() const { return this->diagnostics.counters(); }

  SEMMeterFrameAccumulator accumulator;
  TrackingObserver observer;
  SEMMeterDiagnostics diagnostics;
};

std::vector<uint8_t> load_hex_file(const std::string &path) {
  std::ifstream input(path);
  if (!input) {
    throw std::runtime_error("could not open fixture: " + path);
  }

  std::vector<uint8_t> bytes;
  std::string token;
  while (input >> token) {
    if (token.size() != 2) {
      throw std::runtime_error("invalid hex token: " + token);
    }

    size_t parsed_characters = 0;
    const unsigned long value = std::stoul(token, &parsed_characters, 16);
    if (parsed_characters != token.size() || value > 0xFF) {
      throw std::runtime_error("invalid hex byte: " + token);
    }
    bytes.push_back(static_cast<uint8_t>(value));
  }

  return bytes;
}

void expect_true(bool condition, const std::string &message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

void expect_near(float actual, float expected, float tolerance, const std::string &label) {
  if (std::fabs(actual - expected) > tolerance) {
    std::ostringstream message;
    message << label << ": expected " << expected << " +/- " << tolerance << ", got " << actual;
    throw std::runtime_error(message.str());
  }
}

bool dispatch_health_update(SEMMeterEventDispatcher &dispatcher, const SEMMeterHealthUpdate &update) {
  if (update.event == ComponentEvent::NONE) {
    return false;
  }
  return dispatcher.dispatch(update.event, update.timestamp_ms);
}

size_t find_circuit_1_offset(const std::vector<uint8_t> &frame) {
  for (size_t offset = 0; offset + RECORD_SEQUENCE_SIZE <= frame.size(); offset++) {
    if (SEMMeterRecordParser::is_marker(frame[offset]) && frame[offset + 1] == 0x00 &&
        SEMMeterRecordParser::is_valid_status(frame[offset + 2])) {
      return offset;
    }
  }
  throw std::runtime_error("could not locate Circuit 1 record");
}

void set_branch_raw_power(std::vector<uint8_t> &frame, size_t record_offset,
                          uint32_t raw_power) {
  frame[record_offset + 2] = esphome::sem_meter::STATUS_ACTIVE;
  frame[record_offset + 14] =
      static_cast<uint8_t>((raw_power >> 24) & 0xFF);
  frame[record_offset + 15] =
      static_cast<uint8_t>((raw_power >> 16) & 0xFF);
  frame[record_offset + 16] =
      static_cast<uint8_t>((raw_power >> 8) & 0xFF);
  frame[record_offset + 17] = static_cast<uint8_t>(raw_power & 0xFF);
}

void verify_recovered_measurements(const ReplaySession &session, const std::string &mode) {
  const auto &parser = session.accumulator.parser();
  expect_near(parser.get_branch_power(1), 54.81f, 0.20f, mode + " Circuit 2 power");
  expect_near(parser.get_branch_power(2), 466.74f, 0.20f, mode + " Circuit 3 power");
  expect_near(parser.get_phase_a_voltage(), 116.41f, 0.20f, mode + " Phase A voltage");
  expect_near(parser.get_phase_b_voltage(), 116.41f, 0.20f, mode + " Phase B voltage");
  expect_true(parser.get_phase_a_power() > 0.0f, mode + ": Phase A power was not positive");
  expect_true(parser.get_phase_b_power() > 0.0f, mode + ": Phase B power was not positive");
  expect_near(parser.get_line_frequency(), 60.0f, 1.10f, mode + " line frequency");
  expect_near(parser.get_phase_c_power(), 0.0f, 0.01f, mode + " Phase C power");
  expect_true(parser.has_phase_a_voltage(), mode + ": Phase A voltage was not initialized");
  expect_true(parser.has_phase_b_voltage(), mode + ": Phase B voltage was not initialized");
  expect_true(parser.has_line_frequency(), mode + ": frequency was not initialized");

  std::cout << "       Circuit 2=" << parser.get_branch_power(1) << " W"
            << ", Circuit 3=" << parser.get_branch_power(2) << " W"
            << ", Phase A=" << parser.get_phase_a_voltage() << " V / " << parser.get_phase_a_power() << " W"
            << ", Phase B=" << parser.get_phase_b_voltage() << " V / " << parser.get_phase_b_power() << " W"
            << ", Frequency=" << parser.get_line_frequency() << " Hz"
            << ", Phase C=" << parser.get_phase_c_power() << " W\n";
}

void test_chunked_replay(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  expect_true(session.feed(frame.data(), 150).frames_processed == 0, "150-byte chunk decoded independently");
  expect_true(session.feed(frame.data() + 150, 150).frames_processed == 0,
              "300 partial bytes decoded independently");
  const SEMMeterFeedResult result = session.feed(frame.data() + 300, 147);
  expect_true(result.frames_processed == 1, "final 147-byte chunk did not complete the frame");
  expect_true(result.decoded_records == 19, "chunked replay did not decode 19 records");
  expect_true(session.counters().uart_bytes_received == COMPLETE_FRAME_SIZE,
              "chunked replay UART-byte counter was incorrect");
  expect_true(session.counters().feed_calls == 3, "chunked replay feed-call counter was incorrect");
  expect_true(session.counters().frames_processed == 1, "chunked replay frame counter was incorrect");
  expect_true(session.counters().records_decoded == 19, "chunked replay record counter was incorrect");
  expect_true(session.counters().idle_records > 0, "chunked replay idle-record counter did not increment");
  expect_true(session.counters().zero_valid_record_frames == 0,
              "valid chunked frame was counted as a zero-record frame");
  expect_true(session.counters().bytes_dropped == 0, "chunked replay unexpectedly counted dropped bytes");
  expect_true(session.counters().buffer_recovery_events == 0,
              "chunked replay unexpectedly counted a recovery event");
  expect_true(session.observer.primary_records > 0, "chunked replay did not decode marker 0xFF");
  expect_true(session.observer.secondary_records > 0, "chunked replay did not decode marker 0x3B");
  verify_recovered_measurements(session, "150/150/147 replay");
  std::cout << "[PASS] 150/150/147 replay uses the shared accumulator\n";
}

void test_bytewise_replay(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  for (const uint8_t byte : frame) {
    session.feed(&byte, 1);
  }
  expect_true(session.counters().uart_bytes_received == COMPLETE_FRAME_SIZE,
              "bytewise replay UART-byte counter was incorrect");
  expect_true(session.counters().feed_calls == COMPLETE_FRAME_SIZE,
              "bytewise replay feed-call counter was incorrect");
  expect_true(session.counters().frames_processed == 1, "bytewise replay did not process exactly one frame");
  expect_true(session.counters().records_decoded == 19, "bytewise replay did not decode 19 records");
  verify_recovered_measurements(session, "one-byte replay");
  std::cout << "[PASS] one-byte-at-a-time replay uses the shared accumulator\n";
}

void test_garbage_prefix_recovery(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  const std::vector<uint8_t> garbage(37, 0xA5);
  session.feed(garbage);
  session.feed(frame);
  session.feed(frame);
  expect_true(session.counters().frames_processed == 2,
              "garbage-prefix replay did not process two bounded windows");
  verify_recovered_measurements(session, "37-byte garbage prefix recovery");
  std::cout << "[PASS] 37 garbage bytes before valid frames recover successfully\n";
}

void test_half_frame_start_recovery(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  const size_t half_offset = COMPLETE_FRAME_SIZE / 2;
  session.feed(frame.data() + half_offset, frame.size() - half_offset);
  session.feed(frame);
  expect_true(session.counters().frames_processed == 1,
              "half-frame start did not process one complete window");
  verify_recovered_measurements(session, "half-frame capture recovery");
  std::cout << "[PASS] capture starting halfway through a frame recovers on the following frame\n";
}

void test_back_to_back_frames(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  std::vector<uint8_t> doubled;
  doubled.reserve(frame.size() * 2);
  doubled.insert(doubled.end(), frame.begin(), frame.end());
  doubled.insert(doubled.end(), frame.begin(), frame.end());

  const SEMMeterFeedResult first = session.feed(doubled);
  expect_true(first.frames_processed == 1, "one feed call processed more or less than one frame");
  expect_true(session.accumulator.buffered_size() == COMPLETE_FRAME_SIZE + RECORD_OVERLAP_SIZE,
              "unexpected buffered size after first of two frames");
  const SEMMeterFeedResult second = session.feed(nullptr, 0);
  expect_true(second.frames_processed == 1, "second frame was not processed on the next feed call");
  expect_true(session.counters().frames_processed == 2, "back-to-back replay did not process two frames");
  expect_true(session.counters().feed_calls == 2, "back-to-back replay feed-call counter was incorrect");
  expect_true(session.counters().bytes_dropped == 0,
              "back-to-back frames unexpectedly triggered recovery");
  verify_recovered_measurements(session, "two back-to-back frames");
  std::cout << "[PASS] two back-to-back frames are limited to one frame per feed call\n";
}

void test_buffer_recovery(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  const std::vector<uint8_t> garbage(MAX_BUFFER_SIZE + 106, 0xA5);
  const SEMMeterFeedResult overflow = session.feed(garbage);
  expect_true(overflow.bytes_dropped == 106, "large input did not report the expected dropped prefix");
  expect_true(overflow.frames_processed == 0,
              "unstructured garbage was reported as a processed frame");
  expect_true(overflow.decoded_records == 0, "garbage unexpectedly decoded records");

  const SEMMeterFeedResult recovery_feed = session.feed(frame);
  expect_true(recovery_feed.bytes_dropped == 0,
              "discarded garbage caused an unnecessary second buffer recovery");
  expect_true(recovery_feed.frames_processed == 1,
              "valid cycle did not decode immediately after overflow recovery");
  expect_true(session.counters().bytes_dropped == overflow.bytes_dropped + recovery_feed.bytes_dropped,
              "diagnostic dropped-byte counter did not match feed results");
  expect_true(session.counters().buffer_recovery_events == 1,
              "diagnostic recovery-event counter did not count the overflow");
  verify_recovered_measurements(session, "buffer overflow recovery");
  std::cout << "[PASS] bounded buffer drops old bytes and recovers valid readings\n";
}

void test_embedded_false_circuit_1_candidate(const std::vector<uint8_t> &frame) {
  std::vector<uint8_t> corrupted = frame;
  const size_t circuit_1_offset = find_circuit_1_offset(frame);
  const size_t false_candidate_offset = circuit_1_offset + 3 * RECORD_CADENCE_SIZE + 4;
  const uint32_t false_raw_power = 0x7004C034U;
  corrupted[false_candidate_offset] = MARKER_SECONDARY;
  corrupted[false_candidate_offset + 1] = 0x00;
  corrupted[false_candidate_offset + 2] = esphome::sem_meter::STATUS_ACTIVE;
  corrupted[false_candidate_offset + 14] =
      static_cast<uint8_t>((false_raw_power >> 24) & 0xFF);
  corrupted[false_candidate_offset + 15] =
      static_cast<uint8_t>((false_raw_power >> 16) & 0xFF);
  corrupted[false_candidate_offset + 16] =
      static_cast<uint8_t>((false_raw_power >> 8) & 0xFF);
  corrupted[false_candidate_offset + 17] =
      static_cast<uint8_t>(false_raw_power & 0xFF);

  ReplaySession session;
  const SEMMeterFeedResult result = session.feed(corrupted);
  expect_true(result.frames_processed == 1 && result.decoded_records == RECORD_COUNT,
              "embedded payload candidate prevented valid cycle decoding");
  expect_near(session.accumulator.parser().get_branch_power(0), 0.0f, 0.01f,
              "embedded false candidate overwrote Circuit 1");
  expect_true(session.observer.record_counts[0] == 1,
              "embedded false candidate decoded Circuit 1 more than once");
  verify_recovered_measurements(session, "embedded false Circuit 1 candidate");
  std::cout << "[PASS] embedded 3B 00 03 / 0x7004C034 candidate is ignored\n";
}

void test_duplicate_circuit_1_candidate_inside_payload(const std::vector<uint8_t> &frame) {
  std::vector<uint8_t> duplicated = frame;
  const size_t circuit_1_offset = find_circuit_1_offset(frame);
  const size_t duplicate_offset = circuit_1_offset + 7 * RECORD_CADENCE_SIZE + 4;
  duplicated[duplicate_offset] = MARKER_PRIMARY;
  duplicated[duplicate_offset + 1] = 0x00;
  duplicated[duplicate_offset + 2] = STATUS_IDLE;

  ReplaySession session;
  const SEMMeterFeedResult result = session.feed(duplicated);
  expect_true(result.frames_processed == 1 && result.decoded_records == RECORD_COUNT,
              "payload duplicate prevented structural cycle decoding");
  expect_true(session.observer.record_counts[0] == 1,
              "payload duplicate was decoded as a second Circuit 1 record");
  expect_true(session.counters().records_decoded == RECORD_COUNT,
              "payload duplicate increased decoded-record diagnostics");
  std::cout << "[PASS] duplicate Circuit 1 candidate inside payload is ignored\n";
}

void expect_structural_corruption_recovers(const std::vector<uint8_t> &corrupted,
                                           const std::vector<uint8_t> &valid_frame,
                                           const std::string &label) {
  ReplaySession session;
  const SEMMeterFeedResult damaged = session.feed(corrupted);
  expect_true(damaged.frames_processed == 0,
              label + ": damaged cycle was reported as decoded");
  expect_true(damaged.decoded_records == 0,
              label + ": damaged cycle mutated parser state");

  const SEMMeterFeedResult recovery = session.feed(valid_frame);
  expect_true(recovery.frames_processed == 1 &&
                  recovery.decoded_records == RECORD_COUNT,
              label + ": next valid cycle did not recover");
  expect_true(session.counters().structural_cycle_rejections >= 1,
              label + ": structural rejection was not diagnosed");
  verify_recovered_measurements(session, label + " recovery");
}

void test_inserted_and_deleted_byte_recovery(const std::vector<uint8_t> &frame) {
  const size_t circuit_1_offset = find_circuit_1_offset(frame);

  std::vector<uint8_t> inserted = frame;
  inserted.insert(inserted.begin() + static_cast<std::ptrdiff_t>(
                                      circuit_1_offset + 6 * RECORD_CADENCE_SIZE + 8),
                  0xA5);
  expect_structural_corruption_recovers(inserted, frame, "inserted byte");

  std::vector<uint8_t> deleted = frame;
  deleted.erase(deleted.begin() + static_cast<std::ptrdiff_t>(
                                    circuit_1_offset + 6 * RECORD_CADENCE_SIZE + 8));
  expect_structural_corruption_recovers(deleted, frame, "deleted byte");
  std::cout << "[PASS] inserted and deleted bytes reject the damaged cycle and recover\n";
}

void test_corrupted_record_headers_recover(const std::vector<uint8_t> &frame) {
  const size_t circuit_1_offset = find_circuit_1_offset(frame);
  const size_t target_offset = circuit_1_offset + 4 * RECORD_CADENCE_SIZE;

  std::vector<uint8_t> marker_corruption = frame;
  marker_corruption[target_offset] = 0xA5;
  expect_structural_corruption_recovers(marker_corruption, frame, "corrupted marker");

  std::vector<uint8_t> id_corruption = frame;
  id_corruption[target_offset + 1] = 0x0E;
  expect_structural_corruption_recovers(id_corruption, frame, "corrupted ID");

  std::vector<uint8_t> status_corruption = frame;
  status_corruption[target_offset + 2] = 0x02;
  expect_structural_corruption_recovers(status_corruption, frame, "corrupted status");
  std::cout << "[PASS] marker, ID, and status corruption recover on the next cycle\n";
}

void test_transactional_power_validation(const std::vector<uint8_t> &frame) {
  const size_t circuit_1_offset = find_circuit_1_offset(frame);
  const uint32_t baseline_raw_power = 0x0004C034U;
  const uint32_t corrupted_raw_power = 0x7004C034U;
  const uint32_t recovered_raw_power = baseline_raw_power + 95U;

  std::vector<uint8_t> baseline = frame;
  set_branch_raw_power(baseline, circuit_1_offset, baseline_raw_power);
  std::vector<uint8_t> corrupted = baseline;
  set_branch_raw_power(corrupted, circuit_1_offset, corrupted_raw_power);
  std::vector<uint8_t> recovered = baseline;
  set_branch_raw_power(recovered, circuit_1_offset, recovered_raw_power);

  ReplaySession session;
  SEMMeterValidator cycle_validator;

  const SEMMeterFeedResult accepted =
      session.feed_validated(baseline, cycle_validator, 1);
  expect_true(accepted.frames_processed == 1 &&
                  accepted.decoded_records == RECORD_COUNT,
              "plausible baseline cycle was not accepted");
  const float last_good = session.accumulator.parser().get_branch_power(0);
  expect_near(last_good,
              static_cast<float>(baseline_raw_power) /
                  esphome::sem_meter::BRANCH_POWER_DIVISOR,
              0.01f, "transactional baseline Circuit 1 power");
  const size_t callbacks_after_baseline = session.observer.record_counts[0];

  const SEMMeterFeedResult rejected =
      session.feed_validated(corrupted, cycle_validator, 2);
  expect_true(rejected.frames_processed == 0 &&
                  rejected.decoded_records == 0 &&
                  rejected.validation_rejections == 1,
              "electrically impossible cycle was not rejected atomically");
  expect_true(rejected.rejected_measurement ==
                  MeasurementId::CIRCUIT_1_POWER &&
                  rejected.rejection_reason ==
                      ValidationFailureReason::ABOVE_MAXIMUM,
              "Circuit 1 corruption reported the wrong rejection");
  expect_near(rejected.rejected_value, 19782732.0f, 1.0f,
              "validator did not inspect the corrupt candidate value");
  expect_near(session.accumulator.parser().get_branch_power(0), last_good,
              0.01f, "rejected candidate entered live parser state");
  expect_true(session.observer.record_counts[0] == callbacks_after_baseline,
              "rejected cycle reached the accepted-record observer");
  expect_true(cycle_validator.rejected_sensor_values() == 1,
              "transactional rejection diagnostic did not increment once");
  expect_near(cycle_validator.last_accepted_value(
                  MeasurementId::CIRCUIT_1_POWER),
              last_good, 0.01f,
              "validator lost its last-good Circuit 1 state");

  const SEMMeterFeedResult recovery =
      session.feed_validated(recovered, cycle_validator, 3);
  expect_true(recovery.frames_processed == 1 &&
                  recovery.decoded_records == RECORD_COUNT,
              "following valid cycle did not recover");
  expect_near(session.accumulator.parser().get_branch_power(0),
              static_cast<float>(recovered_raw_power) /
                  esphome::sem_meter::BRANCH_POWER_DIVISOR,
              0.01f, "recovered Circuit 1 power");
  expect_true(session.observer.record_counts[0] ==
                  callbacks_after_baseline + 1,
              "recovered cycle did not reach the publication observer");
  std::cout << "[PASS] cycle validation is atomic and preserves last-good parser state\n";
}

void test_malformed_and_partial_counters() {
  ReplaySession partial_session;
  const std::array<uint8_t, 3> partial_candidate{MARKER_PRIMARY, 0x00, STATUS_IDLE};
  partial_session.feed(partial_candidate.data(), partial_candidate.size());
  partial_session.feed(nullptr, 0);
  expect_true(partial_session.counters().partial_records == 1,
              "incomplete structural candidate was counted more than once");

  ReplaySession malformed_session;
  std::vector<uint8_t> malformed(RECORD_SEQUENCE_SIZE, 0x00);
  for (size_t record_id = 0; record_id < RECORD_COUNT; record_id++) {
    const size_t offset = record_id * RECORD_CADENCE_SIZE;
    malformed[offset] = MARKER_PRIMARY;
    malformed[offset + 1] = static_cast<uint8_t>(record_id);
    malformed[offset + 2] = STATUS_IDLE;
  }
  malformed[4 * RECORD_CADENCE_SIZE + 2] = 0x02;
  const SEMMeterFeedResult result = malformed_session.feed(malformed);
  expect_true(result.frames_processed == 0,
              "structurally malformed cycle was reported as decoded");
  expect_true(result.decoded_records == 0,
              "structurally malformed cycle mutated parser state");
  expect_true(result.structural_cycle_rejections == 1,
              "structural cycle rejection was not reported once");
  expect_true(malformed_session.counters().malformed_record_candidates == 1,
              "malformed structural record was not counted once");
  expect_true(malformed_session.counters().structural_cycle_rejections == 1,
              "structural rejection diagnostic did not increment");
  expect_true(malformed_session.counters().malformed_frames == 1,
              "malformed-cycle diagnostic did not increment");
  expect_true(malformed_session.counters().zero_valid_record_frames == 0,
              "candidate rejection incorrectly incremented zero-record frames");
  std::cout << "[PASS] malformed and partial record diagnostics increment correctly\n";
}

void test_malformed_cycle_episode_deduplication(
    const std::vector<uint8_t> &frame) {
  std::vector<uint8_t> damaged = frame;
  const size_t circuit_1_offset = find_circuit_1_offset(frame);
  damaged[circuit_1_offset + 4 * RECORD_CADENCE_SIZE + 2] = 0x02;

  const std::array<size_t, 3> false_candidate_offsets{
      circuit_1_offset + 3 * RECORD_CADENCE_SIZE + 4,
      circuit_1_offset + 7 * RECORD_CADENCE_SIZE + 4,
      circuit_1_offset + 12 * RECORD_CADENCE_SIZE + 4};
  for (const size_t offset : false_candidate_offsets) {
    damaged[offset] = MARKER_SECONDARY;
    damaged[offset + 1] = 0x00;
    damaged[offset + 2] = esphome::sem_meter::STATUS_ACTIVE;
  }

  std::vector<uint8_t> damaged_then_valid;
  damaged_then_valid.reserve(damaged.size() + frame.size());
  damaged_then_valid.insert(damaged_then_valid.end(), damaged.begin(),
                            damaged.end());
  damaged_then_valid.insert(damaged_then_valid.end(), frame.begin(),
                            frame.end());

  ReplaySession single_feed_session;
  const SEMMeterFeedResult single_feed =
      single_feed_session.feed(damaged_then_valid);
  expect_true(single_feed.structural_cycle_rejections ==
                  false_candidate_offsets.size() + 1,
              "granular structural rejection count was incorrect");
  expect_true(single_feed.malformed_frames == 1,
              "multiple false candidates inflated malformed frames");
  expect_true(single_feed_session.counters().malformed_frames == 1,
              "malformed-frame diagnostic was not episode-based");
  expect_true(single_feed.frames_processed == 1,
              "next valid cycle did not clear the malformed episode");

  ReplaySession chunked_session;
  SEMMeterHealthTracker health;
  SEMMeterEventDispatcher dispatcher;
  size_t malformed_events = 0;
  size_t structural_rejections = 0;
  for (size_t offset = 0; offset < damaged_then_valid.size();
       offset += MAX_BYTES_PER_LOOP) {
    const size_t chunk_size =
        std::min(MAX_BYTES_PER_LOOP, damaged_then_valid.size() - offset);
    const SEMMeterFeedResult result =
        chunked_session.feed(damaged_then_valid.data() + offset, chunk_size);
    malformed_events += result.malformed_frames;
    structural_rejections += result.structural_cycle_rejections;
    for (size_t event_index = 0; event_index < result.malformed_frames;
         event_index++) {
      expect_true(dispatch_health_update(
                      dispatcher,
                      health.record_malformed_frame(
                          static_cast<uint32_t>(offset))),
                  "malformed cycle event was not dispatched");
    }
  }
  expect_true(malformed_events == 1,
              "retained damaged bytes emitted duplicate malformed events");
  expect_true(structural_rejections == false_candidate_offsets.size() + 1,
              "chunked replay lost granular structural rejections");
  expect_true(chunked_session.counters().malformed_frames == 1,
              "chunked malformed diagnostic incremented more than once");
  expect_true(dispatcher.event_count() == 1 &&
                  dispatcher.last_event() == ComponentEvent::MALFORMED_FRAME,
              "one damaged cycle did not dispatch exactly one malformed event");
  expect_true(chunked_session.counters().frames_processed == 1,
              "chunked malformed replay did not recover on the valid cycle");

  const SEMMeterFeedResult next_episode =
      chunked_session.feed(damaged_then_valid);
  expect_true(next_episode.malformed_frames == 1,
              "successful recovery did not clear the malformed episode");
  expect_true(chunked_session.counters().malformed_frames == 2,
              "second damaged physical cycle was not counted");
  std::cout << "[PASS] malformed cycles deduplicate false candidates and retained bytes\n";
}

void test_yaml_entity_names() {
  std::ifstream input("sem-meter.yaml");
  expect_true(static_cast<bool>(input), "could not open sem-meter.yaml");
  const std::string yaml((std::istreambuf_iterator<char>(input)),
                         std::istreambuf_iterator<char>());
  expect_true(yaml.find("circuit_4_name: surge protector") !=
                  std::string::npos,
              "intentional Surge Protector name is missing");
  expect_true(yaml.find("circuit_13_name: \"A\\u2044C\"") !=
                  std::string::npos,
              "A/C fraction-slash spelling changed");
  expect_true(yaml.find("circuit_13_name: A/C") == std::string::npos,
              "literal A/C spelling would trigger ESPHome naming warnings");
  std::cout << "[PASS] intentional YAML names preserve Surge Protector and A/C entity identity\n";
}

void test_timing_statistics() {
  SEMMeterDiagnostics diagnostics;
  diagnostics.record_loop_time(10);
  diagnostics.record_loop_time(30);
  diagnostics.record_accumulator_time(7);
  diagnostics.record_accumulator_time(13);

  const auto &loop_timing = diagnostics.loop_timing();
  expect_true(loop_timing.minimum_microseconds == 10, "loop minimum timing was incorrect");
  expect_true(loop_timing.maximum_microseconds == 30, "loop maximum timing was incorrect");
  expect_true(loop_timing.cumulative_microseconds == 40, "loop cumulative timing was incorrect");
  expect_true(loop_timing.sample_count == 2, "loop timing sample count was incorrect");
  expect_true(loop_timing.average_microseconds() == 20.0, "loop average timing was incorrect");

  const auto &accumulator_timing = diagnostics.accumulator_timing();
  expect_true(accumulator_timing.minimum_microseconds == 7, "accumulator minimum timing was incorrect");
  expect_true(accumulator_timing.maximum_microseconds == 13, "accumulator maximum timing was incorrect");
  expect_true(accumulator_timing.cumulative_microseconds == 20,
              "accumulator cumulative timing was incorrect");
  expect_true(accumulator_timing.sample_count == 2, "accumulator timing sample count was incorrect");
  expect_true(accumulator_timing.average_microseconds() == 10.0,
              "accumulator average timing was incorrect");
  std::cout << "[PASS] loop and accumulator timing statistics calculate correctly\n";
}

void test_diagnostic_string_conversions() {
  const std::array<ComponentState, 5> states{
      ComponentState::BOOTING, ComponentState::WAITING_FOR_UART,
      ComponentState::RECEIVING_DATA, ComponentState::DATA_TIMEOUT, ComponentState::RECOVERING};
  const std::array<const char *, 5> expected_states{
      "BOOTING", "WAITING_FOR_UART", "RECEIVING_DATA", "DATA_TIMEOUT", "RECOVERING"};
  for (size_t index = 0; index < states.size(); index++) {
    expect_true(std::string(component_state_to_string(states[index])) == expected_states[index],
                "component state string conversion was incorrect");
  }

  const std::array<ComponentEvent, 8> events{
      ComponentEvent::NONE,          ComponentEvent::SYSTEM_STARTED,
      ComponentEvent::UART_STARTED,  ComponentEvent::UART_TIMEOUT,
      ComponentEvent::UART_RESTORED, ComponentEvent::BUFFER_OVERFLOW,
      ComponentEvent::MALFORMED_FRAME, ComponentEvent::INVALID_SENSOR_VALUE};
  const std::array<const char *, 8> expected_events{
      "NONE",          "SYSTEM_STARTED", "UART_STARTED",  "UART_TIMEOUT",
      "UART_RESTORED", "BUFFER_OVERFLOW", "MALFORMED_FRAME", "INVALID_SENSOR_VALUE"};
  for (size_t index = 0; index < events.size(); index++) {
    expect_true(std::string(component_event_to_string(events[index])) == expected_events[index],
                "component event string conversion was incorrect");
  }

  expect_true(!sem_meter_is_healthy(ComponentState::BOOTING, false),
              "BOOTING component was reported healthy");
  expect_true(!sem_meter_is_healthy(ComponentState::WAITING_FOR_UART, true),
              "WAITING_FOR_UART component was reported healthy");
  expect_true(sem_meter_is_healthy(ComponentState::RECEIVING_DATA, true),
              "healthy RECEIVING_DATA component was reported unhealthy");
  expect_true(!sem_meter_is_healthy(ComponentState::RECEIVING_DATA, false),
              "component was healthy with unhealthy UART");
  expect_true(!sem_meter_is_healthy(ComponentState::DATA_TIMEOUT, true),
              "DATA_TIMEOUT component was reported healthy");
  expect_true(!sem_meter_is_healthy(ComponentState::RECOVERING, true),
              "RECOVERING component was reported healthy");
  std::cout << "[PASS] diagnostic state, event, and aggregate health conversions are correct\n";
}

void test_sensor_value_validation() {
  SEMMeterValidator validator;

  auto result = validator.validate(MeasurementId::CIRCUIT_1_POWER, 0.0f, 10);
  expect_true(result.valid, "valid zero circuit power was rejected");
  expect_true(validator.has_accepted_value(MeasurementId::CIRCUIT_1_POWER),
              "first valid sample was not initialized");
  expect_near(validator.last_accepted_value(MeasurementId::CIRCUIT_1_POWER), 0.0f, 0.0f,
              "first accepted zero");

  result = validator.validate(MeasurementId::CIRCUIT_1_POWER, 1000.0f, 20);
  expect_true(result.valid, "reasonable circuit power change was rejected");
  result = validator.validate(MeasurementId::CIRCUIT_1_POWER, 22000.01f, 30);
  expect_true(!result.valid && result.reason == ValidationFailureReason::EXCESSIVE_JUMP,
              "excessive one-frame circuit jump was not rejected");
  expect_near(validator.last_accepted_value(MeasurementId::CIRCUIT_1_POWER), 1000.0f, 0.0f,
              "rejected jump replaced last accepted value");
  expect_true(validator.rejected_sensor_values() == 1,
              "rejected jump did not increment counter exactly once");

  result = validator.validate(MeasurementId::CIRCUIT_1_POWER, 1500.0f, 40);
  expect_true(result.valid, "reasonable value after rejection was not accepted");
  expect_near(validator.last_accepted_value(MeasurementId::CIRCUIT_1_POWER), 1500.0f, 0.0f,
              "recovery did not replace accepted value");

  result = validator.validate(MeasurementId::PHASE_A_VOLTAGE, NAN, 50);
  expect_true(!result.valid && result.reason == ValidationFailureReason::NOT_FINITE,
              "NaN was not rejected");
  result = validator.validate(MeasurementId::PHASE_A_VOLTAGE, INFINITY, 51);
  expect_true(!result.valid && result.reason == ValidationFailureReason::NOT_FINITE,
              "positive infinity was not rejected");
  result = validator.validate(MeasurementId::PHASE_A_VOLTAGE, -INFINITY, 52);
  expect_true(!result.valid && result.reason == ValidationFailureReason::NOT_FINITE,
              "negative infinity was not rejected");
  result = validator.validate(MeasurementId::PHASE_A_VOLTAGE, 69.99f, 53);
  expect_true(!result.valid && result.reason == ValidationFailureReason::BELOW_MINIMUM,
              "below-minimum voltage was not rejected");
  result = validator.validate(MeasurementId::PHASE_A_VOLTAGE, 150.01f, 54);
  expect_true(!result.valid && result.reason == ValidationFailureReason::ABOVE_MAXIMUM,
              "above-maximum voltage was not rejected");
  result = validator.validate(MeasurementId::MAIN_PHASE_A_POWER, -0.01f, 55);
  expect_true(!result.valid && result.reason == ValidationFailureReason::BELOW_MINIMUM,
              "negative power was not rejected");

  result = validator.validate(MeasurementId::PHASE_B_VOLTAGE, 116.0f, 60);
  expect_true(result.valid, "first valid voltage was rejected");
  result = validator.validate(MeasurementId::PHASE_B_VOLTAGE, 120.0f, 61);
  expect_true(result.valid, "normal voltage change was rejected");
  result = validator.validate(MeasurementId::PHASE_B_VOLTAGE, 70.0f, 62);
  expect_true(!result.valid && result.reason == ValidationFailureReason::EXCESSIVE_JUMP,
              "in-range excessive voltage jump was not rejected");
  expect_near(validator.last_accepted_value(MeasurementId::PHASE_B_VOLTAGE), 120.0f, 0.0f,
              "rejected voltage jump replaced last accepted value");
  result = validator.validate(MeasurementId::PHASE_B_VOLTAGE, 118.0f, 63);
  expect_true(result.valid, "voltage did not recover after a rejected sample");

  result = validator.validate(MeasurementId::MAIN_PHASE_B_POWER, 60000.0f, 70);
  expect_true(result.valid, "valid main phase power was rejected");
  result = validator.validate(MeasurementId::MAIN_PHASE_B_POWER, 0.0f, 71);
  expect_true(result.valid, "idle zero was rejected by jump filtering");

  const uint64_t rejected_before_ac = validator.rejected_sensor_values();
  result = validator.validate(MeasurementId::CIRCUIT_13_POWER, 353204.5625f, 123456U);
  expect_true(!result.valid && result.reason == ValidationFailureReason::ABOVE_MAXIMUM,
              "known impossible A/C value was not rejected");
  expect_true(validator.rejected_sensor_values() == rejected_before_ac + 1,
              "A/C rejection counter did not increment exactly once");
  expect_near(validator.last_rejected_value(), 353204.5625f, 0.01f,
              "last rejected value was incorrect");
  expect_true(validator.last_rejected_measurement() == MeasurementId::CIRCUIT_13_POWER,
              "last rejected measurement was incorrect");
  expect_true(validator.last_rejection_reason() == ValidationFailureReason::ABOVE_MAXIMUM,
              "last rejection reason was incorrect");
  expect_true(validator.last_rejection_timestamp_ms() == 123456U,
              "last rejection timestamp was incorrect");

  const std::array<ValidationFailureReason, 5> reasons{
      ValidationFailureReason::NONE, ValidationFailureReason::NOT_FINITE,
      ValidationFailureReason::BELOW_MINIMUM, ValidationFailureReason::ABOVE_MAXIMUM,
      ValidationFailureReason::EXCESSIVE_JUMP};
  const std::array<const char *, 5> expected_reasons{
      "NONE", "NOT_FINITE", "BELOW_MINIMUM", "ABOVE_MAXIMUM", "EXCESSIVE_JUMP"};
  for (size_t index = 0; index < reasons.size(); index++) {
    expect_true(std::string(validation_failure_reason_to_string(reasons[index])) ==
                    expected_reasons[index],
                "validation failure reason string conversion was incorrect");
  }

  expect_true(std::string(measurement_id_to_string(MeasurementId::PHASE_A_VOLTAGE)) ==
                  "Phase A Voltage",
              "phase voltage measurement string conversion was incorrect");
  expect_true(std::string(measurement_id_to_string(MeasurementId::TOTAL_MAIN_POWER)) ==
                  "Total Main Power",
              "total main measurement string conversion was incorrect");
  expect_true(std::string(measurement_id_to_string(MeasurementId::CIRCUIT_13_POWER)) ==
                  "A/C Power",
              "A/C measurement string conversion was incorrect");
  expect_true(std::string(measurement_unit_to_string(MeasurementId::PHASE_A_VOLTAGE)) == "V" &&
                  std::string(measurement_unit_to_string(MeasurementId::LINE_FREQUENCY)) == "Hz" &&
                  std::string(measurement_unit_to_string(MeasurementId::CIRCUIT_13_POWER)) == "W",
              "measurement unit string conversion was incorrect");
  for (uint8_t raw = static_cast<uint8_t>(MeasurementId::PHASE_A_VOLTAGE);
       raw < static_cast<uint8_t>(MeasurementId::COUNT); raw++) {
    expect_true(std::string(measurement_id_to_string(static_cast<MeasurementId>(raw))) !=
                    "UNKNOWN",
                "a MeasurementId did not have a string conversion");
  }

  SEMMeterValidator configured_validator;
  configured_validator.set_circuit_power_maximum_delta(500.0f);
  expect_true(configured_validator.validate(MeasurementId::CIRCUIT_2_POWER, 100.0f, 1).valid,
              "configured validator rejected its first valid sample");
  result = configured_validator.validate(MeasurementId::CIRCUIT_2_POWER, 601.0f, 2);
  expect_true(!result.valid && result.reason == ValidationFailureReason::EXCESSIVE_JUMP,
              "configured circuit jump threshold was not applied");

  std::cout << "[PASS] validator rejects impossible values, retains last-good state, and recovers\n";
}

void test_startup_measurement_readiness() {
  SEMMeterValidator validator;

  expect_true(validator.rejected_sensor_values() == 0,
              "startup rejection counter did not begin at zero");
  expect_true(!validator.has_rejected_sensor_value(),
              "startup diagnostics claimed a rejected value");
  expect_true(validator.last_rejected_measurement() == MeasurementId::NONE,
              "startup rejected measurement was not NONE");
  expect_true(validator.last_rejection_reason() == ValidationFailureReason::NONE,
              "startup rejection reason was not NONE");
  expect_true(validator.last_rejection_timestamp_ms() == 0,
              "startup rejection timestamp was not unset");

  auto attempt =
      validator.validate_if_ready(MeasurementId::PHASE_A_VOLTAGE, 0.0f, 10);
  expect_true(!attempt.evaluated, "placeholder Phase A voltage was validated");
  attempt = validator.validate_if_ready(MeasurementId::PHASE_B_VOLTAGE, 0.0f, 11);
  expect_true(!attempt.evaluated, "placeholder Phase B voltage was validated");
  attempt = validator.validate_if_ready(MeasurementId::LINE_FREQUENCY, 0.0f, 12);
  expect_true(!attempt.evaluated, "placeholder frequency was validated");
  expect_true(validator.rejected_sensor_values() == 0,
              "startup placeholders incremented the rejection counter");
  expect_true(!validator.has_accepted_value(MeasurementId::PHASE_A_VOLTAGE) &&
                  !validator.has_accepted_value(MeasurementId::PHASE_B_VOLTAGE) &&
                  !validator.has_accepted_value(MeasurementId::LINE_FREQUENCY),
              "startup placeholders initialized validation history");

  expect_true(validator.mark_measurement_ready(MeasurementId::CIRCUIT_1_POWER),
              "circuit readiness was not accepted");
  attempt = validator.validate_if_ready(MeasurementId::CIRCUIT_1_POWER, 0.0f, 20);
  expect_true(attempt.evaluated && attempt.result.valid,
              "decoded circuit idle zero was not accepted");

  expect_true(validator.mark_measurement_ready(MeasurementId::MAIN_PHASE_C_POWER),
              "Phase C readiness was not accepted");
  attempt = validator.validate_if_ready(MeasurementId::MAIN_PHASE_C_POWER, 0.0f, 21);
  expect_true(attempt.evaluated && attempt.result.valid,
              "decoded Main Phase C zero was not accepted");

  validator.mark_measurement_ready(MeasurementId::PHASE_A_VOLTAGE);
  attempt = validator.validate_if_ready(MeasurementId::PHASE_A_VOLTAGE, 116.4f, 30);
  expect_true(attempt.evaluated && attempt.result.valid,
              "first decoded phase voltage was not accepted");
  expect_near(validator.last_accepted_value(MeasurementId::PHASE_A_VOLTAGE), 116.4f, 0.0f,
              "first phase voltage history");

  validator.mark_measurement_ready(MeasurementId::LINE_FREQUENCY);
  attempt = validator.validate_if_ready(MeasurementId::LINE_FREQUENCY, 59.0f, 31);
  expect_true(attempt.evaluated && attempt.result.valid,
              "first decoded frequency was not accepted");

  validator.mark_measurement_ready(MeasurementId::CIRCUIT_13_POWER);
  attempt = validator.validate_if_ready(MeasurementId::CIRCUIT_13_POWER, 2935.0f, 40);
  expect_true(attempt.evaluated && attempt.result.valid,
              "first decoded A/C power was not accepted");
  expect_true(validator.rejected_sensor_values() == 0,
              "valid initialized samples changed the rejection counter");
  expect_true(!validator.has_rejected_sensor_value(),
              "rejection value became available before a real rejection");

  attempt =
      validator.validate_if_ready(MeasurementId::CIRCUIT_13_POWER, 353204.5625f, 41);
  expect_true(attempt.evaluated && !attempt.result.valid &&
                  attempt.result.reason == ValidationFailureReason::ABOVE_MAXIMUM,
              "initialized impossible A/C sample was not rejected");
  expect_true(validator.rejected_sensor_values() == 1,
              "real invalid value did not increment rejection count exactly once");
  expect_true(validator.has_rejected_sensor_value(),
              "real rejection did not make rejection metadata available");
  expect_true(validator.last_rejected_measurement() == MeasurementId::CIRCUIT_13_POWER,
              "real rejection stored the wrong measurement");
  expect_near(validator.last_rejected_value(), 353204.5625f, 0.01f,
              "real rejection stored the wrong value");
  expect_true(validator.last_rejection_reason() == ValidationFailureReason::ABOVE_MAXIMUM,
              "real rejection stored the wrong reason");
  expect_true(validator.last_rejection_timestamp_ms() == 41,
              "real rejection stored the wrong timestamp");
  expect_near(validator.last_accepted_value(MeasurementId::CIRCUIT_13_POWER), 2935.0f, 0.0f,
              "rejected A/C sample replaced the last good value");

  attempt = validator.validate_if_ready(MeasurementId::CIRCUIT_13_POWER, 2940.0f, 42);
  expect_true(attempt.evaluated && attempt.result.valid,
              "normal A/C value immediately after rejection was not accepted");
  expect_near(validator.last_accepted_value(MeasurementId::CIRCUIT_13_POWER), 2940.0f, 0.0f,
              "A/C recovery did not update validation history");
  expect_true(validator.rejected_sensor_values() == 1,
              "recovery changed the rejection counter");

  std::cout << "[PASS] startup placeholders remain unavailable until decoded measurements arrive\n";
}

void test_uart_health_transitions() {
  SEMMeterHealthTracker health;
  SEMMeterEventDispatcher dispatcher;
  RecordingEventListener listener;
  RecordingEventListener second_listener;

  expect_true(health.state() == ComponentState::BOOTING, "health tracker did not start in BOOTING");
  expect_true(dispatcher.last_event() == ComponentEvent::NONE,
              "event dispatcher did not start with NONE event");
  expect_true(dispatcher.event_count() == 0, "event dispatcher counter did not start at zero");
  expect_true(!dispatcher.register_event_listener(nullptr), "null listener registration was accepted");
  expect_true(dispatcher.register_event_listener(&listener), "first listener registration was rejected");
  expect_true(!dispatcher.register_event_listener(&listener),
              "duplicate listener registration was accepted");
  expect_true(!dispatcher.register_event_listener(&second_listener),
              "listener limit did not reject a second listener");
  expect_true(dispatcher.listener_count() == 1, "listener count was not bounded to one");
  expect_true(health.uart_timeout_ms() == DEFAULT_UART_TIMEOUT_MS,
              "health tracker did not use the default 10-second timeout");
  expect_true(!health.uart_healthy(), "UART was healthy before a valid frame");
  expect_true(!health.sem_meter_healthy(), "SEM Meter was healthy before a valid frame");

  const auto setup = health.setup_completed(100);
  expect_true(setup.state_changed(), "setup did not transition component state");
  expect_true(setup.event == ComponentEvent::SYSTEM_STARTED,
              "setup did not raise SYSTEM_STARTED");
  expect_true(health.state() == ComponentState::WAITING_FOR_UART,
              "setup did not transition to WAITING_FOR_UART");
  expect_true(dispatch_health_update(dispatcher, setup), "SYSTEM_STARTED was not dispatched");
  expect_true(dispatcher.event_count() == 1, "SYSTEM_STARTED was not counted exactly once");
  expect_true(health.setup_completed(101).event == ComponentEvent::NONE,
              "repeated setup raised SYSTEM_STARTED");
  expect_true(dispatcher.event_count() == 1, "repeated setup changed the event counter");

  const auto started = health.record_valid_frame(200);
  expect_true(started.event == ComponentEvent::UART_STARTED, "first valid frame did not raise UART_STARTED");
  expect_true(dispatch_health_update(dispatcher, started), "UART_STARTED was not dispatched");
  expect_true(health.state() == ComponentState::RECEIVING_DATA,
              "first valid frame did not transition to RECEIVING_DATA");
  expect_true(dispatcher.last_event() == ComponentEvent::UART_STARTED, "UART_STARTED was not retained");
  expect_true(dispatcher.event_count() == 2, "UART_STARTED did not increment the event counter once");
  expect_true(dispatcher.last_event_timestamp_ms() == 200, "UART_STARTED timestamp was incorrect");
  expect_true(health.last_valid_frame_timestamp_ms() == 200, "first valid-frame timestamp was incorrect");
  expect_true(health.uart_healthy(), "UART was not healthy after a valid frame");
  expect_true(health.sem_meter_healthy(), "SEM Meter was not healthy during valid UART data");

  const auto continued = health.record_valid_frame(300);
  expect_true(continued.event == ComponentEvent::NONE, "healthy data repeated UART_STARTED");
  expect_true(!dispatch_health_update(dispatcher, continued),
              "healthy data dispatched an event");
  expect_true(dispatcher.event_count() == 2, "healthy data incremented the event counter");
  expect_true(health.last_valid_frame_timestamp_ms() == 300, "valid-frame timestamp was not refreshed");

  expect_true(health.check_timeout(10299).event == ComponentEvent::NONE,
              "UART timed out before 10 seconds");
  const auto timed_out = health.check_timeout(10300);
  expect_true(timed_out.event == ComponentEvent::UART_TIMEOUT, "10-second outage did not raise UART_TIMEOUT");
  expect_true(dispatch_health_update(dispatcher, timed_out), "UART_TIMEOUT was not dispatched");
  expect_true(health.state() == ComponentState::DATA_TIMEOUT,
              "UART timeout did not transition to DATA_TIMEOUT");
  expect_true(!health.uart_healthy(), "UART remained healthy after timeout");
  expect_true(!health.sem_meter_healthy(), "SEM Meter remained healthy after timeout");
  expect_true(dispatcher.event_count() == 3, "UART_TIMEOUT did not increment the event counter once");

  const auto continued_outage = health.check_timeout(20300);
  expect_true(continued_outage.event == ComponentEvent::NONE, "continued outage repeated UART_TIMEOUT");
  expect_true(!dispatch_health_update(dispatcher, continued_outage),
              "continued outage dispatched an event");
  expect_true(dispatcher.event_count() == 3, "continued outage incremented the event counter");

  const auto restored = health.record_valid_frame(20400);
  expect_true(restored.event == ComponentEvent::UART_RESTORED,
              "first resumed valid frame did not raise UART_RESTORED");
  expect_true(dispatch_health_update(dispatcher, restored), "UART_RESTORED was not dispatched");
  expect_true(health.state() == ComponentState::RECEIVING_DATA,
              "restored UART did not transition to RECEIVING_DATA");
  expect_true(health.uart_healthy(), "UART was not healthy after restoration");
  expect_true(health.sem_meter_healthy(), "SEM Meter was not healthy after restoration");
  expect_true(dispatcher.event_count() == 4, "UART_RESTORED did not increment the event counter once");

  const auto continued_restored = health.record_valid_frame(20500);
  expect_true(continued_restored.event == ComponentEvent::NONE,
              "continued healthy data repeated UART_RESTORED");
  expect_true(!dispatch_health_update(dispatcher, continued_restored),
              "continued healthy data dispatched an event");
  expect_true(dispatcher.event_count() == 4, "continued healthy data incremented the event counter");
  expect_true(health.milliseconds_since_last_valid_frame(20625) == 125,
              "milliseconds-since-valid-frame getter was incorrect");

  const auto overflow = health.record_buffer_overflow(20650);
  expect_true(overflow.event == ComponentEvent::BUFFER_OVERFLOW,
              "buffer recovery did not raise BUFFER_OVERFLOW");
  expect_true(dispatch_health_update(dispatcher, overflow), "BUFFER_OVERFLOW was not dispatched");
  expect_true(dispatcher.last_event() == ComponentEvent::BUFFER_OVERFLOW,
              "BUFFER_OVERFLOW was not retained as the last event");
  expect_true(dispatcher.event_count() == 5, "BUFFER_OVERFLOW did not increment the event counter");

  const auto malformed = health.record_malformed_frame(20700);
  expect_true(malformed.event == ComponentEvent::MALFORMED_FRAME,
              "zero-record frame did not raise MALFORMED_FRAME");
  expect_true(dispatch_health_update(dispatcher, malformed), "MALFORMED_FRAME was not dispatched");
  expect_true(dispatcher.last_event() == ComponentEvent::MALFORMED_FRAME,
              "MALFORMED_FRAME was not retained as the last event");
  expect_true(dispatcher.last_event_timestamp_ms() == 20700,
              "malformed-frame event timestamp was incorrect");
  expect_true(dispatcher.event_count() == 6, "MALFORMED_FRAME did not increment the event counter");
  expect_true(health.state() == ComponentState::RECEIVING_DATA,
              "fault events unexpectedly changed component state");

  const std::array<ComponentEvent, 6> expected_events{
      ComponentEvent::SYSTEM_STARTED, ComponentEvent::UART_STARTED, ComponentEvent::UART_TIMEOUT,
      ComponentEvent::UART_RESTORED, ComponentEvent::BUFFER_OVERFLOW,
      ComponentEvent::MALFORMED_FRAME};
  expect_true(listener.received_count == expected_events.size(),
              "listener did not receive exactly six ordered events");
  expect_true(!listener.overflowed, "fixed listener test storage overflowed");
  expect_true(std::equal(expected_events.begin(), expected_events.end(), listener.events.begin()),
              "listener event ordering was incorrect");
  expect_true(listener.timestamps[0] == 100 && listener.timestamps[5] == 20700,
              "listener event timestamps were incorrect");
  std::cout << "[PASS] bounded listener dispatch, ordering, state, and anti-spam behavior are correct\n";
}

void test_wrap_safe_uart_timeout() {
  SEMMeterHealthTracker health;
  health.setup_completed(0xFFFFFE00U);
  const uint32_t valid_frame_time = 0xFFFFFF00U;
  health.record_valid_frame(valid_frame_time);
  const uint32_t timeout_time = valid_frame_time + DEFAULT_UART_TIMEOUT_MS;

  expect_true(health.check_timeout(timeout_time).event == ComponentEvent::UART_TIMEOUT,
              "millis wrap prevented UART timeout");
  expect_true(health.milliseconds_since_last_valid_frame(timeout_time) == DEFAULT_UART_TIMEOUT_MS,
              "millis wrap produced an incorrect elapsed time");
  std::cout << "[PASS] UART timeout arithmetic remains wrap-safe\n";
}

void test_non_recursive_event_dispatch() {
  SEMMeterEventDispatcher dispatcher;
  ReentrantEventListener listener(&dispatcher);
  expect_true(dispatcher.register_event_listener(&listener),
              "reentrant test listener registration failed");
  expect_true(dispatcher.dispatch(ComponentEvent::SYSTEM_STARTED, 50),
              "outer event dispatch failed");
  expect_true(listener.callback_count == 1, "listener callback was invoked recursively");
  expect_true(!listener.nested_dispatch_accepted, "nested event dispatch was accepted");
  expect_true(dispatcher.event_count() == 1, "nested dispatch incremented the event counter");
  expect_true(dispatcher.last_event() == ComponentEvent::SYSTEM_STARTED,
              "nested dispatch replaced the last event");
  std::cout << "[PASS] event dispatch rejects recursive listener dispatch\n";
}

void test_retained_overlap(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  session.feed(frame);
  expect_true(session.accumulator.buffered_size() == RECORD_OVERLAP_SIZE, "retained overlap was not 22 bytes");
  expect_true(std::equal(session.accumulator.buffered_data(),
                         session.accumulator.buffered_data() + RECORD_OVERLAP_SIZE,
                         frame.end() - RECORD_OVERLAP_SIZE),
              "retained overlap does not match the final 22 frame bytes");
  std::cout << "[PASS] frame consumption retains the exact final 22 bytes\n";
}

void test_idle_record_reset(const std::vector<uint8_t> &frame) {
  size_t active_record_offset = frame.size();
  for (size_t offset = 0; offset + esphome::sem_meter::RECORD_MINIMUM_SIZE <= frame.size(); offset++) {
    if (SEMMeterRecordParser::is_marker(frame[offset]) && frame[offset + 1] == 0x01 &&
        SEMMeterRecordParser::is_valid_status(frame[offset + 2]) && frame[offset + 2] != STATUS_IDLE) {
      active_record_offset = offset;
      break;
    }
  }
  expect_true(active_record_offset < frame.size(), "could not find active Circuit 2 record");

  SEMMeterFrameAccumulator accumulator;
  auto &parser = accumulator.parser();
  expect_true(parser.decode_record(0x01, frame.data() + active_record_offset + 2,
                                   esphome::sem_meter::RECORD_PAYLOAD_SIZE),
              "active record decode failed");
  expect_true(parser.get_branch_power(1) > 0.0f, "active record did not set Circuit 2 power");

  std::vector<uint8_t> idle_payload(frame.begin() + active_record_offset + 2,
                                    frame.begin() + active_record_offset + 2 +
                                        esphome::sem_meter::RECORD_PAYLOAD_SIZE);
  idle_payload[0] = STATUS_IDLE;
  expect_true(parser.decode_record(0x01, idle_payload.data(), idle_payload.size()), "idle record decode failed");
  expect_near(parser.get_branch_power(1), 0.0f, 0.01f, "idle Circuit 2 power");
  std::cout << "[PASS] idle status 0x01 resets an active power channel to zero\n";
}

}  // namespace

int main(int argc, char **argv) {
  try {
    const std::string fixture_path = argc > 1 ? argv[1] : "tests/captured_frame_001.hex";
    const std::vector<uint8_t> frame = load_hex_file(fixture_path);
    expect_true(frame.size() == COMPLETE_FRAME_SIZE,
                "fixture must contain exactly 447 bytes; got " + std::to_string(frame.size()));
    std::cout << "[PASS] fixture length: " << frame.size() << " bytes\n";
    std::cout << "[PASS] shared limits: MAX_BUFFER_SIZE=" << MAX_BUFFER_SIZE
              << ", overlap=" << RECORD_OVERLAP_SIZE << " bytes\n";

    test_chunked_replay(frame);
    test_bytewise_replay(frame);
    test_garbage_prefix_recovery(frame);
    test_half_frame_start_recovery(frame);
    test_back_to_back_frames(frame);
    test_buffer_recovery(frame);
    test_embedded_false_circuit_1_candidate(frame);
    test_duplicate_circuit_1_candidate_inside_payload(frame);
    test_inserted_and_deleted_byte_recovery(frame);
    test_corrupted_record_headers_recover(frame);
    test_transactional_power_validation(frame);
    test_malformed_and_partial_counters();
    test_malformed_cycle_episode_deduplication(frame);
    test_timing_statistics();
    test_diagnostic_string_conversions();
    test_sensor_value_validation();
    test_startup_measurement_readiness();
    test_uart_health_transitions();
    test_wrap_safe_uart_timeout();
    test_non_recursive_event_dispatch();
    test_retained_overlap(frame);
    test_idle_record_reset(frame);
    test_yaml_entity_names();

    std::cout << "[PASS] all SEM Meter shared-accumulator replay tests passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "[FAIL] " << error.what() << '\n';
    return 1;
  }
}
