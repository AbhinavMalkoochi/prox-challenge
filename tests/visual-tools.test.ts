import { describe, expect, it } from "vitest";

import {
  buildDutyCycleArtifact,
  buildPolarityArtifact,
  buildTroubleshootingArtifact,
  buildSetupGuideArtifact,
  buildSpecsArtifact,
  buildWeldDiagnosisArtifact,
  executeVisualTool,
} from "../lib/agent/visual-tools";

describe("buildDutyCycleArtifact", () => {
  it("produces valid HTML with correct data", () => {
    const artifact = buildDutyCycleArtifact({
      process: "mig",
      voltage: "240",
      ratings: [
        { amperage: 200, percent: 25, weldMinutes: 2.5, restMinutes: 7.5 },
        { amperage: 115, percent: 100, weldMinutes: 10, restMinutes: 0 },
      ],
      continuousAmperage: 115,
    });

    expect(artifact.type).toBe("text/html");
    expect(artifact.identifier).toBe("duty-cycle-mig-240");
    expect(artifact.title).toContain("MIG");
    expect(artifact.title).toContain("240V");
    expect(artifact.content).toContain("200A");
    expect(artifact.content).toContain("25% duty");
    expect(artifact.content).toContain("115A");
    expect(artifact.content).toContain("100% duty");
    expect(artifact.content).toContain("2.5 min weld");
    expect(artifact.content).toContain("Continuous welding");
    expect(artifact.content).toContain("115A");
    expect(artifact.content).toContain("<!DOCTYPE html>");
  });

  it("omits continuous note when not provided", () => {
    const artifact = buildDutyCycleArtifact({
      process: "tig",
      voltage: "120",
      ratings: [{ amperage: 125, percent: 40, weldMinutes: 4, restMinutes: 6 }],
    });

    expect(artifact.content).not.toContain("continuous (100%) use");
  });

  it("uses green badge for 100% duty cycle", () => {
    const artifact = buildDutyCycleArtifact({
      process: "stick",
      voltage: "240",
      ratings: [{ amperage: 100, percent: 100, weldMinutes: 10, restMinutes: 0 }],
    });

    expect(artifact.content).toContain("badge-green");
  });

  it("uses amber badge for duty cycles below 40%", () => {
    const artifact = buildDutyCycleArtifact({
      process: "mig",
      voltage: "240",
      ratings: [{ amperage: 200, percent: 25, weldMinutes: 2.5, restMinutes: 7.5 }],
    });

    expect(artifact.content).toContain("badge-amber");
  });
});

describe("buildPolarityArtifact", () => {
  it("produces correct connections for TIG welding", () => {
    const artifact = buildPolarityArtifact({
      process: "tig",
      connections: [
        { cable: "Ground Clamp Cable", socket: "Positive (+) Socket", polarity: "positive" },
        { cable: "TIG Torch Cable", socket: "Negative (−) Socket", polarity: "negative" },
      ],
      notes: ["Twist cables clockwise to lock in place"],
    });

    expect(artifact.type).toBe("text/html");
    expect(artifact.identifier).toBe("polarity-tig");
    expect(artifact.content).toContain("Ground Clamp Cable");
    expect(artifact.content).toContain("TIG Torch Cable");
    expect(artifact.content).toContain("Positive (+) Socket");
    expect(artifact.content).toContain("Negative");
    expect(artifact.content).toContain("Twist cables clockwise");
    expect(artifact.content).toContain("#ef4444");
    expect(artifact.content).toContain("#3b82f6");
  });

  it("handles no notes gracefully", () => {
    const artifact = buildPolarityArtifact({
      process: "mig",
      connections: [
        { cable: "Ground Clamp", socket: "Negative Socket", polarity: "negative" },
      ],
    });

    expect(artifact.content).not.toContain('<div class="polarity-note');
    expect(artifact.content).toContain("Ground Clamp");
  });
});

describe("buildTroubleshootingArtifact", () => {
  it("produces interactive troubleshooting with progress bar", () => {
    const artifact = buildTroubleshootingArtifact({
      problem: "Porosity in MIG Welds",
      checks: [
        { cause: "Insufficient gas flow", solution: "Increase flow of gas. Clean nozzle." },
        { cause: "Dirty workpiece", solution: "Clean workpiece down to bare metal." },
        { cause: "Incorrect polarity", solution: "Check polarity is set to DCEP for MIG." },
      ],
    });

    expect(artifact.type).toBe("text/html");
    expect(artifact.title).toContain("Porosity");
    expect(artifact.content).toContain("Insufficient gas flow");
    expect(artifact.content).toContain("Dirty workpiece");
    expect(artifact.content).toContain("Incorrect polarity");
    expect(artifact.content).toContain("toggleStep");
    expect(artifact.content).toContain("checkStep");
    expect(artifact.content).toContain("ts-progress-fill");
    expect(artifact.content).toContain("0/3 checked");
  });
});

