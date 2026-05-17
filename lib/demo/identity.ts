"use client";

const KEY = "ucs.demo.identity";

export const DEMO_OTP = "1234";

export function normalizePhone(input: string): string {
  return input.replace(/[\s\-()]/g, "");
}

export function getIdentity(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setIdentity(phone: string): void {
  localStorage.setItem(KEY, phone);
}

export function clearIdentity(): void {
  localStorage.removeItem(KEY);
}
