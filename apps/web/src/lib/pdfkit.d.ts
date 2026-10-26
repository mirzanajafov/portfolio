declare namespace PDFKit.Mixins {
  type FeatureSwitches = Partial<Record<OpenTypeFeatures, boolean>>;

  interface PDFText {
    text(
      text: string,
      options?: Omit<TextOptions, 'features'> & { features?: FeatureSwitches },
    ): this;
  }
}