describe("buildSetupGuideArtifact", () => {
  it("produces step-by-step guide with warnings", () => {
    const artifact = buildSetupGuideArtifact({
      process: "tig",
      title: "TIG Welding Setup",
      steps: [
        { instruction: "Turn Power Switch OFF", warning: "Ensure welder is unplugged" },
        { instruction: "Connect Ground Clamp to Positive Socket", detail: "Twist clockwise to lock" },
        { instruction: "Connect TIG Torch to Negative Socket" },
      ],
    });

    expect(artifact.type).toBe("text/html");
    expect(artifact.title).toBe("TIG Welding Setup");
    expect(artifact.content).toContain("Turn Power Switch OFF");
    expect(artifact.content).toContain("Ensure welder is unplugged");
    expect(artifact.content).toContain("Twist clockwise to lock");
    expect(artifact.content).toContain("completeStep");
    expect(artifact.content).toContain("sg-progress-dots");
    expect(artifact.content).toContain("0 of 3 steps done");
  });
});

describe("buildSpecsArtifact", () => {
  it("produces 120V/240V comparison layout", () => {
    const artifact = buildSpecsArtifact({
      process: "mig",
      specs: [
        { label: "Welding Current Range", value120v: "30–140A", value240v: "30–220A" },
        { label: "Wire Speed", value120v: "50–500 IPM", value240v: "50–500 IPM" },
      ],
    });

    expect(artifact.type).toBe("text/html");
    expect(artifact.content).toContain("30–140A");
    expect(artifact.content).toContain("30–220A");
    expect(artifact.content).toContain("120V");
    expect(artifact.content).toContain("240V");
    expect(artifact.content).toContain("Wire Speed");
  });

  it("handles single-value specs", () => {
    const artifact = buildSpecsArtifact({
      process: "mig",
      specs: [
        { label: "Max OCV", value120v: "86VDC" },
      ],
    });

    expect(artifact.content).toContain("86VDC");
    expect(artifact.content).toContain("Max OCV");
  });
});

describe("buildWeldDiagnosisArtifact", () => {
  it("produces tabbed diagnosis interface", () => {
    const artifact = buildWeldDiagnosisArtifact({
      weldType: "Wire",
      issues: [
        {
          name: "Porosity",
          description: "Small cavities or holes in the bead.",
          causes: [
            { cause: "Dirty workpiece", fix: "Clean down to bare metal" },
            { cause: "Insufficient gas", fix: "Increase gas flow rate" },
          ],
        },
        {
          name: "Excessive Spatter",
          description: "Grainy and large spatter around the weld.",
          causes: [
            { cause: "Incorrect polarity", fix: "Set to DCEP for MIG" },
          ],
        },
      ],
    });

    expect(artifact.type).toBe("text/html");
    expect(artifact.title).toContain("Wire");
    expect(artifact.content).toContain("Porosity");
    expect(artifact.content).toContain("Excessive Spatter");
    expect(artifact.content).toContain("showIssue");
    expect(artifact.content).toContain("wd-tab");
    expect(artifact.content).toContain("Dirty workpiece");
    expect(artifact.content).toContain("Clean down to bare metal");
  });
});

describe("executeVisualTool", () => {
  it("returns artifact for render_duty_cycle", () => {
    const result = executeVisualTool("render_duty_cycle", {
      process: "mig",
      voltage: "240",
      ratings: [{ amperage: 200, percent: 25, weldMinutes: 2.5, restMinutes: 7.5 }],
    });

    expect(result).not.toBeNull();
    expect(result!.text).toContain("Duty cycle");
    expect(result!.artifact.type).toBe("text/html");
  });

  it("returns artifact for render_polarity_setup", () => {
    const result = executeVisualTool("render_polarity_setup", {
      process: "tig",
      connections: [{ cable: "Ground", socket: "Positive", polarity: "positive" }],
    });

    expect(result).not.toBeNull();
    expect(result!.artifact.content).toContain("Ground");
  });

  it("returns artifact for render_troubleshooting", () => {
    const result = executeVisualTool("render_troubleshooting", {
      problem: "Wire Stops",
      checks: [{ cause: "Tangled wire", solution: "Untangle spool" }],
    });

    expect(result).not.toBeNull();
    expect(result!.artifact.content).toContain("Wire Stops");
  });

  it("returns artifact for render_setup_guide", () => {
    const result = executeVisualTool("render_setup_guide", {
      process: "stick",
      title: "Stick Setup",
      steps: [{ instruction: "Power off" }],
    });

    expect(result).not.toBeNull();
    expect(result!.artifact.title).toBe("Stick Setup");
  });

  it("returns artifact for render_specifications", () => {
    const result = executeVisualTool("render_specifications", {
      process: "all",
      specs: [{ label: "OCV", value120v: "86V" }],
    });

    expect(result).not.toBeNull();
    expect(result!.artifact.content).toContain("86V");
  });

  it("returns artifact for render_weld_diagnosis", () => {
    const result = executeVisualTool("render_weld_diagnosis", {
      weldType: "Stick",
      issues: [{ name: "Burn-Through", description: "Material melts away", causes: [{ cause: "Too hot", fix: "Reduce current" }] }],
    });

    expect(result).not.toBeNull();
    expect(result!.artifact.content).toContain("Burn-Through");
  });

  it("returns null for unknown tools", () => {
    const result = executeVisualTool("unknown_tool", {});
    expect(result).toBeNull();
  });

  it("returns null for search tools", () => {
    const result = executeVisualTool("search_manual", { query: "test" });
    expect(result).toBeNull();
  });
});
