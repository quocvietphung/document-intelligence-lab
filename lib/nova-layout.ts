/** Visible browser area, including an on-screen keyboard. No stored user data. */
export function novaViewportSpace(layoutHeight:number,visibleHeight:number,offsetTop=0) {
  const height=Math.max(0,Math.min(layoutHeight,visibleHeight));
  const bottom=Math.max(0,layoutHeight-height-Math.max(0,offsetTop));
  return {height,bottom};
}
