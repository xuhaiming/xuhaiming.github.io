Since React JS with Redux is not as attractive as before for me, I decided to rewrite my Github Pages with something new.

## Vue JS 2.0

Fortunately Vue JS 2.0 been recently released. As Vue combined the advantages of React and Angular, I would like to give it a try. Also the powerful Vue loader allow us to write style in `.vue` file, which is great since it builds real external css so no need hacky JavaScript to overwrite inline styles. Although Vue does not have an ecosystem as good as React, Vue Router, Vuex and Server Rendering are enough for building basic production applications. Also we can inject any HTML template (pug) or any style (sass, postcss) syntax in the component, which is really cool!

## Materialize

As a software developer, I am not specialised in visual design. Therefore I need some UI frameworks to help me to make the website looks fancy.
There are many great frameworks such as Bootstrap, Foundations, etc. However, I enjoy [MaterializeCss](http://materializecss.com) most since it provides great components and easy to use. However, since MaterialzeCss script has different rendering way (direct DOM manipulation) than Vue or React. I just used the css part on my site.

## Github Pages

Github Pages is a great place for developer to host personal website, but there are quite a lot of limitations for the static website.
The most tough part is data, and it is so difficult to build something like CMS on Github Pages from Stretch.
Luckily we can use markdown syntax to write posts and use Ajax request to retrieve the data, which makes the website clear and simple to update.

```
axios.get(`/markdowns/${this.$route.params.id}.md`)
  .then(response => {
    this.content = marked(response.data)
})
```

In order to handle the relation and routing for posts. When new post created, the `post.js` should be updated. The data could be something below:

```
 const postList = [
   {
     title: 'About Haiming Pages',
     date: '2016-11-20',
     description: 'An introduction of the structure of current Haiming Pages.'
   }
 ]
```

Base on this information, an id will be generated, which is a combination of date and title. In this case it is `2016-11-20-about-haiming-pages`.
This id is used to navigate to the correct page and request for correct resources.

As the infrastructure of Haiming Pages is basically done, I hope I can keep updating and improving this website, 
sharing something interesting and useful in the future.   