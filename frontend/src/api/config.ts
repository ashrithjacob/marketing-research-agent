export interface Config {
  default_reject_kinds: string[];
  model: string;
  corpus_path: string;
  /** False means every source comes back unarchived and the run fills with gaps. */
  corpus_mounted: boolean;
  review_mining: {
    /** False means APIFY_TOKEN is unset and the three review tools are withheld. */
    configured: boolean;
    max_reviews: number;
  };
}
