import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

it("submits the entered name and displays the greeting", async () => {
  vi.mocked(invoke).mockResolvedValueOnce("Hello, Ada!");
  render(<App />);

  fireEvent.change(screen.getByPlaceholderText("Enter a name..."), {
    target: { value: "Ada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Greet" }));

  expect(invoke).toHaveBeenCalledWith("greet", { name: "Ada" });
  expect(await screen.findByText("Hello, Ada!")).toBeInTheDocument();
});
