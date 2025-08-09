import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	type: 'content',
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImageId: z.string().optional(),
		pinned: z.boolean().optional(),
		tags: z.array(z.string()),
		notCompleted: z.boolean().optional(),
	}),
});

export const collections = { blog };
