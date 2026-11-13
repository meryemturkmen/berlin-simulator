import { describe, expect, it } from "vitest";
import { chooseQuality, lowerQuality } from "@/lib/quality";

describe("chooseQuality", () => {
  it("drops to low on software renderers", () => {
    const device = {
      renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))",
      touch: false,
      cores: 16,
    };
    expect(chooseQuality(device)).toBe("low");
    expect(chooseQuality({ ...device, renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" })).toBe("low");
  });

  it("gives phones medium and capable desktops high", () => {
    expect(chooseQuality({ renderer: "Apple GPU", touch: true, cores: 6 })).toBe("medium");
    expect(
      chooseQuality({ renderer: "ANGLE (Apple, Apple M2)", touch: false, cores: 8, memory: 8 }),
    ).toBe("high");
  });

  it("is careful with weak hardware", () => {
    expect(chooseQuality({ renderer: "Mali-G52", touch: true, cores: 2 })).toBe("low");
    expect(chooseQuality({ renderer: "Intel UHD", touch: false, cores: 4 })).toBe("medium");
    expect(chooseQuality({ renderer: "Intel UHD", touch: false, cores: 8, memory: 2 })).toBe("low");
  });

  it("steps down one level at a time and stops at low", () => {
    expect(lowerQuality("high")).toBe("medium");
    expect(lowerQuality("medium")).toBe("low");
    expect(lowerQuality("low")).toBe("low");
  });
});
