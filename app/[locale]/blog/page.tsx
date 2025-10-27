import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import ReviewsSection from "../../../components/sections/ReviewsSection";
import blogPosts from "../../../data/blogPosts";

export default async function BlogPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("blog");

	return (
		<div className="min-h-screen bg-gray-50 py-20">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center mb-12">
					<h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
						{t("title")}
					</h1>
					<p className="text-xl text-gray-600">{t("subtitle")}</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{blogPosts.map((post) => {
						let titleText = post.title.en;
						if (locale === "de") titleText = post.title.de;
						else if (locale === "vi") titleText = post.title.vi;

						let excerptText = post.excerpt.en;
						if (locale === "de") excerptText = post.excerpt.de;
						else if (locale === "vi") excerptText = post.excerpt.vi;

						return (
							<article
							key={post.id}
							className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
						>
							<div className="p-6">
								<div className="text-sm text-gray-500 mb-2">
									{new Date(post.date).toLocaleDateString(locale)}
								</div>
								<h2 className="text-2xl font-bold text-gray-900 mb-3">
									{titleText}
								</h2>
								<p className="text-gray-600 mb-4">
									{excerptText}
								</p>
								<Link
									href={`/${locale}/blog/${post.id}`}
									className="text-blue-600 hover:text-blue-800 font-semibold"
								>
									{t("read_more")} →
								</Link>
							</div>
						</article>
						);
					})}
				</div>

				{/* Reviews section inserted below blog list */}
				<div className="mt-16">
					<ReviewsSection />
				</div>
			</div>
		</div>
	);
}
