import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Topbar from "./Topbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: ({ priority, ...props }: any) => (
    <img {...props} />
  ),
}));

describe("Topbar", () => {
  it("renders title and user name", () => {
    render(
      <Topbar
        title="Opinion Elite"
        userName="Atul"
      />
    );

    expect(
      screen.getByText("Opinion Elite")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Atul")
    ).toBeInTheDocument();
  });
});