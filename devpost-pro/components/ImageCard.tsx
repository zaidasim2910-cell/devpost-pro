"use client";

import html2canvas from "html2canvas";
import { Download, RefreshCw } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

async function captureElement(el: HTMLElement): Promise<Blob | null> {
  const canvas = await html2canvas(el, {
    scale: 1,
    useCORS: true,
    backgroundColor: null,
    width: 1200,
    height: 630,
  });
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
}

export type ImageCardHandle = {
  /** Capture the card as PNG and notify parent via onCapture. Returns null if the host is missing. */
  capture: () => Promise<Blob | null>;
  /** Capture then trigger a file download. */
  download: (filename: string) => Promise<void>;
};

export const ImageCard = forwardRef<
  ImageCardHandle,
  {
    html: string;
    onCapture: (blob: Blob) => void;
    downloadBasename?: string;
  }
>(function ImageCard({ html, onCapture, downloadBasename = "devpost-pro-card" }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const runCapture = useCallback(async () => {
    const el = hostRef.current;
    if (!el) return null;
    const blob = await captureElement(el);
    if (blob) {
      onCapture(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }
    return blob;
  }, [onCapture]);

  const onRegenerate = useCallback(async () => {
    setCapturing(true);
    try {
      await runCapture();
    } finally {
      setCapturing(false);
    }
  }, [runCapture]);

  const onDownload = useCallback(
    async (filename: string) => {
      setCapturing(true);
      try {
        const blob = await runCapture();
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } finally {
        setCapturing(false);
      }
    },
    [runCapture]
  );

  useImperativeHandle(
    ref,
    () => ({
      capture: () => runCapture(),
      download: (filename: string) => onDownload(filename),
    }),
    [onDownload, runCapture]
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Image card
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onRegenerate()}
            disabled={capturing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${capturing ? "animate-spin" : ""}`}
            />
            Regenerate image
          </button>
          <button
            type="button"
            onClick={() => void onDownload(downloadBasename)}
            disabled={capturing}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Preview scales the 1200×630 LinkedIn card. Capture uses the full-size
        render for uploading.
      </p>

      <div className="mt-4 overflow-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div
          className="origin-top-left"
          style={{ transform: "scale(0.45)", transformOrigin: "top left" }}
        >
          <div
            ref={hostRef}
            className="overflow-hidden"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {previewUrl ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            Last capture
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Captured card"
            className="mt-2 max-h-48 rounded-lg border border-slate-200 object-contain"
          />
        </div>
      ) : null}
    </div>
  );
});

ImageCard.displayName = "ImageCard";
