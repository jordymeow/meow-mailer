// The page is built from a few NekoWrappers stacked vertically (the status
// strip, then the screen). They must share one horizontal inset or the blocks
// end up sitting further left than the strip above them. The tab content used
// to provide this padding; since the tabs became header buttons, we do.
//
// Note the wrappers can't be merged into one: NekoColumn uses `flex: <n>`
// (basis 0), so columns after a fullWidth one would not wrap onto a new line.
const INSET = 20;

export const wrapperTop  = { padding: `25px ${INSET}px 0 ${INSET}px` };
export const wrapperBody = { padding: `0 ${INSET}px 30px ${INSET}px` };
