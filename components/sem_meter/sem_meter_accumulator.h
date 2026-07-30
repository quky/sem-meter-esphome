#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

#include "sem_meter_diagnostics.h"
#include "sem_meter_parser.h"
#include "sem_meter_validator.h"

namespace esphome::sem_meter {

inline constexpr size_t MAX_BYTES_PER_LOOP = 128;
inline constexpr size_t MAX_FRAMES_PER_LOOP = 1;
inline constexpr size_t MAX_BUFFER_SIZE = COMPLETE_FRAME_SIZE * 2;

struct SEMMeterFeedResult {
  size_t bytes_dropped{0};
  size_t frames_processed{0};
  size_t decoded_records{0};
  size_t structural_cycle_rejections{0};
  size_t malformed_frames{0};
  size_t validation_rejections{0};
  MeasurementId rejected_measurement{MeasurementId::NONE};
  float rejected_value{0.0f};
  ValidationFailureReason rejection_reason{ValidationFailureReason::NONE};
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
  SEMMeterFeedResult feed(const uint8_t *data, size_t size, SEMMeterAccumulatorObserver *observer = nullptr,
                          SEMMeterDiagnostics *diagnostics = nullptr,
                          SEMMeterValidator *cycle_validator = nullptr,
                          uint32_t timestamp_ms = 0) {
    SEMMeterFeedResult result;
    if (diagnostics != nullptr) {
      diagnostics->record_feed_call(data != nullptr ? size : 0);
    }
    this->append_(data, size, result);
    if (diagnostics != nullptr) {
      diagnostics->record_buffer_recovery(result.bytes_dropped);
    }

    static_assert(MAX_FRAMES_PER_LOOP == 1,
                  "feed() is designed to process exactly one frame at most");
    this->process_buffer_(result, observer, diagnostics, cycle_validator, timestamp_ms);

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
      this->clear_malformed_episode_();
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
    this->advance_malformed_episode_(bytes_to_drop);
    result.bytes_dropped += bytes_to_drop;
  }

  static bool is_circuit_1_candidate_(const uint8_t *data, size_t offset) {
    return SEMMeterRecordParser::is_marker(data[offset]) && data[offset + 1] == 0x00 &&
           SEMMeterRecordParser::is_valid_status(data[offset + 2]);
  }

  bool validate_record_sequence_(size_t sequence_offset, size_t &failed_offset,
                                 uint8_t &failed_record_id, uint8_t &failed_status) const {
    for (size_t record_index = 0; record_index < RECORD_COUNT; record_index++) {
      const size_t record_offset = sequence_offset + record_index * RECORD_CADENCE_SIZE;
      const uint8_t record_id = this->buffer_[record_offset + 1];
      const uint8_t status = this->buffer_[record_offset + 2];
      if (!SEMMeterRecordParser::is_marker(this->buffer_[record_offset]) ||
          record_id != record_index || !SEMMeterRecordParser::is_valid_status(status)) {
        failed_offset = record_offset;
        failed_record_id = record_id;
        failed_status = status;
        return false;
      }
    }
    return true;
  }

  size_t decode_record_sequence_(size_t sequence_offset,
                                 SEMMeterRecordParser &destination) const {
    size_t decoded_records = 0;
    for (size_t record_index = 0; record_index < RECORD_COUNT; record_index++) {
      const size_t record_offset = sequence_offset + record_index * RECORD_CADENCE_SIZE;
      const uint8_t record_id = this->buffer_[record_offset + 1];
      if (destination.decode_record(record_id, this->buffer_.data() + record_offset + 2,
                                    RECORD_PAYLOAD_SIZE)) {
        decoded_records++;
      }
    }
    return decoded_records;
  }

  void notify_decoded_sequence_(size_t sequence_offset,
                                SEMMeterAccumulatorObserver *observer,
                                SEMMeterDiagnostics *diagnostics) const {
    for (size_t record_index = 0; record_index < RECORD_COUNT; record_index++) {
      const size_t record_offset = sequence_offset + record_index * RECORD_CADENCE_SIZE;
      const uint8_t marker = this->buffer_[record_offset];
      const uint8_t record_id = this->buffer_[record_offset + 1];
      const uint8_t status = this->buffer_[record_offset + 2];
      if (diagnostics != nullptr) {
        diagnostics->record_decoded_record(status == STATUS_IDLE);
      }
      if (observer != nullptr) {
        observer->on_decoded_record(record_offset, marker, record_id, status);
      }
    }
  }

