/**
 * The one piece of state the touch camera shares with the room it is standing
 * in. A ref rather than store state: it is written during a gesture and read on
 * the next frame, and neither should re-render React.
 */
export interface TouchNavState {
  /**
   * True once the current pointer sequence has turned into a look-drag. The
   * browser still synthesises a click when that drag ends, so without this the
   * reader would walk to whatever their finger happened to stop over every
   * single time they turned around.
   */
  dragged: boolean;
  /** Where to walk, in room coordinates. The camera clears it on arrival. */
  destination: { x: number; z: number } | null;
}

export const createTouchNavState = (): TouchNavState => ({ dragged: false, destination: null });

/**
 * Ask the camera to walk somewhere the reader tapped. Ignored when the tap was
 * the tail end of a drag - see `dragged`.
 */
export const requestWalkTo = (state: TouchNavState, x: number, z: number): void => {
  if (state.dragged) return;
  state.destination = { x, z };
};
