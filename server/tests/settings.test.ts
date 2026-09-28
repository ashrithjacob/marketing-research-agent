/** Settings: the model comes from .env alone, and its absence stops the server rather than falling back. */
import { afterEach, describe, expect, it } from "vitest";

import { Env } from "../src/config/index.js";

const saved = { model: process.env.MRA_MODEL, backups: process.env.MRA_BACKUP_MODELS };

afterEach(() => {
  process.env.MRA_MODEL = saved.model;
  if (saved.backups === undefined) delete process.env.MRA_BACKUP_MODELS;
  else process.env.MRA_BACKUP_MODELS = saved.backups;
});

describe("MRA_MODEL", () => {
  it("is read from the environment as given", () => {
    process.env.MRA_MODEL = "vendor/some-model";
    expect(Env.settings().model).toBe("vendor/some-model");
  });

  it("has no default in the code: unset or blank refuses to build settings", () => {
    delete process.env.MRA_MODEL;
    expect(() => Env.settings()).toThrow(/MRA_MODEL is not set/);
    process.env.MRA_MODEL = "   ";
    expect(() => Env.settings()).toThrow(/MRA_MODEL is not set/);
  });
});

describe("MRA_BACKUP_MODELS", () => {
  it("is an ordered list, blanks and spaces ignored, and empty when unset", () => {
    process.env.MRA_MODEL = "z-ai/glm-5.3-flash";
    delete process.env.MRA_BACKUP_MODELS;
    expect(Env.settings().backupModels).toEqual([]);
    process.env.MRA_BACKUP_MODELS = " deepseek/deepseek-v4.1-flash , minimax/minimax-m3,, ";
    expect(Env.settings().backupModels).toEqual(["deepseek/deepseek-v4.1-flash", "minimax/minimax-m3"]);
  });

  it("refuses a model named twice, the primary included", () => {
    process.env.MRA_MODEL = "z-ai/glm-5.3-flash";
    process.env.MRA_BACKUP_MODELS = "minimax/minimax-m3,z-ai/glm-5.3-flash";
    expect(() => Env.settings()).toThrow(/repeats z-ai\/glm-5.3-flash/);
    process.env.MRA_BACKUP_MODELS = "minimax/minimax-m3,minimax/minimax-m3";
    expect(() => Env.settings()).toThrow(/repeats minimax\/minimax-m3/);
  });
});
