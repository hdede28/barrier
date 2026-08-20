"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

export function useOperation<T>(fn: () => Promise<T>) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<T | null>(null);

  async function run() {
    setStatus("loading");
    setError("");
    try {
      const r = await fn();
      setResult(r);
      setStatus("success");
      return r;
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "İşlem başarısız oldu.");
      throw err;
    }
  }

  function reset() {
    setStatus("idle");
    setError("");
    setResult(null);
  }

  return { status, error, result, run, reset };
}
