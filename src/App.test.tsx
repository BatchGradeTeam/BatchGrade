import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { runCppSource, selectCppSource as open } from "@/lib/cpp";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/lib/cpp", () => ({
  selectCppSource: vi.fn(),
  runCppSource: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  // Keep the Docker check pending so it does not update state during file picker tests.
  vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
});

it("checks Docker when the app opens", () => {
  render(<App />);

  expect(
    within(screen.getByRole("region", { name: "Docker" })).getByText(
      "Checking Docker…",
    ),
  ).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledWith("check_docker_status");
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
  expect(screen.getByRole("button", { name: "Select C++ file" })).toBeEnabled();
});

it("selects a single C++ file and displays its path", async () => {
  vi.mocked(open).mockResolvedValue("C:\\submissions\\main.cpp");
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "Select C++ file" }));

  expect(open).toHaveBeenCalledWith();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Selected file: C:\\submissions\\main.cpp",
  );
});

it("compiles the selection and shows program output and exit status", async () => {
  vi.mocked(open).mockResolvedValue("/submissions/main.cpp");
  vi.mocked(runCppSource).mockResolvedValue({
    compilation: {
      status: "success",
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 123,
    },
    execution: {
      status: "success",
      exitCode: 0,
      stdout: "Hello C++\n",
      stderr: "diagnostic\n",
      durationMs: 20,
    },
  });
  render(<App />);
  const run = screen.getByRole("button", { name: "Compile and run" });
  expect(run).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Select C++ file" }));
  await waitFor(() => expect(run).toBeEnabled());
  fireEvent.click(run);
  expect(runCppSource).toHaveBeenCalledWith();
  const results = within(
    await screen.findByRole("region", { name: "C++ results" }),
  );
  expect(results.getByText("Hello C++")).toBeInTheDocument();
  expect(results.getByText("diagnostic")).toBeInTheDocument();
  expect(
    results.getByText("Succeeded · Exit code 0 · 20 ms"),
  ).toBeInTheDocument();
});

it("shows compiler errors without claiming that the program ran", async () => {
  vi.mocked(open).mockResolvedValue("/submissions/broken.cpp");
  vi.mocked(runCppSource).mockResolvedValue({
    compilation: {
      status: "compileError",
      exitCode: 1,
      stdout: "",
      stderr: "error: expected declaration",
      durationMs: 20,
    },
    execution: null,
  });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Select C++ file" }));
  const run = screen.getByRole("button", { name: "Compile and run" });
  await waitFor(() => expect(run).toBeEnabled());
  fireEvent.click(run);
  expect(
    await screen.findByText("error: expected declaration"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Program output" }),
  ).not.toBeInTheDocument();
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "/submissions/other.cpp",
    ),
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "/submissions/other.cpp",
    ),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
