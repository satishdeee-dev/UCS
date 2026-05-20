"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_OTP, normalizePhone, setIdentity } from "@/lib/demo/identity";
import { AnimatedBackground } from "./animated-background";
import { Logo } from "./logo";

export function LoginFlow({ onSignedIn }: { onSignedIn: (phone: string) => void }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  function continueToOtp(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (normalized.length < 4) {
      setError("Enter at least 4 digits");
      return;
    }
    setError(null);
    setStep("otp");
  }

  function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp !== DEMO_OTP) {
      setError("Wrong code (demo OTP is 1234)");
      return;
    }
    const normalized = normalizePhone(phone);
    setIdentity(normalized);
    onSignedIn(normalized);
  }

  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center px-6 py-12">
      <AnimatedBackground />
      <div className="relative z-10 mb-6 flex flex-col items-center gap-3">
        <Logo size={72} />
        <h1 className="text-3xl font-bold tracking-tight">CommApp</h1>
        <p className="text-center text-sm text-zinc-500">
          Offline-first messaging and calls — works without a network.
        </p>
      </div>
      <Card className="relative z-10 w-full max-w-sm bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <h2 className="text-sm font-medium">
            {step === "phone" ? "Sign in with your phone" : "Enter the code"}
          </h2>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={continueToOtp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 1234"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">
                Continue
              </Button>
              <p className="text-xs text-zinc-500">
                Any number works in demo mode. Open in another tab with a
                different number to chat with yourself.
              </p>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="otp">Enter code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="1234"
                  maxLength={4}
                  autoFocus
                />
                <p className="text-xs text-zinc-500">
                  Sent to <span className="font-medium">{phone}</span>. Demo
                  code: <span className="font-mono">1234</span>.
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError(null);
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  Verify
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
