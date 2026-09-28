import { describe, expect, it } from "vitest";
import { isUsableExternalId } from "./identifiers";

describe("isUsableExternalId", () => {
    it("accepts real identifiers", () => {
        expect(isUsableExternalId("EXT001")).toBe(true);
    });

    it("rejects empty values", () => {
        expect(isUsableExternalId("")).toBe(false);
    });

    it("rejects [identifier]", () => {
        expect(isUsableExternalId("[identifier]")).toBe(false);
    });

    it("rejects {identifier}", () => {
        expect(isUsableExternalId("{identifier}")).toBe(false);
    });

    it("rejects literal identifier", () => {
        expect(isUsableExternalId("identifier")).toBe(false);
    });

    it("rejects whitespace only values", () => {
        expect(
            isUsableExternalId("     ")
        ).toBe(false);
    });

    it("rejects trimmed placeholder values", () => {
        expect(
            isUsableExternalId(" [identifier] ")
        ).toBe(false);
    });

    it("rejects uppercase bracket placeholder", () => {
        expect(
            isUsableExternalId("[IDENTIFIER]")
        ).toBe(false);
    });

    it("rejects uppercase brace placeholder", () => {
        expect(
            isUsableExternalId("{IDENTIFIER}")
        ).toBe(false);
    });
});
