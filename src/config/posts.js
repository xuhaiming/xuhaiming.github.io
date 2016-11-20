const postList = [
  {
    title: 'About Haiming Pages',
    date: '2016-11-20',
    description: 'An introduction of the structure of current Haiming Pages.'
  }
]

const computedPostList = postList.map(post => {
  const convertedTitle = post.title.toLowerCase().replace(/ /g, '-')

  return Object.assign(post, {
    id: `${post.date}-${convertedTitle}`
  })
})

export default computedPostList
