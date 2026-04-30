import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { assertSafeExternalHttpUrl } from "./external-url-policy.js";

describe("assertSafeExternalHttpUrl", () => {
  it("accepts regular https url", async () => {
    await expect(
      assertSafeExternalHttpUrl(
        "https://example.com/path",
        "destinationUrl",
        async () => [{ address: "93.184.216.34" }]
      )
    ).resolves.toBeUndefined();
  });

  it("rejects non-http schemes", async () => {
    await expect(assertSafeExternalHttpUrl("ftp://example.com", "destinationUrl")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects localhost and private/link-local hosts", async () => {
    await expect(assertSafeExternalHttpUrl("https://localhost/path", "destinationUrl")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(assertSafeExternalHttpUrl("https://127.0.0.1/path", "destinationUrl")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(assertSafeExternalHttpUrl("https://192.168.1.2/path", "destinationUrl")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      assertSafeExternalHttpUrl("https://169.254.169.254/latest/meta-data", "destinationUrl")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects IPv4-mapped IPv6 loopback/private addresses", async () => {
    await expect(
      assertSafeExternalHttpUrl("https://[::ffff:127.0.0.1]/", "destinationUrl")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects hostnames that resolve to blocked addresses", async () => {
    await expect(
      assertSafeExternalHttpUrl(
        "https://safe-looking.example/path",
        "destinationUrl",
        async () => [{ address: "127.0.0.1" }]
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
