"use client";

import React, { useEffect, useRef, useState } from "react";

interface ChartContainerProps {
  children: React.ReactNode;
  aspectRatio?: number;
  className?: string;
  minHeight?: number;
}

export function ChartContainer({
  children,
  aspectRatio = 2,
  className = "",
  minHeight = 300,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      } else if (width > 0) {
        const calculatedHeight = Math.max(width / aspectRatio, minHeight);
        setDimensions({ width, height: calculatedHeight });
      }
    });

    resizeObserver.observe(element);

    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    } else if (rect.width > 0) {
      setDimensions({ width: rect.width, height: Math.max(rect.width / aspectRatio, minHeight) });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [aspectRatio, minHeight]);

  const hasValidDimensions = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        minHeight: `${minHeight}px`,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {hasValidDimensions ? (
        children
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: `${minHeight}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          Loading chart area...
        </div>
      )}
    </div>
  );
}
