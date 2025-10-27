import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import ReviewsSection from "../../../components/sections/ReviewsSection";

// Sample blog posts data
const blogPosts = [
	{
		id: "tax-deductions-2024",
		title: {
			en: "Top Tax Deductions for 2024",
			de: "Top Steuerabzüge für 2024",
		},
		excerpt: {
			en: "Learn about the most important tax deductions you can claim in 2024 to maximize your tax savings.",
			de: "Erfahren Sie mehr über die wichtigsten Steuerabzüge, die Sie 2024 geltend machen können, um Ihre Steuerersparnisse zu maximieren.",
		},
		date: "2024-01-15",
	},
	{
		id: "freelancer-tax-tips",
		title: {
			en: "Tax Tips for Freelancers",
			de: "Steuertipps für Freiberufler",
		},
		excerpt: {
			en: "Essential tax advice for freelancers and self-employed professionals in Germany.",
			de: "Wichtige Steuerberatung für Freiberufler und Selbständige in Deutschland.",
		},
		date: "2024-02-01",
	},
	{
		id: "business-expenses",
		title: {
			en: "Understanding Business Expenses",
			de: "Geschäftsausgaben verstehen",
		},
		excerpt: {
			en: "A comprehensive guide to what counts as deductible business expenses.",
			de: "Ein umfassender Leitfaden zu abzugsfähigen Geschäftsausgaben.",
		},
		date: "2024-02-15",
	},
];

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
					{blogPosts.map((post) => (
						<article
							key={post.id}
							className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
						>
							<div className="p-6">
								<div className="text-sm text-gray-500 mb-2">
									{new Date(post.date).toLocaleDateString()}
								</div>
								<h2 className="text-2xl font-bold text-gray-900 mb-3">
									{locale === "de" ? post.title.de : post.title.en}
								</h2>
								<p className="text-gray-600 mb-4">
									{locale === "de" ? post.excerpt.de : post.excerpt.en}
								</p>
								<Link
									href={`/blog/${post.id}`}
									className="text-blue-600 hover:text-blue-800 font-semibold"
								>
									{t("read_more")} →
								</Link>
							</div>
						</article>
					))}
				</div>

				{/* Reviews section inserted below blog list */}
				<div className="mt-16">
					<ReviewsSection />
				</div>
			</div>
		</div>
	);
}
