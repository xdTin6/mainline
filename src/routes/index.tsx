import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { previewPathPrefix } from "@/lib/preview-path-prefix";

export const Route = createFileRoute("/")({ component: Mainline });

function Mainline() {
  const [src, setSrc] = useState("/mainline.html");
  useEffect(() => {
    const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
    setSrc(`${prefix || ""}/mainline.html`);
  }, []);

  return (
    <div className="relative min-h-screen">
      <p className="sr-only">Mainline — a social record for people who build software.</p>
      <iframe
        title="Mainline"
        src={src}
        className="block h-screen w-full border-0 bg-bg"
      />
    </div>
  );
}
