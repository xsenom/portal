import type { ReactNode } from "react";

type MobileShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

export function MobileShell({
  children,
  contentClassName = "",
}: MobileShellProps) {
  return (
    <main className="app-viewport">
      <section className="app-shell">
        <div className={`screen-content ${contentClassName}`}>
          {children}
        </div>
      </section>
    </main>
  );
}
