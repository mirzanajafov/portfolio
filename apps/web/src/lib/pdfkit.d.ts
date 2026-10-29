declare namespace PDFKit.Mixins {
  type FeatureSwitches = Partial<Record<OpenTypeFeatures, boolean>>;
  type TextLayout = Omit<TextOptions, 'features'>;
  type SwitchedTextOptions = TextLayout & { features?: FeatureSwitches };

  interface PDFText {
    text(text: string, options?: SwitchedTextOptions): this;
    heightOfString(text: string, options?: SwitchedTextOptions): number;
  }
}
