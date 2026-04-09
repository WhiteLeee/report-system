import fs from "node:fs";
import path from "node:path";

type ForbiddenImport = {
  sourcePattern: string;
  replacement: string;
};

type Violation = {
  file: string;
  line: number;
  packageName: string;
  replacement: string;
};

const roots = ["app", "ui"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const forbiddenImports: ForbiddenImport[] = [
  {
    sourcePattern: "recharts(?:\\/[^\"']+)?",
    replacement: "@/components/ui/chart"
  },
  {
    sourcePattern: "lucide-react(?:\\/[^\"']+)?",
    replacement: "@/components/ui/icons"
  },
  {
    sourcePattern: "react-day-picker(?:\\/[^\"']+)?",
    replacement: "@/components/ui/calendar"
  },
  {
    sourcePattern: "@radix-ui\\/[^\"']+",
    replacement: "@/components/ui/*"
  }
];

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  entries.forEach((entry) => {
    const targetPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(targetPath));
      return;
    }
    if (!entry.isFile()) {
      return;
    }

    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(targetPath);
    }
  });

  return files;
}

function findViolations(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = content.split("\n");
  const violations: Violation[] = [];

  forbiddenImports.forEach(({ sourcePattern, replacement }) => {
    const pattern = new RegExp(`from\\s+["'](${sourcePattern})["']`, "g");
    let match = pattern.exec(content);
    while (match) {
      const line = content.slice(0, match.index).split("\n").length;
      violations.push({
        file: filePath,
        line,
        packageName: match[1],
        replacement
      });
      match = pattern.exec(content);
    }

    const importOnlyPattern = new RegExp(`import\\s+["'](${sourcePattern})["']`, "g");
    match = importOnlyPattern.exec(content);
    while (match) {
      const line = content.slice(0, match.index).split("\n").length;
      violations.push({
        file: filePath,
        line,
        packageName: match[1],
        replacement
      });
      match = importOnlyPattern.exec(content);
    }
  });

  return violations.filter((item) => item.line >= 1 && item.line <= rows.length);
}

function main() {
  const cwd = process.cwd();
  const files = roots.flatMap((root) => collectSourceFiles(path.join(cwd, root)));
  const violations = files.flatMap((file) => findViolations(file));

  if (violations.length === 0) {
    console.log("[check:ui-imports] passed");
    return;
  }

  console.error("[check:ui-imports] forbidden direct imports found in app/ui:");
  violations.forEach((violation) => {
    const relativeFile = path.relative(cwd, violation.file);
    console.error(
      `- ${relativeFile}:${violation.line} -> "${violation.packageName}" (use "${violation.replacement}")`
    );
  });
  process.exit(1);
}

main();
