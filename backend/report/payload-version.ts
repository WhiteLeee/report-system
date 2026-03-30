export class UnsupportedPayloadVersionError extends Error {
  readonly receivedVersion: number;
  readonly supportedVersions: number[];

  constructor(receivedVersion: number, supportedVersions: number[]) {
    super(
      `Unsupported payload_version ${receivedVersion}. Supported versions: ${supportedVersions.join(", ") || "none"}.`
    );
    this.name = "UnsupportedPayloadVersionError";
    this.receivedVersion = receivedVersion;
    this.supportedVersions = supportedVersions;
  }
}

export function normalizeSupportedPayloadVersions(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0))).sort(
    (left, right) => left - right
  );
}
