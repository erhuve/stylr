export type Feature = 'relaxed' | 'fitted' | 'layered' | 'minimal' | 'pattern' | 'texture' | 'bright' | 'muted' | 'tailored' | 'sporty' | 'utility' | 'romantic' | 'edgy' | 'vintage';
export type Collection = 'women' | 'men';
export type Frame = 'smaller' | 'mid' | 'fuller';
export type Photo = {
  id: string; title: string; description: string; src: string; sourceUrl: string; creator: string; creatorUrl: string; licenseUrl: string;
  collection: Collection; frame: Frame; features: Feature[]; family: 'everyday' | 'tailoring' | 'sport' | 'utility' | 'expressive' | 'soft';
  shoot: string; view: 'full' | 'detail'; garments: ('skirt' | 'shorts' | 'heels' | 'boots')[]; shoesKnown: boolean; bottomKnown: boolean;
};
export type PhotoReaction = 'wear' | 'admire' | 'pass' | 'unsure';
export type PhotoFeedback = { photoId: string; note: string; more: Feature[]; less: Feature[] };
export type PhotoVote = PhotoFeedback & { reaction: PhotoReaction };
export type PhotoSession = {
  version: 2; step: 'setup' | 'discover' | 'portrait'; sex: 'unspecified' | 'female' | 'male' | 'intersex';
  collection: 'all' | Collection; frame: 'all' | Frame; votes: PhotoVote[]; draft?: PhotoFeedback;
  exclusions: ('no-skirts' | 'no-shorts' | 'no-heels' | 'no-boots')[];
};
export type FeatureEvidence = { feature: Feature; score: number; seen: number; wear: number; admire: number; pass: number; explicit: number };
