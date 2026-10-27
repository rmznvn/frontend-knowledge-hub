
import {defineField, defineType} from 'sanity'

export const taskType = defineType({
  name: 'task',
  title: 'Coding Tasks',
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
      options: {source: 'title'},
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'description',
      title: 'Short Description',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required().max(200),
    }),

    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'reference',
      to: [{type: 'topic'}],
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'tag'}]}],
    }),

    defineField({
      name: 'difficulty',
      title: 'Difficulty',
      type: 'string',
      options: {
        list: [
          {title: 'Beginner', value: 'beginner'},
          {title: 'Intermediate', value: 'intermediate'},
          {title: 'Advanced', value: 'advanced'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'estimatedMinutes',
      title: 'Estimated Time (minutes)',
      type: 'number',
      validation: (Rule) => Rule.min(1).integer(),
    }),

    defineField({
      name: 'instructions',
      title: 'Task Instructions',
      type: 'array',
      of: [{type: 'block'}],
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'requirements',
      title: 'Requirements',
      type: 'array',
      of: [{type: 'string'}],
      validation: (Rule) => Rule.min(1),
    }),

    defineField({
      name: 'starterCode',
      title: 'Starter Code',
      type: 'text',
      rows: 8,
    }),

    defineField({
      name: 'language',
      title: 'Programming Language',
      type: 'string',
      options: {
        list: [
          {title: 'JavaScript', value: 'javascript'},
          {title: 'TypeScript', value: 'typescript'},
          {title: 'JSX', value: 'jsx'},
          {title: 'TSX', value: 'tsx'},
          {title: 'HTML', value: 'html'},
          {title: 'CSS', value: 'css'},
          {title: 'Astro', value: 'astro'},
        ],
      },
    }),

    defineField({
      name: 'hints',
      title: 'Hints',
      type: 'array',
      of: [{type: 'text'}],
      description: 'Add hints in order, from easiest to most revealing.',
    }),

    defineField({
      name: 'solutionCode',
      title: 'Solution Code',
      type: 'text',
      rows: 12,
    }),

    defineField({
      name: 'solutionExplanation',
      title: 'Solution Explanation',
      type: 'array',
      of: [{type: 'block'}],
    }),

    defineField({
      name: 'commonMistakes',
      title: 'Common Mistakes',
      type: 'array',
      of: [{type: 'string'}],
    }),

    defineField({
      name: 'relatedArticles',
      title: 'Related Articles',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'article'}]}],
    }),

    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'difficulty',
    },
  },
})