  void process_buffer_(SEMMeterFeedResult &result, SEMMeterAccumulatorObserver *observer,
                       SEMMeterDiagnostics *diagnostics,
                       SEMMeterValidator *cycle_validator, uint32_t timestamp_ms) {
    size_t search_offset = 0;
    while (search_offset + 2 < this->buffer_size_) {
      if (!is_circuit_1_candidate_(this->buffer_.data(), search_offset)) {
        search_offset++;
        continue;
      }

      if (this->buffer_size_ - search_offset < RECORD_SEQUENCE_SIZE) {
        if (!this->waiting_for_sequence_) {
          if (diagnostics != nullptr) {
            diagnostics->record_partial_record();
          }
          if (observer != nullptr) {
            observer->on_partial_record(search_offset);
          }
        }
        this->waiting_for_sequence_ = true;
        this->discard_prefix_(search_offset);
        return;
      }

      size_t failed_offset = 0;
      uint8_t failed_record_id = 0;
      uint8_t failed_status = 0;
      if (!this->validate_record_sequence_(search_offset, failed_offset, failed_record_id,
                                           failed_status)) {
        this->waiting_for_sequence_ = false;
        result.structural_cycle_rejections++;
        this->record_malformed_cycle_(search_offset, result, diagnostics);
        if (diagnostics != nullptr) {
          diagnostics->record_malformed_candidate();
          diagnostics->record_structural_cycle_rejection();
        }
        if (observer != nullptr) {
          observer->on_malformed_candidate(failed_offset, failed_record_id, failed_status);
        }
        search_offset++;
        continue;
      }

      SEMMeterRecordParser candidate_parser = this->parser_;
      const size_t candidate_records =
          this->decode_record_sequence_(search_offset, candidate_parser);
      if (candidate_records != RECORD_COUNT) {
        this->waiting_for_sequence_ = false;
        result.structural_cycle_rejections++;
        this->record_malformed_cycle_(search_offset, result, diagnostics);
        search_offset++;
        continue;
      }

      if (cycle_validator != nullptr) {
        const SEMMeterCycleValidationResult validation =
            validate_candidate_cycle_transactionally(*cycle_validator, candidate_parser,
                                                     timestamp_ms);
        if (!validation.valid) {
          result.validation_rejections = 1;
          result.rejected_measurement = validation.rejected_measurement;
          result.rejected_value = validation.rejected_value;
          result.rejection_reason = validation.rejection_reason;
          this->waiting_for_sequence_ = false;
          this->clear_malformed_episode_();
          this->consume_sequence_(search_offset);
          return;
        }
      }

      this->parser_ = candidate_parser;
      result.decoded_records = candidate_records;
      this->notify_decoded_sequence_(search_offset, observer, diagnostics);
      this->waiting_for_sequence_ = false;
      this->clear_malformed_episode_();
      result.frames_processed = 1;
      if (diagnostics != nullptr) {
        diagnostics->record_frame_processed(result.decoded_records);
      }
      this->consume_sequence_(search_offset);
      return;
    }

    this->waiting_for_sequence_ = false;
    this->retain_split_header_();
  }

  void discard_prefix_(size_t prefix_size) {
    if (prefix_size == 0) {
      return;
    }
    const size_t remaining_size = this->buffer_size_ - prefix_size;
    std::memmove(this->buffer_.data(), this->buffer_.data() + prefix_size, remaining_size);
    this->buffer_size_ = remaining_size;
    this->advance_malformed_episode_(prefix_size);
  }

  void retain_split_header_() {
    constexpr size_t SPLIT_HEADER_BYTES = 2;
    if (this->buffer_size_ <= SPLIT_HEADER_BYTES) {
      return;
    }
    std::memmove(this->buffer_.data(),
                 this->buffer_.data() + this->buffer_size_ - SPLIT_HEADER_BYTES,
                 SPLIT_HEADER_BYTES);
    this->advance_malformed_episode_(this->buffer_size_ - SPLIT_HEADER_BYTES);
    this->buffer_size_ = SPLIT_HEADER_BYTES;
  }

  void consume_sequence_(size_t sequence_offset) {
    const size_t sequence_end = sequence_offset + RECORD_SEQUENCE_SIZE;
    const size_t consumed_size = sequence_end - RECORD_OVERLAP_SIZE;
    const size_t remaining_size = this->buffer_size_ - consumed_size;
    std::memmove(this->buffer_.data(), this->buffer_.data() + consumed_size, remaining_size);
    this->buffer_size_ = remaining_size;
  }

  void record_malformed_cycle_(size_t candidate_offset, SEMMeterFeedResult &result,
                               SEMMeterDiagnostics *diagnostics) {
    if (this->malformed_episode_active_ &&
        candidate_offset < this->malformed_episode_end_offset_) {
      return;
    }
    this->malformed_episode_active_ = true;
    this->malformed_episode_end_offset_ = candidate_offset + RECORD_SEQUENCE_SIZE;
    result.malformed_frames++;
    if (diagnostics != nullptr) {
      diagnostics->record_malformed_frame();
    }
  }

  void advance_malformed_episode_(size_t consumed_bytes) {
    if (!this->malformed_episode_active_) {
      return;
    }
    if (consumed_bytes >= this->malformed_episode_end_offset_) {
      this->clear_malformed_episode_();
      return;
    }
    this->malformed_episode_end_offset_ -= consumed_bytes;
  }

  void clear_malformed_episode_() {
    this->malformed_episode_active_ = false;
    this->malformed_episode_end_offset_ = 0;
  }

  std::array<uint8_t, MAX_BUFFER_SIZE> buffer_{};
  size_t buffer_size_{0};
  bool waiting_for_sequence_{false};
  bool malformed_episode_active_{false};
  size_t malformed_episode_end_offset_{0};
  SEMMeterRecordParser parser_{};
};

}  // namespace esphome::sem_meter
