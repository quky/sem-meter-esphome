#pragma once

#include <cstddef>
#include <cstdint>

#include "esphome/components/uart/uart.h"
#include "esphome/core/component.h"
#include "sem_meter_accumulator.h"

namespace esphome::sem_meter {

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

  float get_branch_power(size_t index) const { return this->accumulator_.parser().get_branch_power(index); }
  float get_phase_a_power() const { return this->accumulator_.parser().get_phase_a_power(); }
  float get_phase_b_power() const { return this->accumulator_.parser().get_phase_b_power(); }
  float get_phase_c_power() const { return this->accumulator_.parser().get_phase_c_power(); }
  float get_phase_a_voltage() const { return this->accumulator_.parser().get_phase_a_voltage(); }
  float get_phase_b_voltage() const { return this->accumulator_.parser().get_phase_b_voltage(); }
  float get_line_frequency() const { return this->accumulator_.parser().get_line_frequency(); }

 protected:
  void on_partial_record(size_t offset) override;
  void on_malformed_candidate(size_t offset, uint8_t record_id, uint8_t status) override;
  void on_decoded_record(size_t offset, uint8_t marker, uint8_t record_id, uint8_t status) override;

  SEMMeterFrameAccumulator accumulator_{};
};

}  // namespace esphome::sem_meter
