import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "./App";

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
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
