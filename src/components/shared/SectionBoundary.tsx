"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { log } from "@/lib/logger";

interface Props {
  children: ReactNode;
  /** Shown in place of the section. Keep it short — it is one row. */
  title: string;
  body: string;
  retryLabel: string;
}

interface State {
  failed: boolean;
}

/**
 * Keeps one failing section from taking the whole page down.
 *
 * The route-level error.tsx replaces everything, which is the wrong
 * trade on a homepage: if the "near you" query fails, the search, the
 * categories and the rest are still useful. This catches the failure
 * at the section and leaves the page standing.
 */
export default class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    log.error("[section-boundary]", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="bg-[var(--color-ground)] pt-20">
        <div className="container-app">
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
            >
              <AlertTriangle size={22} strokeWidth={1.7} />
            </span>

            <h2 className="m-0 text-base font-bold text-[var(--color-ink)]">
              {this.props.title}
            </h2>
            <p className="m-0 max-w-[42ch] text-sm leading-relaxed text-[var(--color-subtle)]">
              {this.props.body}
            </p>

            <button
              type="button"
              onClick={() => this.setState({ failed: false })}
              className="btn btn-outline btn-sm mt-2"
            >
              <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
              {this.props.retryLabel}
            </button>
          </div>
        </div>
      </section>
    );
  }
}
