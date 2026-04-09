"use client";

import { useEffect, useRef, useState } from "react";

function getMonacoTheme() {
  if (typeof document === "undefined") return "vs-dark";

  const theme = document.documentElement.dataset.desktopTheme;
  if (theme === "light") return "vs";
  if (theme === "dark") return "vs-dark";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "vs-dark"
    : "vs";
}

const MONACO_CDN_BASE =
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min";

type MonacoSubscription = { dispose: () => void };
type MonacoModel = { dispose: () => void };
type MonacoEditorInstance = {
  onDidChangeModelContent: (listener: () => void) => MonacoSubscription;
  getValue: () => string;
  layout: () => void;
  getModel: () => MonacoModel | null;
  dispose: () => void;
  __changeSub?: MonacoSubscription;
};
type MonacoNamespace = {
  editor: {
    createModel: (value: string, language: string) => MonacoModel;
    create: (
      container: HTMLElement,
      options: Record<string, unknown>,
    ) => MonacoEditorInstance;
    setTheme: (theme: string) => void;
  };
};
type MonacoRequire = {
  config: (config: { paths: { vs: string } }) => void;
  (deps: string[], onLoad: () => void, onError: (error: unknown) => void): void;
};

let monacoLoaderPromise: Promise<MonacoNamespace> | null = null;

function loadMonacoFromCdn(): Promise<MonacoNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Monaco can only load in the browser"));
  }

  const win = window as typeof window & {
    monaco?: MonacoNamespace;
    require?: MonacoRequire;
  };
  if (win.monaco?.editor) return Promise.resolve(win.monaco);
  if (monacoLoaderPromise) return monacoLoaderPromise;

  monacoLoaderPromise = new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      monacoLoaderPromise = null;
      reject(err);
    };

    const boot = () => {
      if (!win.require) {
        fail(new Error("Monaco loader is unavailable"));
        return;
      }
      win.require.config({ paths: { vs: `${MONACO_CDN_BASE}/vs` } });
      win.require(["vs/editor/editor.main"], () => resolve(win.monaco), fail);
    };

    if (win.require) {
      boot();
      return;
    }

    const existing = document.getElementById(
      "monaco-loader-script",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", boot, { once: true });
      existing.addEventListener(
        "error",
        () => fail(new Error("Failed to load Monaco loader script")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "monaco-loader-script";
    script.src = `${MONACO_CDN_BASE}/vs/loader.min.js`;
    script.async = true;
    script.onload = boot;
    script.onerror = () => fail(new Error("Failed to load Monaco loader script"));
    document.body.appendChild(script);
  });

  return monacoLoaderPromise;
}

export function MonacoEditorPane({
  language,
  value,
  onChange,
}: {
  language: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let mounted = true;
    let editor: MonacoEditorInstance | undefined;
    let resizeObserver: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;

    loadMonacoFromCdn()
      .then((monaco) => {
        if (!mounted || !containerRef.current) return;
        const model = monaco.editor.createModel(value, language);
        editor = monaco.editor.create(containerRef.current, {
          model,
          theme: getMonacoTheme(),
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 13,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          roundedSelection: false,
          padding: { top: 12, bottom: 12 },
        });

        const changeSub = editor.onDidChangeModelContent(() => {
          onChangeRef.current(editor.getValue());
        });

        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            editor.layout();
          });
          resizeObserver.observe(containerRef.current);
        }

        themeObserver = new MutationObserver(() => {
          monaco.editor.setTheme(getMonacoTheme());
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-desktop-theme"],
        });

        editor.__changeSub = changeSub;
      })
      .catch(() => {
        if (mounted) setFallbackMode(true);
      });

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      if (editor?.__changeSub) editor.__changeSub.dispose();
      if (editor?.getModel?.()) editor.getModel().dispose();
      if (editor?.dispose) editor.dispose();
    };
    // Monaco model is initialized once per language to avoid recreating editor per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  if (fallbackMode) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-glass-border bg-status-amber/10 px-3 py-2 text-xs text-status-amber">
          Monaco failed to load. Showing fallback editor.
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full resize-none border-0 bg-card/90 p-4 font-mono text-sm leading-5 text-foreground outline-none"
          spellCheck={false}
        />
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full bg-card/90" />;
}
