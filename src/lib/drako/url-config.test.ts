// src/lib/drako/url-config.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDrakoBaseUrl } from "./url-config";

const originalEnv = { ...process.env };

// DRAKO BASE URL VALIDATIONS
describe("getDrakoBaseUrl", () => {

    // RESTORE ENVIRONMENT VARIABLE BEFORE EACH TEST
    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    // RESET ENVIRONMENT VARIABLES AFTER EACH TEST
    afterEach(() => {
        process.env = { ...originalEnv };
    });

    // VERIFY TRAILING SLASH IS REMOVED FROM HTTPS URL
    it("returns normalized origin for valid https url", () => {
        process.env.APP_PUBLIC_BASE_URL =
        "https://opinion-elite.com/";

        expect(getDrakoBaseUrl()).toBe(
        "https://opinion-elite.com"
        );
    });

    // VERIFY TRAILING SLASH IS REMOVED FROM HTTP URL
    it("returns normalized origin for valid http url", () => {
        process.env.APP_PUBLIC_BASE_URL =
        "http://localhost:3000/";

        expect(getDrakoBaseUrl()).toBe(
        "http://localhost:3000"
        );
    });

    // VERIFY MISSING URL CONFIGURATION IS REJECTED
    it("throws when configuration is missing", () => {
        process.env.APP_PUBLIC_BASE_URL = "";
        process.env.NEXT_PUBLIC_UI_ORIGIN = "";
        process.env.NEXT_PUBLIC_BASE_URL = "";

        expect(() => getDrakoBaseUrl()).toThrow(
        "DRAKO application base URL is not configured"
        );
    });

    // VERIFY ONLY HTTP AND HTTPS PROTOCOLS ARE ALLOWED
    it("throws for non-http protocol", () => {
        process.env.APP_PUBLIC_BASE_URL =
        "ftp://example.com";

        expect(() => getDrakoBaseUrl()).toThrow(
        "DRAKO application base URL must use HTTP or HTTPS"
        );
    });

});