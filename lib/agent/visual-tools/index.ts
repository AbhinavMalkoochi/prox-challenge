import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { parseSourcePagesFromToolInput } from "./shared";
import { buildDutyCycleArtifact, type DutyCycleInput } from "./duty-cycle";
import { buildPolarityArtifact, type PolarityInput } from "./polarity";
import { buildTroubleshootingArtifact } from "./troubleshooting";
import { buildSetupGuideArtifact, type SetupGuideInput } from "./setup-guide";
import { buildWeldDiagnosisArtifact, type WeldDiagnosisInput } from "./weld-diagnosis";
import { buildSettingsAdvisorArtifact, type SettingsAdvisorInput } from "./settings-advisor";

// Re-export everything public
export {
  parseSourcePagesFromToolInput,
  buildDutyCycleArtifact,
  buildPolarityArtifact,
  buildTroubleshootingArtifact,
  buildSetupGuideArtifact,
  buildWeldDiagnosisArtifact,
  buildSettingsAdvisorArtifact,
};

type ToolResult = { text: string; artifact: AntArtifact } | null;

/**
 * Execute a visual tool by name with the raw tool input from the model.
 * Returns null if the tool name is not a visual tool.
 */
export function executeVisualTool(
  name: string,
  input: Record<string, unknown>
): ToolResult {
  const sourceRefs: ArtifactSourceRef[] = parseSourcePagesFromToolInput(input);

  switch (name) {
    case "render_duty_cycle": {
      const artifact = buildDutyCycleArtifact(
        input as unknown as DutyCycleInput,
        sourceRefs
      );
      return { text: `Duty cycle visual for ${(input.process as string) ?? "process"} at ${(input.voltage as string) ?? "?"}V.`, artifact };
    }

    case "render_polarity_setup": {
      const artifact = buildPolarityArtifact(
        input as unknown as PolarityInput,
        sourceRefs
      );
      return { text: `Polarity setup for ${(input.process as string) ?? "process"}.`, artifact };
    }

    case "render_troubleshooting": {
      const artifact = buildTroubleshootingArtifact(
        input as unknown as Parameters<typeof buildTroubleshootingArtifact>[0],
        sourceRefs
      );
      return { text: `Troubleshooting guide for ${(input.problem as string) ?? "issue"}.`, artifact };
    }

    case "render_setup_guide": {
      const artifact = buildSetupGuideArtifact(
        input as unknown as SetupGuideInput,
        sourceRefs
      );
      return { text: `Setup guide: ${(input.title as string) ?? "Setup Guide"}.`, artifact };
    }

    case "render_weld_diagnosis": {
      const artifact = buildWeldDiagnosisArtifact(
        input as unknown as WeldDiagnosisInput,
        sourceRefs
      );
      return { text: `Weld diagnosis for ${(input.weldType as string) ?? "weld"} welding.`, artifact };
    }

    case "render_settings_advisor": {
      const artifact = buildSettingsAdvisorArtifact(
        input as unknown as SettingsAdvisorInput,
        sourceRefs
      );
      return { text: "Settings advisor with material/thickness presets.", artifact };
    }

    default:
      return null;
  }
}
