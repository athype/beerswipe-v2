"""PN532 debug probe: DTR/RTS reset combos + raw byte dump.

For bring-up when the chip does not answer the normal probe.  Some
USB-C PN532 dongles wire the CH340's DTR line to the chip's RSTPDN
(power-down, active low), and pyserial opens the port with DTR
deasserted, leaving the chip asleep.  This script tries every reset
combination and dumps the raw bytes so we can see what wakes it.

Usage (from the ``kiosk/`` directory)::

    uv run python debug_pn532.py            # default COM7
    uv run python debug_pn532.py COM5       # explicit port
"""

import sys
import time

import serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM7"
WAKEUP = b"\x55\x55" + b"\x00" * 7
FW_CMD = bytes.fromhex("0000ff02fed4022a00")  # GetFirmwareVersion frame


def dump(label: str, ser: serial.Serial) -> None:
    data = ser.read(64)
    print(f"{label}: {data.hex() if data else '<nothing>'}")


def main() -> int:
    ser = serial.Serial(PORT, 115200, timeout=1.0)
    print(f"opened {PORT}")

    # 1. baseline: pyserial defaults (DTR/RTS deasserted)
    ser.write(WAKEUP)
    time.sleep(0.2)
    ser.write(FW_CMD)
    ser.flush()
    dump("1. wakeup+firmware, DTR off", ser)

    # 2. DTR asserted: brings the chip out of power-down if wired to RSTPDN
    ser.dtr = True
    time.sleep(0.3)
    ser.reset_input_buffer()
    ser.write(WAKEUP)
    time.sleep(0.2)
    ser.write(FW_CMD)
    ser.flush()
    dump("2. wakeup+firmware, DTR ON", ser)

    # 3. reset pulse: DTR high -> low -> high (capacitor-style reset)
    ser.dtr = False
    time.sleep(0.2)
    ser.dtr = True
    time.sleep(0.3)
    ser.reset_input_buffer()
    ser.write(WAKEUP)
    time.sleep(0.2)
    ser.write(FW_CMD)
    ser.flush()
    dump("3. after DTR reset pulse + probe", ser)

    # 4. same idea with RTS
    ser.rts = True
    time.sleep(0.2)
    ser.rts = False
    time.sleep(0.2)
    ser.write(WAKEUP)
    time.sleep(0.2)
    ser.write(FW_CMD)
    ser.flush()
    dump("4. after RTS pulse + probe", ser)

    # 5. baud sweep: a vendor-flashed chip may run HSU at a nonstandard
    # speed, in which case 115200 commands get nothing while the chip
    # waits at its own baud. Listen passively, then probe, at each rate.
    for baud in (9600, 19200, 57600, 230400):
        try:
            ser.baudrate = baud
            ser.reset_input_buffer()
            time.sleep(0.2)

            ser.timeout = 0.5
            data = ser.read(32)
            passive = data.hex() if data else "<nothing>"

            ser.write(WAKEUP)
            time.sleep(0.2)
            ser.write(FW_CMD)
            ser.flush()
            ser.timeout = 1.0
            data = ser.read(64)
            print(
                f"5. @{baud}: passive={passive} "
                f"probe={data.hex() if data else '<nothing>'}",
            )
        except serial.SerialException as exc:
            print(f"5. @{baud}: skipped ({exc})")

    ser.close()
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
