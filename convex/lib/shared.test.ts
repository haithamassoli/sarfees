import { expect, test } from "vitest";
import { normalizeJordanPhone, waLink } from "./shared";

test("normalizeJordanPhone accepts every written form of the same number", () => {
  const e164 = "+962791111111";
  for (const input of [
    "0791111111",
    "791111111",
    "962791111111",
    "+962791111111",
    "00962791111111",
    "079 111 1111",
    "079-111-1111",
    "(079) 111 1111",
    "+962 79 111 1111",
  ]) {
    expect(normalizeJordanPhone(input), input).toBe(e164);
  }
});

test("normalizeJordanPhone accepts all Jordanian mobile prefixes", () => {
  expect(normalizeJordanPhone("0771234567")).toBe("+962771234567");
  expect(normalizeJordanPhone("0781234567")).toBe("+962781234567");
  expect(normalizeJordanPhone("0791234567")).toBe("+962791234567");
});

test("normalizeJordanPhone rejects invalid numbers", () => {
  for (const input of [
    "",
    "abc",
    "0761234567", // 076 is not a Jordanian mobile prefix
    "079111111", // too short
    "07911111111", // too long
    "0641234567", // landline
    "+14155552671", // not Jordan
    "96279111111", // 962 + 8 digits
  ]) {
    expect(normalizeJordanPhone(input), input).toBeNull();
  }
});

test("waLink strips the plus for wa.me", () => {
  expect(waLink("+962791111111")).toBe("https://wa.me/962791111111");
});
