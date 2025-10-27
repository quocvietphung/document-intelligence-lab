import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import blogPosts from "../../../../data/blogPosts";
import { routing } from "../../../../routing";

export async function generateStaticParams() {
  // generate params for all locales and posts
  return blogPosts.flatMap((post) =>
    routing.locales.map((locale) => ({ locale, id: post.id }))
  );
}

export default async function PostPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");

  const post = blogPosts.find((p) => p.id === id);
  if (!post) return notFound();

  let title = post.title.en;
  if (locale === "de") title = post.title.de;
  else if (locale === "vi") title = post.title.vi;

  let content = post.content.en;
  if (locale === "de") content = post.content.de;
  else if (locale === "vi") content = post.content.vi;

  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <article className="prose lg:prose-xl">
          <h1>{title}</h1>
          <p className="text-sm text-gray-500">{new Date(post.date).toLocaleDateString(locale)}</p>
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </article>
      </div>
    </div>
  );
}
