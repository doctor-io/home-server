import { describe, expect, it } from "vitest";
import { parseEnvFileContent } from "@/lib/shared/env-file";

describe("parseEnvFileContent", () => {
  it("parses comments, blank lines, and wrapped quotes", () => {
    expect(
      parseEnvFileContent(`
# comment
DATABASE_URL="postgresql://user:pass@localhost:5432/homeio"
PLAIN=value
SINGLE='quoted value'
EMPTY=
INVALID_LINE
      `),
    ).toEqual({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/homeio",
      PLAIN: "value",
      SINGLE: "quoted value",
      EMPTY: "",
    });
  });
});
