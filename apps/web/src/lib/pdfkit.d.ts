declare namespace PDFKit.Mixins {
  type FeatureSwitches = Partial<Record<OpenTypeFeatures, boolean>>;
  type SwitchedTextOptions = Omit<TextOptions, 'features'> & { features?: FeatureSwitches };

  interface PDFText {
    text(text: string, options?: SwitchedTextOptions): this;
    heightOfString(text: string, options?: SwitchedTextOptions): number;
  }
}
