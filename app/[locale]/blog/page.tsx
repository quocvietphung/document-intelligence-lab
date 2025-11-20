import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import blogPosts from "@/data/blogPosts";
import { Fragment } from "react";

function stripHtml(html: string) {
	return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function readingTime(html: string) {
	const words = stripHtml(html).split(" ").filter(Boolean).length;
	const minutes = Math.max(1, Math.ceil(words / 200));
	return `${minutes} min read`;
}

export default async function BlogPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("blog");

	// Sort posts by date desc and select featured
	const postsSorted = blogPosts
		.slice()
		.sort((a, b) => (a.date < b.date ? 1 : -1));
	const featured = postsSorted[0];
	const others = postsSorted.slice(1);

	const siteAuthor = {
		name: "Tax Consulting",
		avatar: "",
	};

	return (
		<main className="min-h-screen bg-gray-50">
			{/* Hero / Featured */}
			<section className="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-500 text-white pb-24">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
						<div className="space-y-6">
							<span className="inline-block bg-white/10 text-white text-sm font-semibold px-3 py-1 rounded-full">
								Featured
							</span>
							<h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
								{locale === "de"
									? featured.title.de
									: locale === "vi"
									? featured.title.vi
									: featured.title.en}
							</h1>
							<p className="text-lg sm:text-xl text-white/90 max-w-2xl">
								{locale === "de"
									? featured.excerpt.de
									: locale === "vi"
									? featured.excerpt.vi
									: featured.excerpt.en}
							</p>

							<div className="flex items-center gap-4">
								<div className="flex items-center gap-3">
									<div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
										{siteAuthor.name.split(" ")[0][0]}
									</div>
									<div>
										<div className="text-sm font-semibold">
											{siteAuthor.name}
										</div>
										<div className="text-xs text-white/80">
											{new Date(featured.date).toLocaleDateString(locale, {
												year: "numeric",
												month: "short",
												day: "numeric",
											})}{" "}
											·{" "}
											{readingTime(
												locale === "de"
													? featured.content.de
													: locale === "vi"
													? featured.content.vi
													: featured.content.en
											)}
										</div>
									</div>
								</div>

								<Link
									href={`/${locale}/blog/${featured.id}`}
									className="ml-4 inline-flex items-center gap-2 bg-white text-indigo-700 px-4 py-2 rounded-md font-medium shadow hover:opacity-95"
								>
									Read full article
								</Link>
							</div>
						</div>

						<div className="hidden lg:block">
							<div className="aspect-w-16 aspect-h-10 rounded-xl overflow-hidden shadow-2xl border border-white/10">
								<div
									className="w-full h-full bg-cover bg-center"
									style={{
										backgroundImage: `url('https://images.unsplash.com/photo-1523289333742-bea4c7c0a2e6?auto=format&fit=crop&w=1200&q=60')`,
									}}
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Content list */}
			<section className="-mt-16 relative z-10">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="bg-white rounded-xl shadow-xl p-8">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
							<div>
								<h2 className="text-2xl font-extrabold text-gray-900">
									{t("title")}
								</h2>
								<p className="text-gray-600">{t("subtitle")}</p>
							</div>

							<div className="flex items-center gap-3">
								<input
									type="search"
									placeholder="Search articles..."
									className="px-4 py-2 border rounded-lg w-72 focus:ring-2 focus:ring-indigo-500"
								/>
								<select className="px-3 py-2 border rounded-lg">
									<option>All topics</option>
									<option>Taxes</option>
									<option>Business</option>
									<option>Freelancer</option>
								</select>
							</div>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Featured small card (first column) */}
							<article className="lg:col-span-1 bg-gradient-to-r from-white to-gray-50 p-6 rounded-lg border">
								<h3 className="text-lg font-semibold text-gray-900 mb-2">
									Featured
								</h3>
								<h4 className="text-xl font-bold mb-2">
									{locale === "de"
										? featured.title.de
										: locale === "vi"
										? featured.title.vi
										: featured.title.en}
								</h4>
								<p className="text-gray-600 mb-4">
									{(locale === "de"
										? stripHtml(featured.content.de)
										: locale === "vi"
										? stripHtml(featured.content.vi)
										: stripHtml(featured.content.en)
									).slice(0, 200)}...
								</p>
								<div className="flex items-center justify-between">
									<div className="text-sm text-gray-500">
										{new Date(featured.date).toLocaleDateString(locale)}
									</div>
									<Link
										href={`/${locale}/blog/${featured.id}`}
										className="text-indigo-600 font-semibold"
									>
										{t("read_more")}
									</Link>
								</div>
							</article>

							{/* Grid of other posts */}
							<div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
								{others.map((post) => {
									const titleText =
										locale === "de"
											? post.title.de
											: locale === "vi"
											? post.title.vi
											: post.title.en;
									const excerptText =
										locale === "de"
											? post.excerpt.de
											: locale === "vi"
											? post.excerpt.vi
											: post.excerpt.en;
									const contentHtml =
										locale === "de"
											? post.content.de
											: locale === "vi"
											? post.content.vi
											: post.content.en;

									return (
										<article
											key={post.id}
											className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
										>
											<div className="p-6">
												<div className="mb-3">
													<div
														className="w-full h-40 bg-gray-200 rounded-md overflow-hidden"
														style={{
															backgroundImage: `url('https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1200&q=60')`,
															backgroundSize: "cover",
															backgroundPosition: "center",
														}}
													/>
												</div>

												<h3 className="text-lg font-semibold text-gray-900 mb-2">
													{titleText}
												</h3>
												<p className="text-gray-600 mb-4">
													{excerptText}
												</p>

												<div className="flex items-center justify-between">
													<div className="text-sm text-gray-500">
														{new Date(post.date).toLocaleDateString(
															locale
														)}{" "}
														·{" "}
														{readingTime(contentHtml)}
													</div>
													<Link
														href={`/${locale}/blog/${post.id}`}
														className="text-indigo-600 font-semibold"
													>
														{t("read_more")}
													</Link>
												</div>
											</div>
										</article>
									);
								})}
							</div>
						</div>

						{/* CTA */}
						<div className="mt-8 border-t pt-6 flex items-center justify-between">
							<div>
								<h4 className="text-lg font-semibold">Want expert help?</h4>
								<p className="text-gray-600">
									Book a consultation with our tax specialists.
								</p>
							</div>

							<Link
								href={`/${locale}/contact`}
								className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md font-medium shadow hover:opacity-95"
							>
								{t("book_consultation")}
							</Link>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
