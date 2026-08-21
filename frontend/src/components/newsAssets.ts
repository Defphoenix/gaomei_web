export const FEATURED_NEWS_FALLBACKS = [
  "/assets/images/blog_one.jpg",
  "/assets/images/blog_two.jpg",
  "/assets/images/portfolio_four.jpg",
];

export const featuredNewsFallback = (index: number) => (
  FEATURED_NEWS_FALLBACKS[index % FEATURED_NEWS_FALLBACKS.length]
);
