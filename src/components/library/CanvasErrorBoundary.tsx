import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface CanvasErrorBoundaryProps {
  children: ReactNode;
  /** Called once when the 3D scene fails, so the app can fall back to list mode. */
  onError: () => void;
}

/**
 * WebGL can fail at runtime - a lost context, a driver the browser refuses to
 * use, an out-of-memory canvas. When that happens the reader should end up in
 * list mode, not staring at a blank rectangle (spec sections 16 and 17).
 */
export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The 3D library failed to render; falling back to list mode.', error, info);
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
