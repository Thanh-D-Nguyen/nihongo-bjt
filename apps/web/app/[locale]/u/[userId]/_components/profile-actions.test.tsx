// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

import { ProfileActions } from "./profile-actions";

const labels = {
  actions: {
    addFriend: "Kết bạn",
    challenge: "⚔️ Thách đấu",
    friends: "Bạn bè",
    pendingFriend: "Đang chờ"
  },
  challengeSent: "Đã gửi lời thách đấu",
  loginToChallenge: "Đăng nhập để thách đấu",
  online: "Đang trực tuyến"
};

describe("ProfileActions dead PvP challenge removal", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("hides the dead PvP challenge button for strangers and signed-out viewers while preserving the friends badge", async () => {
    await act(async () => {
      root.render(
        <ProfileActions
          isAuthenticated
          labels={labels}
          locale="vi"
          profile={{ id: "user-2", displayName: "Minh", online: true, relationship: "stranger" }}
        />
      );
    });
    expect(
      host.querySelector("button"),
      "ProfileActions must hide the dead PvP challenge button"
    ).toBeNull();
    expect(host.textContent).not.toContain("Thách đấu");

    await act(async () => {
      root.render(
        <ProfileActions
          isAuthenticated
          labels={labels}
          locale="vi"
          profile={{ id: "user-3", displayName: "Lan", online: false, relationship: "friend" }}
        />
      );
    });
    expect(host.querySelector("button"), "friend profile must not render PvP challenge button").toBeNull();
    expect(host.textContent).toContain("Bạn bè");
  });
});
