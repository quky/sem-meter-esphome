#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

#include "sem_meter_parser.h"

namespace esphome::sem_meter {

inline constexpr size_t MAX_BYTES_PER_LOOP = 128;
inline constexpr size_t MAX_FRAMES_PER_LOOP = 1;
inline constexpr size_t MAX_BUFFER_SIZE = COMPLETE_FRAME_SIZE * 2;

struct SEMMeterFeedResult {
  size_t bytes_dropped{0};
  size_t frames_processed{0};
  size_t decoded_records{0};
};

class SEMMeterAccumulatorObserver {
 public:
  virtual ~SEMMeterAccumulatorObserver() = default;
  virtual void on_partial_record(size_t) {}
  virtual void on_malformed_candidate(size_t, uint8_t, uint8_t) {}
  virtual void on_decoded_record(size_t, uint8_t, uint8_t, uint8_t) {}
};

class SEMMeterFrameAccumulator {
 public:
  SEMMeterFeedResult feed(const uint8_t *data, size_t size, SEMMeterAccumulatorObserver *observer = nullptr) {
    SEMMeterFeedResult result;
    this->append_(data, size, result);

    static_assert(MAX_FRAMES_PER_LOOP == 1, "feed() is designed to process exactly one frame at most");
    if (this->buffer_size_ >= COMPLETE_FRAME_SIZE) {
      result.decoded_records = this->decode_frame_(this->buffer_.data(), COMPLETE_FRAME_SIZE, observer);
      this->consume_frame_();
      result.frames_processed = 1;
    }

    return result;
  }

  const SEMMeterRecordParser &parser() const { return this->parser_; }
  SEMMeterRecordParser &parser() { return this->parser_; }
  size_t buffered_size() const { return this->buffer_size_; }
  const uint8_t *buffered_data() const { return this->buffer_.data(); }

 private:
  void append_(const uint8_t *data, size_t size, SEMMeterFeedResult &result) {
    if (size == 0) {
      return;
    }
    if (data == nullptr) {
      result.bytes_dropped += size;
      return;
    }

    if (size >= MAX_BUFFER_SIZE) {
      const size_t input_prefix_to_drop = size - MAX_BUFFER_SIZE;
      result.bytes_dropped += this->buffer_size_ + input_prefix_to_drop;
      this->buffer_size_ = 0;
      data += input_prefix_to_drop;
      size = MAX_BUFFER_SIZE;
    }

    this->make_room_for_(size, result);
    std::memcpy(this->buffer_.data() + this->buffer_size_, data, size);
    this->buffer_size_ += size;
  }

  void make_room_for_(size_t incoming_size, SEMMeterFeedResult &result) {
    if (this->buffer_size_ + incoming_size <= MAX_BUFFER_SIZE) {
      return;
    }

    const size_t bytes_to_drop = this->buffer_size_ + incoming_size - MAX_BUFFER_SIZE;
    std::memmove(this->buffer_.data(), this->buffer_.data() + bytes_to_drop, this->buffer_size_ - bytes_to_drop);
    this->buffer_size_ -= bytes_to_drop;
    result.bytes_dropped += bytes_to_drop;
  }

  size_t decode_frame_(const uint8_t *data, size_t size, SEMMeterAccumulatorObserver *observer) {
    size_t decoded_records = 0;

    for (size_t offset = 0; offset < size; offset++) {
      if (!SEMMeterRecordParser::is_marker(data[offset])) {
        continue;
      }

      const size_t remaining = size - offset;
      if (remaining < RECORD_MINIMUM_SIZE) {
        if (observer != nullptr) {
          observer->on_partial_record(offset);
        }
        break;
      }

      const uint8_t record_id = data[offset + 1];
      const uint8_t status = data[offset + 2];
      if (record_id > LAST_RECORD_ID || !SEMMeterRecordParser::is_valid_status(status)) {
        if (observer != nullptr) {
          observer->on_malformed_candidate(offset, record_id, status);
        }
        continue;
      }

      if (this->parser_.decode_record(record_id, data + offset + 2, remaining - 2)) {
        decoded_records++;
        if (observer != nullptr) {
          observer->on_decoded_record(offset, data[offset], record_id, status);
        }
      }
    }

    return decoded_records;
  }

  void consume_frame_() {
    const size_t consumed_size = COMPLETE_FRAME_SIZE - RECORD_OVERLAP_SIZE;
    const size_t remaining_size = this->buffer_size_ - consumed_size;
    std::memmove(this->buffer_.data(), this->buffer_.data() + consumed_size, remaining_size);
    this->buffer_size_ = remaining_size;
  }

  std::array<uint8_t, MAX_BUFFER_SIZE> buffer_{};
  size_t buffer_size_{0};
  SEMMeterRecordParser parser_{};
};

}  // namespace esphome::sem_meter
