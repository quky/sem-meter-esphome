#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "sem_meter_accumulator.h"

namespace {

using esphome::sem_meter::COMPLETE_FRAME_SIZE;
using esphome::sem_meter::MARKER_PRIMARY;
using esphome::sem_meter::MARKER_SECONDARY;
using esphome::sem_meter::MAX_BUFFER_SIZE;
using esphome::sem_meter::RECORD_OVERLAP_SIZE;
using esphome::sem_meter::SEMMeterAccumulatorObserver;
using esphome::sem_meter::SEMMeterFeedResult;
using esphome::sem_meter::SEMMeterFrameAccumulator;
using esphome::sem_meter::SEMMeterRecordParser;
using esphome::sem_meter::STATUS_IDLE;

class TrackingObserver final : public SEMMeterAccumulatorObserver {
 public:
  void on_decoded_record(size_t, uint8_t marker, uint8_t, uint8_t) override {
    if (marker == MARKER_PRIMARY) {
      this->primary_records++;
    } else if (marker == MARKER_SECONDARY) {
      this->secondary_records++;
    }
  }

  size_t primary_records{0};
  size_t secondary_records{0};
};

class ReplaySession {
 public:
  SEMMeterFeedResult feed(const uint8_t *data, size_t size) {
    const SEMMeterFeedResult result = this->accumulator.feed(data, size, &this->observer);
    this->bytes_dropped += result.bytes_dropped;
    this->frames_processed += result.frames_processed;
    this->decoded_records += result.decoded_records;
    expect_bounded();
    return result;
  }

  SEMMeterFeedResult feed(const std::vector<uint8_t> &bytes) { return this->feed(bytes.data(), bytes.size()); }

  void expect_bounded() const {
    if (this->accumulator.buffered_size() > MAX_BUFFER_SIZE) {
      throw std::runtime_error("shared accumulator exceeded MAX_BUFFER_SIZE");
    }
  }

  SEMMeterFrameAccumulator accumulator;
  TrackingObserver observer;
  size_t bytes_dropped{0};
  size_t frames_processed{0};
  size_t decoded_records{0};
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
  expect_true(session.frames_processed == 1, "bytewise replay did not process exactly one frame");
  expect_true(session.decoded_records == 19, "bytewise replay did not decode 19 records");
  verify_recovered_measurements(session, "one-byte replay");
  std::cout << "[PASS] one-byte-at-a-time replay uses the shared accumulator\n";
}

void test_garbage_prefix_recovery(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  const std::vector<uint8_t> garbage(37, 0xA5);
  session.feed(garbage);
  session.feed(frame);
  session.feed(frame);
  expect_true(session.frames_processed == 2, "garbage-prefix replay did not process two bounded windows");
  verify_recovered_measurements(session, "37-byte garbage prefix recovery");
  std::cout << "[PASS] 37 garbage bytes before valid frames recover successfully\n";
}

void test_half_frame_start_recovery(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  const size_t half_offset = COMPLETE_FRAME_SIZE / 2;
  session.feed(frame.data() + half_offset, frame.size() - half_offset);
  session.feed(frame);
  expect_true(session.frames_processed == 1, "half-frame start did not process one complete window");
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
  expect_true(session.frames_processed == 2, "back-to-back replay did not process two frames");
  expect_true(session.bytes_dropped == 0, "back-to-back frames unexpectedly triggered recovery");
  verify_recovered_measurements(session, "two back-to-back frames");
  std::cout << "[PASS] two back-to-back frames are limited to one frame per feed call\n";
}

void test_buffer_recovery(const std::vector<uint8_t> &frame) {
  ReplaySession session;
  const std::vector<uint8_t> garbage(MAX_BUFFER_SIZE + 106, 0xA5);
  const SEMMeterFeedResult overflow = session.feed(garbage);
  expect_true(overflow.bytes_dropped == 106, "large input did not report the expected dropped prefix");
  expect_true(overflow.frames_processed == 1, "large input did not process exactly one bounded window");
  expect_true(overflow.decoded_records == 0, "garbage unexpectedly decoded records");

  const SEMMeterFeedResult recovery_feed = session.feed(frame);
  expect_true(recovery_feed.bytes_dropped > 0, "full buffer did not exercise make-room recovery");
  session.feed(nullptr, 0);
  verify_recovered_measurements(session, "buffer overflow recovery");
  std::cout << "[PASS] bounded buffer drops old bytes and recovers valid readings\n";
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
    test_retained_overlap(frame);
    test_idle_record_reset(frame);

    std::cout << "[PASS] all SEM Meter shared-accumulator replay tests passed\n";
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "[FAIL] " << error.what() << '\n';
    return 1;
  }
}
