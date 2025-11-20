import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import blogPosts from "@/data/blogPosts";
import { routing } from "@/routing";
import BlogPostLayout from "@/components/BlogPostLayout";

export async function generateStaticParams() {
  // generate params for all locales and posts
  return blogPosts.flatMap((post) =>
    routing.locales.map((locale) => ({ locale, id: post.id }))
  );
}

export default async function PostPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const post = blogPosts.find((p) => p.id === id);
  if (!post) return notFound();

  let title = post.title.en;
  if (locale === "de") title = post.title.de;
  else if (locale === "vi") title = post.title.vi;

  let content = post.content.en;
  if (locale === "de") content = post.content.de;
  else if (locale === "vi") content = post.content.vi;
  const localizedContent = content.replaceAll("/__LOCALE__/", `/${locale}`);

  return <BlogPostLayout post={post} title={title} content={localizedContent} locale={locale} />;
}
