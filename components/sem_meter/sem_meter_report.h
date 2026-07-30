#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>

#include "sem_meter_diagnostics.h"
#include "sem_meter_foundation.h"

namespace esphome::sem_meter {

inline constexpr size_t DIAGNOSTIC_REPORT_PART_COUNT = 3;
inline constexpr size_t DIAGNOSTIC_REPORT_PART_MAX_LENGTH = 220;
inline constexpr char DIAGNOSTIC_REPORT_UNUSED_PART[] = "NONE";
inline constexpr uint8_t DIAGNOSTIC_REPORT_FORMAT_VERSION = 1;

struct DiagnosticReportSnapshot {
  const char *component_version{nullptr};
  const char *esphome_version{nullptr};
  const char *hardware_profile{nullptr};
  const char *board_variant{nullptr};
  const char *reset_reason{nullptr};
  bool parser_health_known{false};
  bool parser_healthy{false};
  bool wifi_health_known{false};
  bool wifi_healthy{false};
  bool home_assistant_state_known{false};
  bool home_assistant_online{false};
  SelfTestStatus self_test_status{SelfTestStatus::NOT_RUN};
  SEMMeterRuntimeCounterValues counters{};
  bool parser_outage_known{false};
  uint32_t parser_outage_duration_ms{0};
  bool wifi_outage_known{false};
  uint32_t wifi_outage_duration_ms{0};
};

struct DiagnosticReportParts {
  std::array<std::string, DIAGNOSTIC_REPORT_PART_COUNT> values{
      DIAGNOSTIC_REPORT_UNUSED_PART, DIAGNOSTIC_REPORT_UNUSED_PART,
      DIAGNOSTIC_REPORT_UNUSED_PART};
  size_t used_parts{0};
};

inline const char *diagnostic_known_value(const char *value) {
  return value == nullptr || value[0] == '\0' ? "UNKNOWN" : value;
}

inline const char *diagnostic_health_to_string(bool known, bool healthy) {
  return !known ? "UNKNOWN" : (healthy ? "Healthy" : "Unhealthy");
}

inline const char *diagnostic_online_to_string(bool known, bool online) {
  return !known ? "UNKNOWN" : (online ? "Online" : "Offline");
}

inline const char *diagnostic_self_test_to_string(SelfTestStatus status) {
  switch (status) {
    case SelfTestStatus::NOT_RUN:
      return "NOT_RUN";
    case SelfTestStatus::PASS:
      return "PASS";
    case SelfTestStatus::FAIL:
      return "FAIL";
    case SelfTestStatus::RUNNING:
      return "UNKNOWN";
  }
  return "UNKNOWN";
}

class SEMMeterDiagnosticReportGenerator {
 public:
  bool begin_generation() {
    if (this->generating_) {
      return false;
    }
    this->generating_ = true;
    return true;
  }

  void finish_generation() { this->generating_ = false; }
  bool generating() const { return this->generating_; }

  static std::string build_diagnostic_report(
      const DiagnosticReportSnapshot &snapshot) {
    std::string report;
    report.reserve(640);
    append_block_(report,
                  "==================================\n"
                  "SEM Meter Diagnostic Report\n"
                  "==================================");
    append_field_(report, "Report Format",
                  std::to_string(DIAGNOSTIC_REPORT_FORMAT_VERSION));
    append_field_(report, "Component Version",
                  diagnostic_known_value(snapshot.component_version));
    append_field_(report, "ESPHome Version",
                  diagnostic_known_value(snapshot.esphome_version));
    append_field_(report, "Hardware Profile",
                  diagnostic_known_value(snapshot.hardware_profile));
    append_field_(report, "Board Variant",
                  diagnostic_known_value(snapshot.board_variant));
    append_field_(report, "Reset Reason",
                  diagnostic_known_value(snapshot.reset_reason));
    append_field_(report, "Parser",
                  diagnostic_health_to_string(snapshot.parser_health_known,
                                              snapshot.parser_healthy));
    append_field_(report, "WiFi",
                  diagnostic_health_to_string(snapshot.wifi_health_known,
                                              snapshot.wifi_healthy));
    append_field_(
        report, "Home Assistant",
        diagnostic_online_to_string(snapshot.home_assistant_state_known,
                                    snapshot.home_assistant_online));
    append_field_(report, "Self-Test",
                  diagnostic_self_test_to_string(snapshot.self_test_status));
    append_field_(report, "Parser Faults",
                  std::to_string(snapshot.counters.parser_fault_count));
    append_field_(report, "WiFi Faults",
                  std::to_string(snapshot.counters.wifi_fault_count));
    append_field_(report, "Self-Test Runs",
                  std::to_string(snapshot.counters.self_test_run_count));
    append_field_(report, "Self-Test Failures",
                  std::to_string(snapshot.counters.self_test_failure_count));
    append_field_(
        report, "Last Parser Outage",
        snapshot.parser_outage_known
            ? std::to_string(snapshot.parser_outage_duration_ms / 1000U) +
                  " seconds"
            : "UNKNOWN");
    append_field_(
        report, "Last WiFi Outage",
        snapshot.wifi_outage_known
            ? std::to_string(snapshot.wifi_outage_duration_ms / 1000U) +
                  " seconds"
            : "UNKNOWN");
    append_field_(report, "Additional Diagnostics", "None");
    report += "\n\n==================================";
    return report;
  }

  static bool split_report(const std::string &report,
                           DiagnosticReportParts &parts) {
    parts = {};
    size_t part_index = 0;
    size_t block_start = 0;

    while (block_start < report.size()) {
      size_t block_end = report.find("\n\n", block_start);
      block_end =
          block_end == std::string::npos ? report.size() : block_end + 2U;
      const size_t block_length = block_end - block_start;
      if (block_length > DIAGNOSTIC_REPORT_PART_MAX_LENGTH) {
        return false;
      }
      if (part_index >= DIAGNOSTIC_REPORT_PART_COUNT) {
        return false;
      }
      if (!parts.values[part_index].empty() &&
          parts.values[part_index] != DIAGNOSTIC_REPORT_UNUSED_PART &&
          parts.values[part_index].size() + block_length >
              DIAGNOSTIC_REPORT_PART_MAX_LENGTH) {
        part_index++;
        if (part_index >= DIAGNOSTIC_REPORT_PART_COUNT) {
          return false;
        }
      }
      if (parts.values[part_index] == DIAGNOSTIC_REPORT_UNUSED_PART) {
        parts.values[part_index].clear();
      }
      parts.values[part_index].append(report, block_start, block_length);
      block_start = block_end;
    }

    parts.used_parts = part_index + 1U;
    for (size_t index = parts.used_parts;
         index < DIAGNOSTIC_REPORT_PART_COUNT; index++) {
      parts.values[index] = DIAGNOSTIC_REPORT_UNUSED_PART;
    }
    return true;
  }

 private:
  static void append_block_(std::string &report, const std::string &block) {
    if (!report.empty()) {
      report += "\n\n";
    }
    report += block;
  }

  static void append_field_(std::string &report, const char *label,
                            const std::string &value) {
    append_block_(report, std::string(label) + "\n" + value);
  }

  bool generating_{false};
};

}  // namespace esphome::sem_meter
