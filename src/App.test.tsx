import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

it("displays the BatchGrade branding and development status", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { level: 1, name: "BatchGrade V2" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "A local-first desktop application for grading programming assignments.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Application in development.")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Select C++ file" }),
  ).toBeEnabled();
});

it("selects a single C++ file and displays its path", async () => {
  vi.mocked(open).mockResolvedValue("C:\\submissions\\main.cpp");
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Select C++ file" }));

  expect(open).toHaveBeenCalledWith({
    title: "Select C++ file",
    multiple: false,
    directory: false,
    filters: [{ name: "C++ source files", extensions: ["cpp"] }],
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Selected file: C:\\submissions\\main.cpp",
  );
});

it("keeps the previous selection on cancel and allows replacing it", async () => {
  vi.mocked(open)
    .mockResolvedValueOnce("/submissions/main.cpp")
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce("/submissions/other.cpp");
  render(<App />);
  const button = screen.getByRole("button", { name: "Select C++ file" });

  fireEvent.click(button);
  await screen.findByRole("status");
  await waitFor(() => expect(button).toBeEnabled());

  fireEvent.click(button);
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByRole("status")).toHaveTextContent("/submissions/main.cpp");

  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("/submissions/other.cpp"),
  );
});

it("leaves the selection empty when the first dialog is cancelled", async () => {
  vi.mocked(open).mockResolvedValue(null);
  render(<App />);
  const button = screen.getByRole("button", { name: "Select C++ file" });

  fireEvent.click(button);

  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("disables the button while the picker is open", async () => {
  let finishSelection!: (path: string | null) => void;
  vi.mocked(open).mockReturnValue(
    new Promise<string | null>((resolve) => {
      finishSelection = resolve;
    }),
  );
  render(<App />);
  const button = screen.getByRole("button", { name: "Select C++ file" });

  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(open).toHaveBeenCalledTimes(1);

  await act(async () => finishSelection(null));
  expect(button).toBeEnabled();
});

it("shows picker errors, preserves the selection, and allows retrying", async () => {
  vi.mocked(open)
    .mockResolvedValueOnce("/submissions/main.cpp")
    .mockRejectedValueOnce(new Error("Dialog failed"))
    .mockResolvedValueOnce("/submissions/other.cpp");
  render(<App />);
  const button = screen.getByRole("button", { name: "Select C++ file" });

  fireEvent.click(button);
  await screen.findByRole("status");
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to open the file picker. Please try again.",
  );
  expect(screen.getByRole("status")).toHaveTextContent("/submissions/main.cpp");
  expect(button).toBeEnabled();

  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("/submissions/other.cpp"),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
