import React from "react";
import type { BlogPost } from "../data/blogPosts";

type Props = {
  post: BlogPost;
  title: string;
  content: string; // HTML
  locale: string;
};

function estimateReadTime(text: string) {
  const words = text.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 200;
  const minutes = Math.max(1, Math.round(words / wordsPerMinute));
  return `${minutes} min read`;
}

export function BlogPostLayout({ post, title, content, locale }: Props) {
  const cover = post.coverImage || "/default-cover.jpg";
  const authorName = (post.author && post.author.name) || "Tax Consulting";
  const dateStr = new Date(post.date).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
  const readTime = estimateReadTime(content);

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <article className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Hero image */}
          <div className="w-full h-64 sm:h-96 relative">
            <img src={cover} alt={title} className="w-full h-full object-cover" />
          </div>

          <div className="px-6 py-8 sm:p-12">
            <header className="mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-3">{title}</h1>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-700">
                      {authorName.split(" ").map((n) => n[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{authorName}</div>
                      <div className="text-xs text-gray-500">{dateStr} · {readTime}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {/* Simple share links (relative url) */}
                  <a
                    href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent("Read this article: /blog/" + post.id)}`}
                    className="text-blue-600 hover:underline"
                  >
                    Email
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent("/blog/" + post.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Twitter
                  </a>
                </div>
              </div>
            </header>

            {/* Tags */}
            <div className="mb-6">
              {post.tags && post.tags.map((tag) => (
                <span key={tag} className="inline-block mr-2 mb-2 px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">#{tag}</span>
              ))}
            </div>

            {/* Content */}
            <div className="prose max-w-none lg:prose-xl" dangerouslySetInnerHTML={{ __html: content }} />

            {/* Footer CTA */}
            <footer className="mt-10 border-t border-gray-100 pt-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-gray-700">Enjoyed this article?</div>
                  <a href="/#contact" className="inline-block mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700">Book a consultation</a>
                </div>
                <div className="mt-4 sm:mt-0 text-sm text-gray-500">© {new Date().getFullYear()} {authorName}</div>
              </div>
            </footer>
          </div>
        </article>
      </div>
    </div>
  );
}

export default BlogPostLayout;
