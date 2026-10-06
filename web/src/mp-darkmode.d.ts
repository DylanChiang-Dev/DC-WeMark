// mp-darkmode 未附型別；只宣告本專案用到的 run()。
declare module 'mp-darkmode' {
  const Darkmode: {
    run(nodes: ArrayLike<Element>, options?: Record<string, unknown>): void;
  };
  export default Darkmode;
}
