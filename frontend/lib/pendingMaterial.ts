"use client";

/**
 * Holds a PDF the student attached on the home screen so it can be
 * uploaded once the lesson workspace exists (client-side navigation
 * keeps this module alive between pages).
 */
let pendingFile: File | null = null;

export function setPendingMaterial(file: File | null) {
  pendingFile = file;
}

export function takePendingMaterial(): File | null {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
