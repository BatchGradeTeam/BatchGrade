import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, expect, it, vi } from "vitest";
import type { CppEnvironmentStatus, DockerStatus } from "@/lib/docker";
import { DockerPreflight } from "./docker-preflight";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "check_cpp_environment") return { status: "ready" };
    throw new Error(`Unexpected command: ${command}`);
  });
});

function panel() {
  return within(screen.getByRole("region", { name: "Docker" }));
}

function pending<T = DockerStatus>() {
  let resolve!: (status: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

it("checks Docker on open and disables refreshing until the check finishes", async () => {
  const check = pending();
  vi.mocked(invoke).mockReturnValueOnce(check.promise);
  render(<DockerPreflight />);

  expect(panel().getByText("Checking Docker…")).toBeInTheDocument();
  expect(panel().getByRole("button", { name: "Refresh" })).toBeDisabled();
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke).toHaveBeenCalledWith("check_docker_status");

  await act(async () =>
    check.resolve({ status: "available", version: "29.9.3" }),
  );

  expect(
    panel().getByText("Docker is available (Engine 29.9.3)."),
  ).toBeInTheDocument();
  expect(panel().getByRole("button", { name: "Refresh" })).toBeEnabled();
  expect(invoke).toHaveBeenLastCalledWith("check_cpp_environment");
});

it.each<[DockerStatus, string, boolean]>([
  [
    { status: "available", version: "29.9.3" },
    "Docker is available (Engine 29.9.3).",
    false,
  ],
  [{ status: "available", version: null }, "Docker is available.", false],
  [
    { status: "notInstalled" },
    "Docker is not installed. Install Docker Desktop or Docker Engine, then refresh.",
    false,
  ],
  [
    { status: "notRunning", canStart: true },
    "Docker Desktop is not running.",
    true,
  ],
  [
    { status: "notRunning", canStart: false },
    "Docker is not running. Start the Docker service, then refresh.",
    false,
  ],
  [
    { status: "error", detail: "Permission denied." },
    "Could not check Docker: Permission denied.",
    false,
  ],
])("shows %o as %j", async (status, message, canStart) => {
  vi.mocked(invoke).mockResolvedValueOnce(status);
  render(<DockerPreflight />);

  expect(await panel().findByText(message)).toBeInTheDocument();
  if (status.status === "available")
    await panel().findByText("The C++ compiler is ready.");
  expect(panel().getByRole("button", { name: "Refresh" })).toBeEnabled();
  expect(
    panel().queryByRole("button", { name: "Start Docker Desktop" }) !== null,
  ).toBe(canStart);
});

it("shows a generic message when the check fails and allows retrying", async () => {
  vi.mocked(invoke)
    .mockRejectedValueOnce(new Error("IPC failed"))
    .mockResolvedValueOnce({ status: "available", version: "29.9.3" });
  render(<DockerPreflight />);

  expect(
    await panel().findByText("Could not check Docker. Please try again."),
  ).toBeInTheDocument();
  expect(panel().queryByText(/IPC failed/)).not.toBeInTheDocument();

  fireEvent.click(panel().getByRole("button", { name: "Refresh" }));

  expect(
    await panel().findByText("Docker is available (Engine 29.9.3)."),
  ).toBeInTheDocument();
});

it("refreshes the Docker status", async () => {
  const refresh = pending();
  vi.mocked(invoke)
    .mockResolvedValueOnce({ status: "notRunning", canStart: false })
    .mockReturnValueOnce(refresh.promise);
  render(<DockerPreflight />);
  const button = panel().getByRole("button", { name: "Refresh" });
  await panel().findByText(
    "Docker is not running. Start the Docker service, then refresh.",
  );

  fireEvent.click(button);

  expect(panel().getByText("Checking Docker…")).toBeInTheDocument();
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(invoke).toHaveBeenLastCalledWith("check_docker_status");

  await act(async () =>
    refresh.resolve({ status: "available", version: "29.9.3" }),
  );

  expect(
    panel().getByText("Docker is available (Engine 29.9.3)."),
  ).toBeInTheDocument();
  expect(button).toBeEnabled();
});

it("starts Docker Desktop and shows the new status", async () => {
  const start = pending();
  vi.mocked(invoke)
    .mockResolvedValueOnce({ status: "notRunning", canStart: true })
    .mockReturnValueOnce(start.promise);
  render(<DockerPreflight />);
  const startButton = await panel().findByRole("button", {
    name: "Start Docker Desktop",
  });

  fireEvent.click(startButton);

  expect(invoke).toHaveBeenLastCalledWith("start_docker_desktop");
  expect(
    panel().getByText("Starting Docker Desktop… This can take a minute."),
  ).toBeInTheDocument();
  expect(startButton).toBeDisabled();
  expect(panel().getByRole("button", { name: "Refresh" })).toBeDisabled();

  await act(async () =>
    start.resolve({ status: "available", version: "29.9.3" }),
  );

  expect(
    panel().getByText("Docker is available (Engine 29.9.3)."),
  ).toBeInTheDocument();
  expect(
    panel().queryByRole("button", { name: "Start Docker Desktop" }),
  ).not.toBeInTheDocument();
});

it("shows start errors and keeps the start button for retrying", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ status: "notRunning", canStart: true })
    .mockRejectedValueOnce(new Error("IPC failed"));
  render(<DockerPreflight />);

  fireEvent.click(
    await panel().findByRole("button", { name: "Start Docker Desktop" }),
  );

  expect(
    await panel().findByText(
      "Could not start Docker Desktop. Please try again.",
    ),
  ).toBeInTheDocument();
  expect(
    panel().getByRole("button", { name: "Start Docker Desktop" }),
  ).toBeEnabled();
  expect(panel().getByRole("button", { name: "Refresh" })).toBeEnabled();
});

