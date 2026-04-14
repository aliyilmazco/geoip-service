"use client";

import { useEffect, useRef } from "react";

type SwaggerUIBundle = ((
  config: {
    defaultModelExpandDepth?: number;
    defaultModelsExpandDepth?: number;
    docExpansion?: "full" | "list" | "none";
    domNode: HTMLElement;
    filter?: boolean;
    presets?: unknown[];
    requestSnippetsEnabled?: boolean;
    spec: object;
    tryItOutEnabled?: boolean;
  },
) => unknown) & {
  presets: {
    apis: unknown;
  };
};

type SwaggerUIEmbedProps = {
  spec: object;
};

export function SwaggerUIEmbed({ spec }: SwaggerUIEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;

    if (!container) {
      return () => {
        active = false;
      };
    }

    const mountNode = container;

    async function mountSwagger() {
      const swaggerModule = await import("@/lib/swagger-ui-bundle");
      const SwaggerUIBundle = swaggerModule.default as SwaggerUIBundle;

      if (!active) {
        return;
      }

      mountNode.innerHTML = "";

      SwaggerUIBundle({
        domNode: mountNode,
        spec,
        docExpansion: "list",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 3,
        tryItOutEnabled: true,
        filter: true,
        requestSnippetsEnabled: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    }

    void mountSwagger();

    return () => {
      active = false;
      mountNode.innerHTML = "";
    };
  }, [spec]);

  return <div ref={containerRef} />;
}
