
import { defineField, defineType } from 'sanity'

export const articleType = defineType({
  name: 'article',
  title: 'Articles',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required().max(200),
    }),

    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'reference',
      to: [{ type: 'topic' }],
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'tag' }] }],
    }),

defineField({
  name: 'difficulty',
  title: 'Difficulty',
  type: 'reference',
  to: [{type: 'difficulty'}],
  validation: (Rule) => Rule.required(),
}),

    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),

    defineField({
  name: 'readingTime',
  title: 'Reading Time (minutes)',
  type: 'number',
  validation: (Rule) => Rule.min(1).integer(),
}),
defineField({
  name: 'relatedArticles',
  title: 'Related Articles',
  type: 'array',
  of: [
    {
      type: 'reference',
      to: [{type: 'article'}],
    },
  ],
}),

    defineField({
      name: 'body',
      title: 'Article Content',
      type: 'array',
      of: [
        { type: 'block' },
        { type: 'image', options: { hotspot: true } },
      ],
      validation: (Rule) => Rule.required(),
    }),
  ],
  

  preview: {
    select: {
      title: 'title',
      subtitle: 'difficulty',
    },
  },
})

