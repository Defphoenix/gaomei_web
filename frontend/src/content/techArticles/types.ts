export type TechSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type TechArticle = {
  slug: string;
  title: string;
  subtitle: string;
  categoryId: string;
  categoryTitle: string;
  intro: string;
  sections: TechSection[];
  relatedSlugs: string[];
};
