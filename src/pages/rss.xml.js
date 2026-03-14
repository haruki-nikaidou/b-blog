import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import siteConfig from '../../content/site.json';

const SITE_TITLE = siteConfig.title;
const SITE_DESCRIPTION = siteConfig.description;

export async function GET(context) {
	const posts = (await getCollection('blog')).filter((post) => !post.data.draft);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: new URL(`/blog/${post.id}`, context.site).toString(),
		})),
	});
}
