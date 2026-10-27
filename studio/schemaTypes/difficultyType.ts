
import {defineField, defineType} from 'sanity'

export const difficultyType = defineType({
  name: 'difficulty',
  title: 'Difficulties',
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
      title: 'Description',
      type: 'text',
    }),
    defineField({
      name: 'order',
      title: 'Sort Order',
      type: 'number',
      validation: (Rule) => Rule.required().integer().min(1),
    }),
  ],
})