it("checks for the image without downloading until requested", async () => {
  const pull = pending<CppEnvironmentStatus>();
  vi.mocked(invoke)
    .mockResolvedValueOnce({ status: "available", version: null })
    .mockResolvedValueOnce({ status: "imageMissing" })
    .mockReturnValueOnce(pull.promise);
  render(<DockerPreflight />);

  const button = await panel().findByRole("button", {
    name: "Download compiler",
  });
  expect(vi.mocked(invoke).mock.calls).toEqual([
    ["check_docker_status"],
    ["check_cpp_environment"],
  ]);
  fireEvent.click(button);
  expect(invoke).toHaveBeenLastCalledWith("provision_cpp_environment");
  expect(button).toBeDisabled();
  expect(panel().getByRole("button", { name: "Refresh" })).toBeDisabled();
  expect(
    panel().getByText("Downloading the C++ compiler…"),
  ).toBeInTheDocument();

  await act(async () => pull.resolve({ status: "ready" }));
  expect(panel().getByText("The C++ compiler is ready.")).toBeInTheDocument();
  expect(
    panel().queryByRole("button", { name: "Download compiler" }),
  ).not.toBeInTheDocument();
});

it("offers a retry after a failed download", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ status: "available", version: null })
    .mockResolvedValueOnce({ status: "imageMissing" })
    .mockResolvedValueOnce({ status: "error", detail: "Registry unavailable." })
    .mockResolvedValueOnce({ status: "ready" });
  render(<DockerPreflight />);

  const button = await panel().findByRole("button", {
    name: "Download compiler",
  });
  fireEvent.click(button);
  expect(await panel().findByRole("alert")).toHaveTextContent(
    "Registry unavailable.",
  );
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(
    await panel().findByText("The C++ compiler is ready."),
  ).toBeInTheDocument();
});

it("explains unsupported environments without offering a download", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ status: "available", version: null })
    .mockResolvedValueOnce({
      status: "unsupported",
      detail: "Switch Docker to Linux containers.",
    });
  render(<DockerPreflight />);

  expect(
    await panel().findByText("Switch Docker to Linux containers."),
  ).toBeInTheDocument();
  expect(
    panel().queryByRole("button", { name: "Download compiler" }),
  ).not.toBeInTheDocument();
});
