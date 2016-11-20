const postList = [
  {
    title: 'First Post',
    date: '2016-11-18',
    description: 'First post description'
  },
  {
    title: 'Second Post',
    date: '2016-11-19',
    description: 'Second post description'
  },
  {
    title: 'Third Post',
    date: '2016-11-20',
    description: 'Third post description'
  }
]

const computedPostList = postList.map(post => {
  const convertedTitle = post.title.toLowerCase().replace(' ', '-')

  return Object.assign(post, {
    id: `${post.date}-${convertedTitle}`
  })
})

export default computedPostList
