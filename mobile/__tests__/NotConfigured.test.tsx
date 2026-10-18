import React from "react";
import { render, screen } from "@testing-library/react-native";
import { NotConfigured } from "../src/components/NotConfigured";

test("explains the missing settings and shows the reason", () => {
  render(<NotConfigured reason="Supabase URL is missing." />);
  expect(screen.getByText("Sign-in isn't configured")).toBeTruthy();
  expect(screen.getByText(/EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)).toBeTruthy();
  expect(screen.getByText("Supabase URL is missing.")).toBeTruthy();
});
