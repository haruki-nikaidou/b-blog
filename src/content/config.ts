import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({
		pattern: '**/*.md',
		base: 'content/blog',
	}),
	schema: z.object({
		// Metadata
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		draft: z.boolean().optional(),

		// Hero Image
		heroImageId: z.string().optional(),
		heroImageSource: z.string().optional(),
		heroImageSourceUrl: z.string().optional(),
		heroImageAuthor: z.string().optional(),
		heroImageAuthorUrl: z.string().optional(),
		heroImageOwned: z.boolean().default(false),

		// content metadata
		pinned: z.boolean().optional(),
		tags: z.array(z.string()),
	}),
});

export const collections = { blog };
