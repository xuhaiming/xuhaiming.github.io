const postList = [
  {
    title: 'Create parallax effect in Vue',
    date: '2017-03-18',
    description: 'Build scroll parallax Vue component from stretch with maximium scroll effect'
  },
  {
    title: 'About Haiming Pages',
    date: '2016-11-20',
    description: 'An introduction of the structure of current Haiming Pages.'
  },
  {
    title: 'Display code using Highlight JS',
    date: '2016-07-10',
    description: 'Apply code highlight effect with Highlight JS'
  }
]

const computedPostList = postList.map(post => {
  const convertedTitle = post.title.toLowerCase().replace(/ /g, '-')

  return Object.assign(post, {
    id: `${post.date}-${convertedTitle}`
  })
})

export default computedPostList
