import { describe, expect, test } from "vitest";
import {
  MAX_STROKE_POINTS,
  appendStrokePoint,
  distanceToSegment,
  hitTestStroke,
  isValidStroke,
  type Stroke,
} from "../src/lib/drawing";

const validStroke: Stroke = {
  id: "stroke-1",
  tool: "pen",
  color: "#1e293b",
  size: 3,
  points: [10, 10, 20, 20, 30, 30],
  authorId: "user-1",
  createdAt: 1,
};

describe("drawing validation", () => {
  test("accepts a bounded valid stroke", () => {
    expect(isValidStroke(validStroke)).toBe(true);
  });

  test.each([
    [{ ...validStroke, tool: "spray" }],
    [{ ...validStroke, color: "javascript:alert(1)" }],
    [{ ...validStroke, size: 100 }],
    [{ ...validStroke, points: [10, Number.NaN] }],
    [{ ...validStroke, points: [10, 10, 20] }],
  ])("rejects malformed collaborator data", (stroke) => {
    expect(isValidStroke(stroke)).toBe(false);
  });
});

describe("stroke sampling", () => {
  test("drops points that are too close to the previous sample", () => {
    const points = [10, 10];
    expect(appendStrokePoint(points, 10.5, 10.5)).toBe(false);
    expect(points).toEqual([10, 10]);
  });

  test("adds a sufficiently distant point", () => {
    const points = [10, 10];
    expect(appendStrokePoint(points, 12, 12)).toBe(true);
    expect(points).toEqual([10, 10, 12, 12]);
  });

  test("enforces the per-stroke point limit", () => {
    const points = new Array(MAX_STROKE_POINTS * 2).fill(0);
    expect(appendStrokePoint(points, 20, 20)).toBe(false);
    expect(points).toHaveLength(MAX_STROKE_POINTS * 2);
  });
});

describe("drawing hit testing", () => {
  test("computes distance to a line segment", () => {
    expect(distanceToSegment(5, 4, 0, 0, 10, 0)).toBe(4);
  });

  test("selects the topmost matching stroke", () => {
    const topStroke = { ...validStroke, id: "stroke-2", createdAt: 2 };
    expect(hitTestStroke([validStroke, topStroke], 20, 20, 2)).toBe(
      "stroke-2"
    );
  });

  test("ignores invalid strokes", () => {
    const invalidStroke = { ...validStroke, id: "invalid", tool: "spray" };
    expect(
      hitTestStroke([invalidStroke as Stroke, validStroke], 20, 20, 2)
    ).toBe("stroke-1");
  });
});
